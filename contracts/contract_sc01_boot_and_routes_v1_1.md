`contract_sc01_boot_and_routes_v1_1`

## 1. Final Route Names
- `/`
- `/onboarding`
- `/diagnostic`
- `/today`

## 2. Boot Payload Fields
- `learnerId`
- `onboardingComplete`
- `hasActiveDiagnostic`
- `hasCompletedDiagnostic`
- `hasActiveDailySession`
- `nextRoute`

## 3. Allowed `nextRoute` Values
- `/onboarding`
- `/diagnostic`
- `/today`

## 4. Redirect Summary Rules from `/`
- If `onboardingComplete = false` -> `nextRoute = /onboarding`
- If `onboardingComplete = true` and `hasActiveDiagnostic = false` and `hasCompletedDiagnostic = false` -> `nextRoute = /diagnostic`
- If `hasActiveDiagnostic = true` -> `nextRoute = /diagnostic`
- If `hasCompletedDiagnostic = true` and `hasActiveDailySession = false` -> `nextRoute = /today`
- If `hasActiveDailySession = true` -> `nextRoute = /today`

## 5. Constraint Notes
- No aliases are allowed for route names.
- No alternate route variants are allowed in Week 1.
- No extra Week 1 boot payload fields are allowed.
- `/` is routing-only and must not contain business logic.
- `nextRoute` must be one of the approved values only.
