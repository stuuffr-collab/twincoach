`contract_pg06_persona_schema_v1`

Canonical source of truth for Programming Study Persona v1 learner model.

## 1. Persona Root Object
- `learnerId`
- `modelVersion`
- `preferredHelpStyle`
- `sessionMomentumState`
- `syntaxStabilityState`
- `logicTracingState`
- `debuggingResilienceState`
- `focusConceptId`
- `conceptStates`

```json
{
  "learnerId": "string",
  "modelVersion": "programming_persona_v1",
  "preferredHelpStyle": "step_breakdown | worked_example | debugging_hint | concept_explanation",
  "sessionMomentumState": "unknown | low | steady | strong",
  "syntaxStabilityState": "unknown | fragile | developing | steady",
  "logicTracingState": "unknown | fragile | developing | steady",
  "debuggingResilienceState": "unknown | fragile | recovering | steady",
  "focusConceptId": "string | null",
  "conceptStates": [
    {
      "conceptId": "string",
      "masteryState": "unknown | emerging | steady",
      "recentErrorTag": "syntax_form_error | value_tracking_error | branch_logic_error | loop_control_error | function_usage_error | debugging_strategy_error | null",
      "lastObservedAt": "ISO-8601 string | null"
    }
  ]
}
```

## 2. Update Rules
- `preferredHelpStyle`
  - initialized from onboarding
  - may be refined only by repeated hint-success patterns in v1
- `sessionMomentumState`
  - updated from resume, drop, completion, and hesitation signals
- `syntaxStabilityState`
  - updated from syntax-tagged incorrect responses
- `logicTracingState`
  - updated from trace and output-prediction performance
- `debuggingResilienceState`
  - updated from incorrect-response recovery behavior and debugging-task outcomes
- `focusConceptId`
  - updated to the highest planner-priority concept after diagnostic or session completion
- `conceptStates[*].masteryState`
  - updated from concept-correctness and confirmatory wins

## 3. Learner-Facing Text Rules
- Allowed learner-facing text:
  - `Loops still need a steadier pass.`
  - `Recent work suggests debugging practice will help most today.`
  - `You recovered well after mistakes in this session.`
- Disallowed learner-facing text:
  - `You are a low-confidence learner.`
  - `You avoid difficulty.`
  - `You have poor resilience.`

## 4. Constraint Notes
- Persona is a study model, not a clinical or psychological diagnosis.
- No hidden score must be shown to learners in v1.
- No extra persona dimensions are allowed in v1 beyond this contract.

