import { Router } from 'express';
import { AppContext } from '../../context.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../shared/guards/requireRole.js';
import { Role } from '../../shared/types/index.js';

const operatorRoles = [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN];

export function smsRoutes(ctx: AppContext): Router {
  const router = Router();

  router.use(authenticate);
  router.use(requireRole(operatorRoles));

  /**
   * GET /sms/balance - the active SMS gateway's remaining credit, shown in
   * the sidebar widget and the dedicated /credits page. `shortcode` is the
   * sender ID recipients see on an SMS - not a secret, unlike the API key/
   * partner ID, so it's safe to surface here for context. Which gateway (if
   * any) is active is configured under Settings, SUPER_ADMIN-only.
   */
  router.get('/balance', async (_req, res) => {
    const active = await ctx.smsGateways.getActiveClient();
    if (!active) {
      res.send({ ok: true, data: { enabled: false, credit: null, shortcode: null } });
      return;
    }

    const credit = await active.client.getBalance();
    res.send({ ok: true, data: { enabled: true, credit, shortcode: active.fields.shortcode ?? null } });
  });

  return router;
}
