import { createServer } from 'node:http';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { createSocketServer } from './lib/socket.js';
import { createFileStorage } from './lib/storage.js';
import { buildApp } from './app.js';
import { AppContext } from './context.js';
import { AuditLogService } from './modules/audit/audit-log.service.js';
import { SmsGatewayService } from './modules/settings/sms-gateway.service.js';

async function start(): Promise<void> {
  // ── Database ───────────────────────────────────────────────────────────────
  const prisma = createPrismaClient();
  await prisma.$connect();
  logger.info('✅ Prisma connected to the database');

  const httpServer = createServer();
  const io = createSocketServer(httpServer);

  const auditLog = new AuditLogService(prisma, logger);
  const smsGateways = new SmsGatewayService({ prisma, config: env, log: logger, auditLog });
  const files = createFileStorage();
  if (!files) logger.warn('Object storage not configured (AWS_* vars missing) - file storage disabled');
  const ctx: AppContext = { prisma, io, log: logger, config: env, auditLog, smsGateways, files };

  // One-time upgrade path: if Settings has never been touched and the old
  // .env-based Advanta vars are set, seed + activate a gateway row from them.
  await smsGateways.ensureSeedFromEnv();

  // ── Express app ────────────────────────────────────────────────────────────
  const app = buildApp(ctx);
  httpServer.on('request', app);

  httpServer.listen(parseInt(env.PORT, 10), env.HOST, () => {
    logger.info(`🚀 Bulk SMS Platform API listening on http://${env.HOST}:${env.PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received - shutting down`);
    io.close();
    httpServer.close();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error(err);
  process.exit(1);
});
