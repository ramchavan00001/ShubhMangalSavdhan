import { OAuth2Client } from 'google-auth-library';

export interface CronAuthConfig {
  /** Audience the OIDC token must be issued for (the API's public URL). */
  audience: string;
  /** Service account that Cloud Scheduler signs tokens as. */
  invokerEmail: string;
}

/** Verifies a Google-signed ID token and returns its claims. */
export type IdTokenVerifier = (token: string, audience: string) => Promise<{ email?: string; email_verified?: boolean } | undefined>;

const client = new OAuth2Client();
export const googleVerifier: IdTokenVerifier = async (token, audience) => {
  const ticket = await client.verifyIdToken({ idToken: token, audience });
  return ticket.getPayload();
};

/**
 * True only for a request carrying a valid Google OIDC token (Authorization: Bearer …)
 * issued for our audience to the configured Cloud Scheduler service account.
 */
export async function isCronRequestAuthorized(
  authorization: string | undefined,
  config: CronAuthConfig,
  verify: IdTokenVerifier = googleVerifier,
): Promise<boolean> {
  if (!config.audience || !config.invokerEmail) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
  if (!match) return false;
  try {
    const claims = await verify(match[1], config.audience);
    return !!claims && claims.email_verified === true && claims.email?.toLowerCase() === config.invokerEmail.toLowerCase();
  } catch {
    return false;
  }
}
