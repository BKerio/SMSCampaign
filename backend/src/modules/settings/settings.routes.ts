import { Router } from 'express';
import { AppContext } from '../../context.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../shared/guards/requireRole.js';
import { Role, SmsProvider } from '../../shared/types/index.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { SmsGatewayService } from './sms-gateway.service.js';
import { PROVIDER_FIELDS } from './sms-provider-registry.js';

const VALID_PROVIDERS = Object.keys(PROVIDER_FIELDS) as SmsProvider[];

function parseProvider(raw: string): SmsProvider {
  const provider = raw.toUpperCase() as SmsProvider;
  if (!VALID_PROVIDERS.includes(provider)) throw new BadRequestError(`Unknown SMS provider "${raw}"`);
  return provider;
}

/**
 * SUPER_ADMIN-only: view/edit the bulk SMS gateway credentials, choose which
 * provider is active, and test a saved config before flipping the switch.
 * Live API credentials for sending real SMS - kept behind the top role tier,
 * unlike the rest of /admin (which ADMIN can also reach).
 */
export function settingsRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new SmsGatewayService(ctx);

  router.use(authenticate);
  router.use(requireRole([Role.SUPER_ADMIN]));

  router.get('/sms-gateways', async (_req, res) => {
    res.send({ ok: true, data: await service.list() });
  });

  router.put('/sms-gateways/:provider', async (req, res) => {
    const provider = parseProvider(req.params.provider);
    const body = req.body as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') fields[key] = value;
    }
    const gateway = await service.upsert(provider, fields, req.user.userId);
    res.send({ ok: true, data: gateway });
  });

  router.post('/sms-gateways/:provider/activate', async (req, res) => {
    const provider = parseProvider(req.params.provider);
    const gateway = await service.setActive(provider, req.user.userId);
    res.send({ ok: true, data: gateway });
  });

  router.post('/sms-gateways/:provider/deactivate', async (req, res) => {
    const provider = parseProvider(req.params.provider);
    const gateway = await service.deactivate(provider, req.user.userId);
    res.send({ ok: true, data: gateway });
  });

  router.post('/sms-gateways/:provider/test', async (req, res) => {
    const provider = parseProvider(req.params.provider);
    const result = await service.testConnection(provider);
    res.send({ ok: true, data: result });
  });

  return router;
}
