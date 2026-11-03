import { S3Client } from '@aws-sdk/client-s3';

/**
 * Bucket declared in neon.ts. Credentials, endpoint and region come from the
 * AWS_* env vars that `neon deploy` / `neon env pull` write into .env - they
 * are branch-scoped, so a dev branch reads/writes its own copy of the files.
 */
export const ASSETS_BUCKET = 'assets';

export interface FileStorage {
  s3: S3Client;
  bucket: string;
}

/**
 * Creates the Neon Object Storage client, or returns undefined when the AWS_*
 * vars aren't set - same "opt-in, no-op until configured" pattern as the SMS
 * gateway, so the API still boots against a database-only environment.
 */
export function createFileStorage(): FileStorage | undefined {
  if (!process.env.AWS_ENDPOINT_URL_S3 || !process.env.AWS_ACCESS_KEY_ID) {
    return undefined;
  }
  // The SDK reads credentials, endpoint and region from the AWS_* env vars;
  // Neon only supports path-style addressing.
  return { s3: new S3Client({ forcePathStyle: true }), bucket: ASSETS_BUCKET };
}
