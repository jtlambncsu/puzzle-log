# Lessons learned

Real problems hit while building this, how they were found, and the fix. Each one is a good
"tell me about a bug you debugged" story.

## GitHub OIDC subject format changed

**Symptom:** the first deploy failed with
`Not authorized to perform sts:AssumeRoleWithWebIdentity`.

**Cause:** GitHub changed the OIDC token's `sub` claim for repositories created after
July 15, 2026 to include immutable numeric IDs: `repo:owner@123/name@456:ref:refs/heads/main`.
The IAM trust policy expected the older `repo:owner/name:ref:refs/heads/main`, so it never
matched.

**Fix:** the role trusts both formats (`infra/lib/github-deploy-stack.ts`).

**Takeaway:** when federated auth fails, compare the _actual_ token claims with the trust
policy's conditions. The IDs exist so a deleted-and-recreated repo with the same name can't
inherit your cloud access.

## CORS preflights blocked by the authorizer

**Symptom:** found by testing the live API after adding login, before anyone hit it: an
`OPTIONS` request from the Vercel origin returned **401**.

**Cause:** browsers send a CORS preflight (`OPTIONS`, no credentials) before cross-origin
requests with an `Authorization` header. With a catch-all `$default` route, API Gateway routed
preflights to the JWT authorizer, which rejected them. Browsers require a 2xx preflight, so
every real request would have been blocked.

**Fix:** an unauthenticated `OPTIONS /{proxy+}` route (`infra/lib/api-stack.ts`).

**Takeaway:** preflights never carry credentials, so any auth layer in front of a
cross-origin API must let them through. Test with `curl -X OPTIONS -H 'Origin: …'`.

## An unset GitHub variable is an empty string

**Symptom:** Cognito's login page showed "An error was encountered with the requested page."

**Cause:** the deployed app client only allowed `http://localhost:5173` as a redirect URL. The
workflow passes `WEB_URLS: ${{ vars.WEB_URLS }}`; when the variable doesn't exist, GitHub
substitutes `''`. The code fell back to the default with `??`, which only catches
`null`/`undefined`, so the empty string won and produced an empty list.

**Fix:** a `listSetting()` helper that treats blank as missing, with tests
(`infra/lib/config.ts`).

**Takeaway:** environment variables are strings; "unset" often arrives as `''`. Know the
difference between `??` and `||`, and inspect the _deployed_ configuration
(`aws cognito-idp describe-user-pool-client`) rather than trusting the code.

## Renamed library options can fail silently

**Symptom:** none. Found while fixing a type error during an upgrade.

**Cause:** MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`. The old option was
ignored at runtime, so tests that made unexpected requests wouldn't have failed.

**Takeaway:** typecheck test code too, and read changelogs for major-version upgrades.
