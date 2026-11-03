import { AppContext } from '../../context.js';
import { Prisma, CampaignAudience } from '../../generated/prisma/index.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { estimateSmsSegments } from '../sms/sms-segments.js';
import { personalizeMessage } from '../sms/personalize.js';
import { signMessage } from '../sms/signature.js';
import { CampaignDispatchService } from './dispatch.service.js';

export interface AudienceInput {
  audience: CampaignAudience;
  groupId?: string;
  memberIds?: string[];
}

const CAMPAIGN_SELECT = {
  id: true, name: true, message: true, audience: true, groupId: true, groupNameSnapshot: true,
  status: true, totalRecipients: true, sentCount: true, failedCount: true,
  createdAt: true, updatedAt: true, completedAt: true,
  createdById: true, createdBy: { select: { id: true, name: true } },
} as const;

export class CampaignService {
  private dispatch: CampaignDispatchService;

  constructor(private app: AppContext) {
    this.dispatch = new CampaignDispatchService(app);
  }

  /** Resolves an audience selector into the actual list of members that would receive the send. */
  async resolveRecipients(input: AudienceInput) {
    const select = { id: true, name: true, phone: true } as const;

    if (input.audience === 'ALL_MEMBERS') {
      return this.app.prisma.member.findMany({ where: { isSubscribed: true }, select });
    }
    if (input.audience === 'GROUP') {
      if (!input.groupId) throw new BadRequestError('A group is required for a GROUP audience');
      return this.app.prisma.member.findMany({
        where: { isSubscribed: true, groupMemberships: { some: { groupId: input.groupId } } }, select,
      });
    }
    if (input.audience === 'SELECTED') {
      if (!input.memberIds?.length) throw new BadRequestError('Select at least one member');
      return this.app.prisma.member.findMany({
        where: { isSubscribed: true, id: { in: input.memberIds } }, select,
      });
    }
    throw new BadRequestError('Invalid audience');
  }

  /** The message as it will actually be stored and sent: with the operator's sign-off appended. */
  private async signFor(message: string, actorId: string) {
    const signer = await this.app.prisma.user.findUnique({ where: { id: actorId }, select: { name: true, position: true } });
    if (!signer) throw new NotFoundError('User');
    return signMessage(message, signer);
  }

  async preview(input: AudienceInput & { message: string }, actorId: string) {
    const recipients = await this.resolveRecipients(input);
    const message = await this.signFor(input.message, actorId);
    // Estimate off the personalized text, not the raw `{{name}}` template -
    // the token itself uses characters (curly braces) outside the GSM-7
    // alphabet and would otherwise skew the segment/encoding estimate away
    // from what actually gets sent.
    const sample = recipients[0] ? personalizeMessage(message, recipients[0].name) : message;
    const { length, segments, encoding } = estimateSmsSegments(sample);
    return { recipientCount: recipients.length, length, segments, encoding, sample };
  }

  async createCampaign(
    input: AudienceInput & { name: string; message: string },
    actorId: string
  ) {
    if (!input.message.trim()) throw new BadRequestError('Message cannot be empty');
    if (!(await this.app.smsGateways.isEnabled())) {
      throw new BadRequestError('SMS is not configured. Ask a super admin to set up a gateway under Settings.');
    }

    const recipients = await this.resolveRecipients(input);
    if (recipients.length === 0) throw new BadRequestError('No recipients match this audience');
    const message = await this.signFor(input.message, actorId);

    let groupNameSnapshot: string | undefined;
    if (input.audience === 'GROUP' && input.groupId) {
      const group = await this.app.prisma.group.findUnique({ where: { id: input.groupId }, select: { name: true } });
      if (!group) throw new NotFoundError('Group');
      groupNameSnapshot = group.name;
    }

    const campaign = await this.app.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          name: input.name,
          message,
          audience: input.audience,
          groupId: input.audience === 'GROUP' ? input.groupId : undefined,
          groupNameSnapshot,
          totalRecipients: recipients.length,
          createdById: actorId,
        },
        select: CAMPAIGN_SELECT,
      });

      await tx.campaignRecipient.createMany({
        data: recipients.map((m) => ({
          campaignId: created.id, memberId: m.id, phoneSnapshot: m.phone, nameSnapshot: m.name,
        })),
      });

      return created;
    });

    await this.app.auditLog.record({
      actorId, action: 'CREATE', subjectType: 'CAMPAIGN', subjectId: campaign.id,
      summary: `Sent campaign "${campaign.name}" to ${recipients.length} recipient(s)`,
      newValues: campaign,
    });

    // Fire-and-forget: don't make the caller wait for every SMS to go out.
    void this.dispatch.dispatch(campaign.id).catch((err) => {
      this.app.log.error({ err, campaignId: campaign.id }, 'Campaign dispatch failed');
    });

    return campaign;
  }

  async listCampaigns(filters: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignWhereInput = {};
    if (status) where.status = status as Prisma.CampaignWhereInput['status'];

    const [data, total] = await Promise.all([
      this.app.prisma.campaign.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: CAMPAIGN_SELECT }),
      this.app.prisma.campaign.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getCampaignById(id: string) {
    const campaign = await this.app.prisma.campaign.findUnique({ where: { id }, select: CAMPAIGN_SELECT });
    if (!campaign) throw new NotFoundError('Campaign');
    return campaign;
  }

  async listRecipients(campaignId: string, filters: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignRecipientWhereInput = { campaignId };
    if (status) where.status = status as Prisma.CampaignRecipientWhereInput['status'];

    const [data, total] = await Promise.all([
      this.app.prisma.campaignRecipient.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, error: true, sentAt: true, phoneSnapshot: true, nameSnapshot: true, memberId: true },
      }),
      this.app.prisma.campaignRecipient.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async retryFailed(campaignId: string, actorId: string) {
    const campaign = await this.app.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign');

    const { count } = await this.app.prisma.campaignRecipient.updateMany({
      where: { campaignId, status: 'FAILED' },
      data: { status: 'PENDING', error: null },
    });
    if (count === 0) throw new BadRequestError('There are no failed recipients to retry');

    await this.app.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

    await this.app.auditLog.record({
      actorId, action: 'UPDATE', subjectType: 'CAMPAIGN', subjectId: campaignId,
      summary: `Retried ${count} failed recipient(s) for campaign "${campaign.name}"`,
    });

    void this.dispatch.dispatch(campaignId).catch((err) => {
      this.app.log.error({ err, campaignId }, 'Campaign retry dispatch failed');
    });

    return { retrying: count };
  }
}
