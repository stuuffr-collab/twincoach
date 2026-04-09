# Railway Hosted Smoke Checklist

## Preconditions
- Railway PostgreSQL exists and its connection string is set as API `DATABASE_URL`
- `alpha-api` uses custom config path `/railway/api/railway.json`
- `alpha-web` uses custom config path `/railway/web/railway.json`
- API and web services both use repo root `/`
- API and web both have the same `ALPHA_OPERATOR_KEY`
- Web `NEXT_PUBLIC_API_BASE_URL` points at the live Railway API domain
- API `CORS_ALLOWED_ORIGINS` contains the live Railway web domain

## Commands
- `$env:API_BASE_URL="https://<api-domain>"; pnpm smoke:hosted:learner-slice`
- `$env:API_BASE_URL="https://<api-domain>"; $env:ALPHA_OPERATOR_KEY="<operator-key>"; pnpm smoke:hosted:alpha-readiness`

## Manual Smoke
- Open web `/`
- Complete onboarding with a valid exam date and active unit
- Complete diagnostic
- Confirm `/today` renders `Insufficient Evidence`
- Start daily session
- Complete daily session
- Confirm summary loads
- Open `/admin`
- Enter operator key
- Open learner lookup
- Open active session preview
- Deactivate one item
- Confirm a new daily session excludes the deactivated item

## Expected Results
- No dead ends in learner flow
- No admin access without the operator key
- Review slot maps to a due-review topic
- Logs are visible for onboarding, session start, answer submit, and deactivation
