import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IdTokenVerifier, isCronRequestAuthorized } from '../src/cron/cron-auth';

const config = { audience: 'https://api.example.run.app', invokerEmail: 'scheduler@proj.iam.gserviceaccount.com' };

/** Accepts only the token "good" for the configured audience, returning the given claims. */
const verifier =
  (claims: { email?: string; email_verified?: boolean }): IdTokenVerifier =>
  async (token, audience) => {
    if (token !== 'good' || audience !== config.audience) throw new Error('invalid token');
    return claims;
  };
const scheduler = verifier({ email: 'Scheduler@proj.iam.gserviceaccount.com', email_verified: true });

describe('Cloud Scheduler request authorization', () => {
  it('accepts a valid token for the scheduler service account', async () => {
    assert.equal(await isCronRequestAuthorized('Bearer good', config, scheduler), true);
  });

  it('rejects missing, malformed or invalid tokens', async () => {
    assert.equal(await isCronRequestAuthorized(undefined, config, scheduler), false);
    assert.equal(await isCronRequestAuthorized('good', config, scheduler), false);
    assert.equal(await isCronRequestAuthorized('Bearer bad', config, scheduler), false);
  });

  it('rejects tokens for any other account, or with an unverified email', async () => {
    assert.equal(await isCronRequestAuthorized('Bearer good', config, verifier({ email: 'someone@gmail.com', email_verified: true })), false);
    assert.equal(await isCronRequestAuthorized('Bearer good', config, verifier({ email: config.invokerEmail, email_verified: false })), false);
  });

  it('rejects everything when not configured', async () => {
    assert.equal(await isCronRequestAuthorized('Bearer good', { audience: '', invokerEmail: '' }, scheduler), false);
  });
});
