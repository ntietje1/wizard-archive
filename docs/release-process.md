# Production release process

Production releases are manual. The GitHub workflow prepares a candidate, and Cloudflare promotion moves production traffic only after the candidate is checked.

## Normal release

1. Run the **Prepare Production Candidate** GitHub workflow.
2. Use `main` unless releasing a specific commit or branch.
3. Add a short release note.
4. Wait for the workflow to finish.
5. Smoke-test the candidate at `https://candidate.wizardarchive.com`:
   - `/`
   - `/campaigns`
   - `/api/auth/get-session`
   - Google sign-in with a selected test account
6. In Cloudflare, open the `wizard-archive` Worker and promote the uploaded candidate version.
7. Smoke-test production:
   - `https://wizardarchive.com/`
   - `https://www.wizardarchive.com/`
   - `https://wizardarchive.com/campaigns`
   - `https://www.wizardarchive.com/campaigns`
   - `https://wizardarchive.com/api/auth/get-session`
   - `https://www.wizardarchive.com/api/auth/get-session`

Do not use `wrangler deploy` for production. Production traffic should move only through Cloudflare Worker version promotion.

## Rollback

Use Cloudflare's Worker deployment rollback if the promoted version is bad.

Rollback is safe only when the Convex backend is still compatible with the previous frontend. If the release included a breaking Convex schema or API change, fix forward unless the previous Worker can still run against the current backend.

## Convex changes

For normal backward-compatible Convex changes, release through the standard candidate flow.

For breaking schema or API changes, split the work across releases:

1. **Widen:** deploy backend support for both old and new shapes.
2. **Migrate:** backfill production data. Use `@convex-dev/migrations` for non-trivial table migrations because it tracks progress, batches work, and can resume.
3. **Use:** promote the frontend that reads or writes the new shape.
4. **Narrow:** remove old compatibility only after old frontend versions are no longer active.
