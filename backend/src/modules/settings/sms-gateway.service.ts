import type { PrismaClient } from '../../generated/prisma/index.js';
import type { EnvConfig } from '../../lib/env.js';
import type { Logger } from '../../lib/logger.js';
import type { AuditLogService } from '../audit/audit-log.service.js';
import { SmsProvider } from '../../shared/types/index.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { encryptJson, decryptJson } from '../../shared/utils/crypto.js';
import { AdvantaSmsClient, AdvantaCredentials } from '../sms/advanta.client.js';
import {
  PROVIDER_FIELDS, PROVIDER_LABELS, isProviderImplemented, requiredFieldsPresent, maskFields,
} from './sms-provider-registry.js';

// Takes its dependencies directly (not the full AppContext) so it can be
// constructed in server.ts and handed into `ctx` itself, the same
// "no circular ctx needs X, X needs ctx" resolution AuditLogService uses.
export interface SmsGatewayDeps {
  prisma: PrismaClient;
  config: EnvConfig;
  log: Logger;
  auditLog: AuditLogService;
}

export interface GatewaySummary {
  provider: SmsProvider;
  label: string;
  implemented: boolean;
  configured: boolean;
  isActive: boolean;
  fields: { key: string; label: string; secret: boolean; placeholder?: string }[];
  values: Record<string, string>;
  updatedAt: string | null;
}

type Fields = Record<string, string>;

export class SmsGatewayService {
  constructor(private app: SmsGatewayDeps) {}

  /**
   * One-time migration hook, called at server startup: if Settings has never
   * been touched (no rows yet) and the old .env-based Advanta vars are fully
   * set, seed + activate a row from them so an existing deployment keeps
   * sending without anyone having to retype credentials into the UI.
   */
  async ensureSeedFromEnv(): Promise<void> {
    const existing = await this.app.prisma.smsGateway.count();
    if (existing > 0) return;

    const { ADVANTA_SMS_URL, ADVANTA_API_KEY, ADVANTA_PARTNER_ID, ADVANTA_SHORTCODE } = this.app.config;
    if (!ADVANTA_SMS_URL || !ADVANTA_API_KEY || !ADVANTA_PARTNER_ID || !ADVANTA_SHORTCODE) return;

    const fields: Fields = { url: ADVANTA_SMS_URL, apiKey: ADVANTA_API_KEY, partnerId: ADVANTA_PARTNER_ID, shortcode: ADVANTA_SHORTCODE };
    await this.app.prisma.smsGateway.create({
      data: { provider: 'ADVANTA', isActive: true, configEnc: encryptJson(this.app.config.JWT_SECRET, fields) },
    });
    this.app.log.info('Seeded SMS gateway settings from ADVANTA_* environment variables');
  }

  private async getRawFields(provider: SmsProvider): Promise<Fields | null> {
    const row = await this.app.prisma.smsGateway.findUnique({ where: { provider } });
    if (!row) return null;
    return decryptJson<Fields>(this.app.config.JWT_SECRET, row.configEnc);
  }

  private toSummary(provider: SmsProvider, fields: Fields | null, isActive: boolean, updatedAt: Date | null): GatewaySummary {
    return {
      provider,
      label: PROVIDER_LABELS[provider],
      implemented: isProviderImplemented(provider),
      configured: fields !== null && requiredFieldsPresent(provider, fields),
      isActive,
      fields: PROVIDER_FIELDS[provider],
      values: maskFields(provider, fields ?? {}),
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  /** Every known provider, configured or not - so the Settings page can render a card per provider. */
  async list(): Promise<GatewaySummary[]> {
    const rows = await this.app.prisma.smsGateway.findMany();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));

    return (Object.keys(PROVIDER_FIELDS) as SmsProvider[]).map((provider) => {
      const row = byProvider.get(provider);
      const fields = row ? decryptJson<Fields>(this.app.config.JWT_SECRET, row.configEnc) : null;
      return this.toSummary(provider, fields, row?.isActive ?? false, row?.updatedAt ?? null);
    });
  }

  async upsert(provider: SmsProvider, incoming: Fields, actorId: string): Promise<GatewaySummary> {
    const existing = (await this.getRawFields(provider)) ?? {};
    const merged: Fields = {};
    for (const f of PROVIDER_FIELDS[provider]) {
      const incomingVal = incoming[f.key]?.trim();
      if (incomingVal) {
        merged[f.key] = incomingVal;
      } else if (f.secret) {
        // Blank means "leave the saved secret alone" - the UI only ever shows a masked value back.
        merged[f.key] = existing[f.key] ?? '';
      } else {
        merged[f.key] = incoming[f.key] !== undefined ? '' : (existing[f.key] ?? '');
      }
    }

    const configEnc = encryptJson(this.app.config.JWT_SECRET, merged);
    const row = await this.app.prisma.smsGateway.upsert({
      where: { provider },
      create: { provider, configEnc, updatedById: actorId },
      update: { configEnc, updatedById: actorId },
    });

    await this.app.auditLog.record({
      actorId, action: 'UPDATE', subjectType: 'SMS_GATEWAY', subjectId: provider,
      summary: `Updated ${PROVIDER_LABELS[provider]} SMS gateway settings`,
    });

    return this.toSummary(provider, merged, row.isActive, row.updatedAt);
  }

  async setActive(provider: SmsProvider, actorId: string): Promise<GatewaySummary> {
    if (!isProviderImplemented(provider)) {
      throw new BadRequestError(`${PROVIDER_LABELS[provider]} isn't wired up for sending yet - Advanta is the only provider that can be activated right now.`);
    }

    const row = await this.app.prisma.smsGateway.findUnique({ where: { provider } });
    if (!row) throw new BadRequestError('Save this gateway\'s credentials before activating it');

    const fields = decryptJson<Fields>(this.app.config.JWT_SECRET, row.configEnc);
    if (!requiredFieldsPresent(provider, fields)) {
      throw new BadRequestError('Fill in all required fields before activating this gateway');
    }

    const updated = await this.app.prisma.$transaction(async (tx) => {
      await tx.smsGateway.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.smsGateway.update({ where: { provider }, data: { isActive: true, updatedById: actorId } });
    });

    await this.app.auditLog.record({
      actorId, action: 'UPDATE', subjectType: 'SMS_GATEWAY', subjectId: provider,
      summary: `Activated ${PROVIDER_LABELS[provider]} as the sending gateway`,
    });

    return this.toSummary(provider, fields, updated.isActive, updated.updatedAt);
  }

  async deactivate(provider: SmsProvider, actorId: string): Promise<GatewaySummary> {
    const row = await this.app.prisma.smsGateway.findUnique({ where: { provider } });
    if (!row) throw new NotFoundError('SMS gateway');

    const updated = await this.app.prisma.smsGateway.update({ where: { provider }, data: { isActive: false, updatedById: actorId } });
    await this.app.auditLog.record({
      actorId, action: 'UPDATE', subjectType: 'SMS_GATEWAY', subjectId: provider,
      summary: `Deactivated the ${PROVIDER_LABELS[provider]} SMS gateway`,
    });

    const fields = decryptJson<Fields>(this.app.config.JWT_SECRET, row.configEnc);
    return this.toSummary(provider, fields, updated.isActive, updated.updatedAt);
  }

  /** Builds a real client from a provider's saved (not necessarily active) creds and pings it - lets an admin verify before flipping the switch. */
  async testConnection(provider: SmsProvider): Promise<{ ok: boolean; message: string; credit?: number }> {
    const fields = await this.getRawFields(provider);
    if (!fields) return { ok: false, message: 'Save credentials for this provider first.' };
    if (!requiredFieldsPresent(provider, fields)) return { ok: false, message: 'Fill in all required fields first.' };

    if (provider === 'ADVANTA') {
      const client = new AdvantaSmsClient(fields as unknown as AdvantaCredentials, this.app.log);
      const credit = await client.getBalance();
      if (credit === null) return { ok: false, message: 'The gateway did not respond as expected - double-check the credentials.' };
      return { ok: true, message: `Connected - ${credit.toLocaleString()} credit(s) remaining.`, credit };
    }

    return { ok: false, message: 'Test connection isn\'t available for this provider yet.' };
  }

  /** The gateway campaigns should actually send through right now, or null if none is active/usable. */
  async getActiveClient(): Promise<{ provider: SmsProvider; client: AdvantaSmsClient; fields: Fields } | null> {
    const row = await this.app.prisma.smsGateway.findFirst({ where: { isActive: true } });
    if (!row || !isProviderImplemented(row.provider)) return null;

    const fields = decryptJson<Fields>(this.app.config.JWT_SECRET, row.configEnc);
    if (!requiredFieldsPresent(row.provider, fields)) return null;

    if (row.provider === 'ADVANTA') {
      return { provider: row.provider, client: new AdvantaSmsClient(fields as unknown as AdvantaCredentials, this.app.log), fields };
    }
    return null;
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getActiveClient()) !== null;
  }
}
