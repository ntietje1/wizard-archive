# Production release process

Production releases are intentionally manual. A GitHub workflow prepares a tested candidate, and production traffic moves only after the candidate is inspected and promoted in Cloudflare.

The stable candidate URL is `https://candidate.wizardarchive.com`. It runs the same production build against the production Convex backend, so it can read and write production data. Cloudflare Access must protect the entire candidate host and allow only selected test account emails.

## Normal release

1. Run the **Prepare Production Candidate** GitHub workflow.
2. Use `main` unless releasing a specific commit or branch.
3. Add a short release note. It is attached to the uploaded Cloudflare Worker version.
4. Wait for the workflow to finish. It runs checks, builds the production app, deploys the Convex backend, uploads a Cloudflare Worker version without sending production traffic to it, and deploys the same build to the `wizard-archive-candidate` Worker at `https://candidate.wizardarchive.com`.
5. In Cloudflare, open the `wizard-archive` Worker and inspect the uploaded version.
6. Smoke-test `https://candidate.wizardarchive.com` for `/`, `/campaigns`, `/api/auth/get-session`, and Google sign-in with selected test accounts.
7. Promote the candidate version in Cloudflare's Worker Deployments UI.
8. Smoke-test production after promotion:
   - `https://wizardarchive.com/`
   - `https://www.wizardarchive.com/`
   - `https://wizardarchive.com/campaigns`
   - `https://www.wizardarchive.com/campaigns`
   - `https://wizardarchive.com/api/auth/get-session`
   - `https://www.wizardarchive.com/api/auth/get-session`

Do not use `wrangler deploy` for production. `wrangler deploy` sends traffic to the new Worker immediately. Production should use `wrangler versions upload` to create a candidate first.


GitHub Actions:

- The production workflow sets `ADDITIONAL_TRUSTED_ORIGINS=https://candidate.wizardarchive.com` before deploying Convex.
- Keep the existing production secrets in the production environment; the candidate Worker reuses the production Convex and auth configuration.

Google OAuth:

- Add `https://candidate.wizardarchive.com` as an Authorized JavaScript origin.
- Add `https://candidate.wizardarchive.com/api/auth/callback/google` as an Authorized redirect URI.

## Rollback

Use Cloudflare's Worker deployment rollback if the promoted Worker version is bad.

Rollback is safe only when the Convex backend remains backward-compatible with the previous Worker/frontend version. If a backend change removed old function behavior or narrowed the schema too early, rolling back only the Worker can still leave production broken.

## Convex compatibility rules

Convex deploys push schemas automatically. Schema validation checks existing data, so a schema push fails if production documents do not match the new schema. Keep schema validation on and use it as a safety rail.

Functions also need compatibility work. Users can keep an old website bundle open while a new Convex backend is live, so production Convex functions should keep accepting old client arguments and behavior until old clients are no longer expected.

Safe Convex changes include:

- adding new tables;
- adding optional fields before making them required;
- marking fields optional before removing data and later removing the field;
- using a union of old and new field types while data is migrated;
- adding functions or optional function arguments.

For breaking schema or API changes, use widen-migrate-narrow:

1. **Release A: widen.** Deploy schema and functions that support old and new formats. Prefer optional fields, unions, and backward-compatible function arguments.
2. **Migrate.** Backfill production data. Use `@convex-dev/migrations` for non-trivial table migrations because it tracks progress, batches work, and can resume.
3. **Release B: use the new shape.** Promote a frontend/Worker version that reads or writes the new format while the backend still supports old clients.
4. **Release C: narrow.** After old frontend versions are no longer active and migration is verified, remove old compatibility code and narrow the schema.

Sources:

- https://docs.convex.dev/production/
- https://docs.convex.dev/database/schemas
- https://github.com/get-convex/migrations
