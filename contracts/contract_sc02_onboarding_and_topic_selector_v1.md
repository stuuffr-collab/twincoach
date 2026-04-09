`contract_sc02_onboarding_and_topic_selector_v1`

## 1. Onboarding Request Contract
- `examDate`
- `activeUnitId`

## 2. Onboarding Response Contract
- `onboardingComplete`
- `nextRoute`

## 3. Topic Selector Payload
- `activeUnitId`
- `sequenceOrder`
- `learnerFacingLabel`

## 4. Field Rules
- `examDate` format is `YYYY-MM-DD`
- `activeUnitId` must match an approved active unit id exactly
- `learnerFacingLabel` is the only learner-facing selector label
- No extra Week 1 fields are allowed in the onboarding request, onboarding response, or topic selector payload

## 5. Validation Notes
- Valid exam date rule:
  - must be a valid calendar date in `YYYY-MM-DD` format
- Valid active unit rule:
  - must match one approved `activeUnitId` exactly
- Invalid input response behavior:
  - request must be rejected
  - `onboardingComplete` must not be set to `true`
  - `nextRoute` must not advance the learner past onboarding

## 6. Constraint Notes
- No aliases are allowed for field names
- No alternate field names are allowed in Week 1
- No extra onboarding payload fields are allowed
- No alternate topic selector payload shape is allowed
