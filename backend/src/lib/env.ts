/**
 * Environment variable loading & validation.
 *
 * Runs once at import time (before anything else touches process.env),
 * applies defaults, and throws with a clear message if a required variable
 * is missing - so the app refuses to start rather than fail confusingly later.
 */
import 'dotenv/config';

export interface EnvConfig {
  PORT: string;
  HOST: string;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  // Bulk SMS gateway (Advanta/QuickSMS) - all optional at boot, same "opt-in,
  // no-op until configured" pattern used elsewhere: the rest of the platform
  // (members/groups) works without these, but POST /campaigns will 400 until
  // every one of these is set. See modules/sms/sms.config.ts.
  ADVANTA_SMS_URL?: string;
  ADVANTA_API_KEY?: string;
  ADVANTA_PARTNER_ID?: string;
  ADVANTA_SHORTCODE?: string;
}

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

function loadEnv(): EnvConfig {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters long');
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of development|production|test, got "${nodeEnv}"`);
  }

  return {
    PORT: process.env.PORT ?? '3000',
    HOST: process.env.HOST ?? '0.0.0.0',
    NODE_ENV: nodeEnv as EnvConfig['NODE_ENV'],
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
    ADVANTA_SMS_URL: process.env.ADVANTA_SMS_URL?.trim() || undefined,
    ADVANTA_API_KEY: process.env.ADVANTA_API_KEY?.trim() || undefined,
    ADVANTA_PARTNER_ID: process.env.ADVANTA_PARTNER_ID?.trim() || undefined,
    ADVANTA_SHORTCODE: process.env.ADVANTA_SHORTCODE?.trim() || undefined,
  };
}

export const env: EnvConfig = loadEnv();
