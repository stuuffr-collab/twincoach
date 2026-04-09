# Railway Closed Alpha Ops Handoff

## Railway Services
- `alpha-postgres`
- `alpha-api`
- `alpha-web`

## Service Config Paths
- API config as code path: `/railway/api/railway.json`
- Web config as code path: `/railway/web/railway.json`
- Source repository root for both services: `/`
- Railway custom config file path must be set explicitly for each service because the config files are not at repo root

## API Service
- Repo root: `/`
- Build command comes from `/railway/api/railway.json`
- Start command comes from `/railway/api/railway.json`
- Required variables:
  - `DATABASE_URL`
  - `CORS_ALLOWED_ORIGINS`
  - `ALPHA_OPERATOR_KEY`
  - `PORT`

## Web Service
- Repo root: `/`
- Build command comes from `/railway/web/railway.json`
- Start command comes from `/railway/web/railway.json`
- Required variables:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `ALPHA_OPERATOR_KEY`

## First Deploy Order
1. Create Railway PostgreSQL service.
2. Create the `alpha-api` service from the repo and set custom config file path to `/railway/api/railway.json`.
3. Create the `alpha-web` service from the repo and set custom config file path to `/railway/web/railway.json`.
4. Copy the Railway PostgreSQL connection string into API `DATABASE_URL`.
5. Set API `CORS_ALLOWED_ORIGINS` to the generated Railway web domain.
6. Set the same `ALPHA_OPERATOR_KEY` on API and web.
7. Deploy API.
8. Let `pnpm migrate:deploy:api` run through the API deployment pre-deploy step.
9. Run `pnpm seed:api:week1` one time against the API service shell.
10. Deploy web with `NEXT_PUBLIC_API_BASE_URL` set to the public API domain.
11. Run hosted smoke commands from an ops machine.

## Hosted Smoke Commands
- Learner slice:
  - `$env:API_BASE_URL="https://<api-domain>"; pnpm smoke:hosted:learner-slice`
- Alpha readiness:
  - `$env:API_BASE_URL="https://<api-domain>"; $env:ALPHA_OPERATOR_KEY="<operator-key>"; pnpm smoke:hosted:alpha-readiness`

## Must-Pass Manual Checks
- API `/health` returns `200`
- Web `/` loads and routes into onboarding
- `/admin` accepts operator key
- `/admin/learners` loads recent learners
- `/admin/preview` loads an active session
- `/admin/review` deactivates a bad item

## Rollback Trigger
- Hosted smoke fails on learner core flow
- Hosted smoke fails on admin gate
- Migration succeeds but seed fails
- API cannot answer `/health`
- Web cannot reach API because of CORS or bad `NEXT_PUBLIC_API_BASE_URL`
