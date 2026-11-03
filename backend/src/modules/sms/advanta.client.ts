import { Logger } from '../../lib/logger.js';

export interface AdvantaCredentials {
  url: string;
  apiKey: string;
  partnerId: string;
  shortcode: string;
}

// Fixed platform endpoint (unlike the account's configurable send URL) -
// every Advanta tenant checks its balance at this same path, authenticated
// with the same apikey/partnerID/shortcode as a send.
const BALANCE_URL = 'https://quicksms.advantasms.com/api/services/getbalance/';

/**
 * Thin wrapper over the Advanta (QuickSMS) SMS gateway: failures are logged
 * and swallowed (returned as `false`/`null`) rather than thrown, so one bad
 * send/balance-check doesn't take down a bulk campaign or the dashboard.
 * Credentials come from whichever gateway Settings has marked active - see
 * modules/settings/sms-gateway.service.ts.
 */
export class AdvantaSmsClient {
  constructor(private readonly creds: AdvantaCredentials, private readonly log: Logger) {}

  /** `to` is a normalized MSISDN, e.g. "254712345678". Returns true iff the gateway accepted the send. */
  async sendSms(to: string, message: string): Promise<boolean> {
    try {
      const res = await fetch(this.creds.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: this.creds.apiKey,
          partnerID: this.creds.partnerId,
          shortcode: this.creds.shortcode,
          mobile: to,
          message,
        }),
      });

      if (!res.ok) {
        this.log.error({ status: res.status, body: await res.text().catch(() => undefined) }, 'Advanta SMS API error');
        return false;
      }

      // Advanta returns 200 with a JSON body even for some rejected sends
      // (e.g. invalid number) - a rejection ID prefix is the documented way
      // to tell those apart from a true delivery acceptance.
      const data = (await res.json().catch(() => null)) as { responses?: Array<{ respose_code?: number; 'response-code'?: number }> } | null;
      const code = data?.responses?.[0]?.respose_code ?? data?.responses?.[0]?.['response-code'];
      if (code !== undefined && code !== 200) {
        this.log.error({ code, data }, 'Advanta SMS rejected the message');
        return false;
      }

      return true;
    } catch (err) {
      this.log.error({ err, to }, 'Advanta SMS send errored');
      return false;
    }
  }

  /** Returns the remaining SMS credit balance on the account, or null if the check failed. */
  async getBalance(): Promise<number | null> {
    try {
      const res = await fetch(BALANCE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: this.creds.apiKey,
          partnerID: this.creds.partnerId,
          shortcode: this.creds.shortcode,
        }),
      });

      if (!res.ok) {
        this.log.error({ status: res.status, body: await res.text().catch(() => undefined) }, 'Advanta balance check API error');
        return null;
      }

      const data = (await res.json().catch(() => null)) as { credit?: string | number; 'response-code'?: number } | null;
      if (data?.credit === undefined) {
        this.log.error({ data }, 'Advanta balance check returned an unexpected response');
        return null;
      }

      const credit = typeof data.credit === 'number' ? data.credit : parseFloat(data.credit);
      return Number.isFinite(credit) ? credit : null;
    } catch (err) {
      this.log.error({ err }, 'Advanta balance check errored');
      return null;
    }
  }
}
