import { AppContext } from '../../context.js';
import { personalizeMessage } from '../sms/personalize.js';

const BATCH_SIZE = 10;

/**
 * Sends a campaign's PENDING recipients through the SMS gateway in small
 * concurrent batches, updating each CampaignRecipient and the running
 * Campaign counts as it goes, and pushing a `campaign:progress` Socket.io
 * event after every batch so the frontend can show a live progress bar
 * instead of polling. Used both for a campaign's initial send and for
 * "retry failed" (which just resets some rows back to PENDING first).
 */
export class CampaignDispatchService {
  constructor(private app: AppContext) {}

  async dispatch(campaignId: string): Promise<void> {
    const campaign = await this.app.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const active = await this.app.smsGateways.getActiveClient();
    if (!active) {
      await this.app.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      this.app.io.emit('campaign:progress', {
        campaignId, status: 'FAILED', sentCount: campaign.sentCount, failedCount: campaign.failedCount, totalRecipients: campaign.totalRecipients,
      });
      return;
    }

    const client = active.client;
    const pending = await this.app.prisma.campaignRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      select: { id: true, phoneSnapshot: true, nameSnapshot: true },
    });

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (recipient) => {
          const ok = await client.sendSms(recipient.phoneSnapshot, personalizeMessage(campaign.message, recipient.nameSnapshot));
          await this.app.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: ok
              ? { status: 'SENT', sentAt: new Date(), error: null }
              : { status: 'FAILED', error: 'The SMS gateway rejected this message or the request errored' },
          });
        })
      );

      const [sentCount, failedCount] = await Promise.all([
        this.app.prisma.campaignRecipient.count({ where: { campaignId, status: 'SENT' } }),
        this.app.prisma.campaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
      ]);
      await this.app.prisma.campaign.update({ where: { id: campaignId }, data: { sentCount, failedCount } });
      this.app.io.emit('campaign:progress', {
        campaignId, status: 'SENDING', sentCount, failedCount, totalRecipients: campaign.totalRecipients,
      });
    }

    const finalSentCount = await this.app.prisma.campaignRecipient.count({ where: { campaignId, status: 'SENT' } });
    const finalStatus = finalSentCount > 0 ? 'COMPLETED' : 'FAILED';
    const updated = await this.app.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus, completedAt: new Date() },
    });
    this.app.io.emit('campaign:progress', {
      campaignId, status: updated.status, sentCount: updated.sentCount, failedCount: updated.failedCount, totalRecipients: updated.totalRecipients,
    });
  }
}
