`contract_pg11_admin_operator_visibility_v1`

Canonical source of truth for Programming Study Persona v1 admin/operator visibility.

## 1. Recent Learners View
- Required fields:
  - `learnerId`
  - `focusConceptLabel`
  - `sessionMode`
  - `sessionMomentumState`
  - `lastActivityAt`

## 2. Learner Detail View
- Onboarding profile:
  - `priorProgrammingExposure`
  - `currentComfortLevel`
  - `biggestDifficulty`
  - `preferredHelpStyle`
- Persona snapshot:
  - `focusConceptId`
  - `syntaxStabilityState`
  - `logicTracingState`
  - `debuggingResilienceState`
  - `sessionMomentumState`
  - concept mastery list
- Active session pointers:
  - `activeDiagnosticSessionId`
  - `activeDailySessionId`
- Recent error tags:
  - last `5` non-null `primaryErrorTag` values
  - with timestamps
- Latest summary snapshot:
  - `whatImproved.code`
  - `whatNeedsSupport.code`
  - `studyPatternObserved.code`

## 3. Session Preview View
- Required fields:
  - `sessionId`
  - `sessionMode`
  - `focusConceptId`
  - `currentIndex`
  - `totalItems`
  - ordered task list:
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `taskType`
    - `isActive`

## 4. Operator Constraints
- No raw telemetry dashboard is allowed in v1.
- No persona charts are allowed in v1.
- No confidence graphs are allowed in v1.
- No instructor reporting is allowed in v1.
