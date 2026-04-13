`contract_pg01_onboarding_v1`

Canonical source of truth for Programming Study Persona v1 onboarding.

## 1. Route Contract
- `POST /onboarding/complete`

## 2. Request Payload
- `priorProgrammingExposure`
- `currentComfortLevel`
- `biggestDifficulty`
- `preferredHelpStyle`

```json
{
  "priorProgrammingExposure": "none | school_basics | self_taught_basics | completed_intro_course",
  "currentComfortLevel": "very_low | low | medium",
  "biggestDifficulty": "reading_code | writing_syntax | tracing_logic | debugging_errors",
  "preferredHelpStyle": "step_breakdown | worked_example | debugging_hint | concept_explanation"
}
```

## 3. Required Fields
- All request fields are required.
- No optional onboarding fields are allowed in v1.

## 4. Response Payload
- `learnerId`
- `onboardingComplete`
- `nextRoute`

```json
{
  "learnerId": "string",
  "onboardingComplete": true,
  "nextRoute": "/diagnostic"
}
```

## 5. Learner Profile Storage
- `learnerId`
- `onboardingComplete`
- `priorProgrammingExposure`
- `currentComfortLevel`
- `biggestDifficulty`
- `preferredHelpStyle`
- `onboardingCompletedAt`

## 6. Constraint Notes
- No extra onboarding request fields are allowed in v1.
- No aliases are allowed for onboarding field names.
- No course selector is allowed in v1.
- No language selector is allowed in v1.
- No exam date is collected in v1.
- No open-text learner biography field is allowed in v1.

