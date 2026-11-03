import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { AppContext } from './context.js';
import { env } from './lib/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { memberRoutes } from './modules/members/member.routes.js';
import { groupRoutes } from './modules/groups/group.routes.js';
import { campaignRoutes } from './modules/campaigns/campaign.routes.js';
import { smsRoutes } from './modules/sms/sms.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

/**
 * Builds and returns the configured Express application instance.
 * Separating app creation from server startup allows for clean testing.
 */
export function buildApp(ctx: AppContext): Express {
  const app = express();

  // Structured request logging (Pino)
  app.use(pinoHttp({ logger: ctx.log }));

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(express.json({ limit: '2mb' }));

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.send({ ok: true, service: 'Bulk SMS Platform API', version: '1.2.0' });
  });

  // Dependency check: round-trips a query to Postgres and a list call to the
  // object storage bucket. 503 if either is unreachable.
  app.get('/health', async (_req, res) => {
    const check = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return 'ok';
      } catch (err) {
        ctx.log.error({ err }, 'health check failed');
        return 'error';
      }
    };
    const database = await check(() => ctx.prisma.$queryRaw`SELECT 1`);
    const files = ctx.files;
    const storage = files
      ? await check(() => files.s3.send(new ListObjectsV2Command({ Bucket: files.bucket, MaxKeys: 1 })))
      : 'disabled';
    const ok = database === 'ok' && storage !== 'error';
    res.status(ok ? 200 : 503).send({ ok, database, storage });
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/auth', authRoutes(ctx));
  app.use('/admin', adminRoutes(ctx));
  app.use('/members', memberRoutes(ctx));
  app.use('/groups', groupRoutes(ctx));
  app.use('/campaigns', campaignRoutes(ctx));
  app.use('/sms', smsRoutes(ctx));
  app.use('/settings', settingsRoutes(ctx));
  app.use('/reports', reportsRoutes(ctx));

  app.use(notFoundHandler);
  // Error handler MUST be registered last, and MUST take 4 args for Express
  // to recognize it as an error handler.
  app.use(errorHandler);

  return app;
}
