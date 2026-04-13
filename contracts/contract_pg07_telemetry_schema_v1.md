`contract_pg07_telemetry_schema_v1`

Canonical source of truth for Programming Study Persona v1 telemetry events.

## 1. Shared Event Envelope
- `eventName`
- `occurredAt`
- `learnerId`
- `route`

```json
{
  "eventName": "string",
  "occurredAt": "ISO-8601 string",
  "learnerId": "string",
  "route": "string"
}
```

## 2. Event List
- `tc_onboarding_completed`
- `tc_diagnostic_started`
- `tc_diagnostic_task_viewed`
- `tc_diagnostic_answer_submitted`
- `tc_programming_state_viewed`
- `tc_session_started`
- `tc_session_task_viewed`
- `tc_session_answer_submitted`
- `tc_session_help_revealed`
- `tc_session_resumed`
- `tc_session_completed`
- `tc_summary_viewed`

## 3. Event Requirements
- `tc_onboarding_completed`
  - required properties:
    - `priorProgrammingExposure`
    - `currentComfortLevel`
    - `biggestDifficulty`
    - `preferredHelpStyle`
- `tc_diagnostic_started`
  - required properties:
    - `sessionId`
    - `sessionType`
- `tc_diagnostic_task_viewed`
  - required properties:
    - `sessionId`
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `taskType`
    - `currentIndex`
    - `totalItems`
- `tc_diagnostic_answer_submitted`
  - required properties:
    - `sessionId`
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `taskType`
    - `attemptCount`
    - `timeToFirstActionMs`
    - `timeToSubmitMs`
    - `isCorrect`
    - `primaryErrorTag`
- `tc_programming_state_viewed`
  - required properties:
    - `focusConceptId`
    - `sessionMode`
    - `hasActiveDailySession`
- `tc_session_started`
  - required properties:
    - `sessionId`
    - `sessionMode`
    - `focusConceptId`
    - `totalItems`
- `tc_session_task_viewed`
  - required properties:
    - `sessionId`
    - `sessionMode`
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `taskType`
    - `currentIndex`
    - `totalItems`
- `tc_session_answer_submitted`
  - required properties:
    - `sessionId`
    - `sessionMode`
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `taskType`
    - `attemptCount`
    - `timeToFirstActionMs`
    - `timeToSubmitMs`
    - `isCorrect`
    - `primaryErrorTag`
- `tc_session_help_revealed`
  - required properties:
    - `sessionId`
    - `sessionItemId`
    - `taskId`
    - `conceptId`
    - `helpKind`
- `tc_session_resumed`
  - required properties:
    - `sessionId`
    - `resumeSource`
- `tc_session_completed`
  - required properties:
    - `sessionId`
    - `sessionMode`
    - `focusConceptId`
    - `completedTaskCount`
    - `correctCount`
    - `incorrectCount`
- `tc_summary_viewed`
  - required properties:
    - `sessionId`
    - `sessionMode`
    - `focusConceptId`

## 4. Planner / Persona Usage Rules
- Only `*_answer_submitted`, `tc_session_help_revealed`, `tc_session_resumed`, and `tc_session_completed` may update persona or planner inputs in v1.
- View events support flow analysis and hesitation timing only.
- No telemetry event may capture keystroke-by-keystroke data in v1.

