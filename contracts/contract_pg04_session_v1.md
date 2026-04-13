`contract_pg04_session_v1`

Canonical source of truth for Programming Study Persona v1 daily-practice session behavior.

## 1. Session Routes
- `POST /session/create-or-resume`
- `GET /session/:sessionId`
- `POST /session/:sessionId/answer`

## 2. Session Payload
- `sessionId`
- `sessionType`
- `status`
- `sessionMode`
- `sessionModeLabel`
- `focusConceptId`
- `focusConceptLabel`
- `currentIndex`
- `totalItems`
- `checkpointToken`
- `currentTask`

```json
{
  "sessionId": "string",
  "sessionType": "daily_practice",
  "status": "generated | in_progress | completed",
  "sessionMode": "steady_practice | concept_repair | debugging_drill | recovery_mode",
  "sessionModeLabel": "string",
  "focusConceptId": "string",
  "focusConceptLabel": "string",
  "currentIndex": 1,
  "totalItems": "3 | 4",
  "checkpointToken": "string",
  "currentTask": {
    "sessionItemId": "string",
    "taskId": "string",
    "conceptId": "string",
    "taskType": "output_prediction | trace_reasoning | bug_spotting | code_completion | concept_choice",
    "prompt": "string",
    "codeSnippet": "string | null",
    "choices": [
      {
        "choiceId": "string",
        "label": "string"
      }
    ],
    "answerFormat": "single_choice | short_text",
    "helperText": "string",
    "helpAvailable": true,
    "helpKind": "step_breakdown | worked_example | debugging_hint | concept_explanation | null",
    "helpLabel": "Need a hint? | null"
  }
}
```

## 3. Session Length Rules
- `recovery_mode` = `3` tasks.
- `steady_practice` = `4` tasks.
- `concept_repair` = `4` tasks.
- `debugging_drill` = `4` tasks.

## 4. Task Sequencing Rules
- First task must match `focusConceptId`.
- No more than one task may come from a non-focus concept.
- Final task must be confirmatory, not hardest-first.
- Only `easy` and `medium` task difficulty are allowed in v1.

## 5. Mode-Specific Task Mix
- `steady_practice`
  - `2` focus-concept tasks
  - `1` adjacent review or trace task
  - `1` confirmatory task
- `concept_repair`
  - `3` focus-concept tasks
  - maximum `1` `bug_spotting` task
- `debugging_drill`
  - at least `2` debugging-oriented tasks
  - at least `1` trace-based task
- `recovery_mode`
  - first task must be easier win-first
  - maximum `1` `code_completion` task

## 6. Help Structure
- At most one help offer may exist per task.
- Help is always learner-invoked in v1.
- Help is optional.
- Help content is a single structured hint only.
- Help is not a freeform chat response.

## 7. Answer Submit Response
- `isCorrect`
- `feedbackType`
- `feedbackText`
- `sessionStatus`
- `helpOffer`

```json
{
  "isCorrect": true,
  "feedbackType": "correct | needs_review | try_fix | needs_another_check",
  "feedbackText": "string",
  "sessionStatus": "generated | in_progress | completed",
  "helpOffer": {
    "helpKind": "step_breakdown | worked_example | debugging_hint | concept_explanation",
    "label": "Show hint",
    "text": "string"
  }
}
```

## 8. Help Offer Rules
- `helpOffer` may appear only after an incorrect response.
- `helpOffer` may be omitted when no hint is configured.
- `helpOffer` must not create a new route or branch in v1.

## 9. Checkpoint Rules
- Submit requires `sessionItemId`.
- Submit requires `checkpointToken`.
- Stale submit must be rejected.
- Duplicate submit must be rejected.
- Frontend must refetch latest session state after stale or duplicate rejection.

## 10. Resume Rules
- Active session must retain the same `sessionId`.
- `GET /session/:sessionId` must always return the latest committed state.
- `/today` must resume an active daily session instead of creating a new one.

## 11. Exclusions
- No code execution is allowed in session v1.
- No multiple hints per task are allowed in session v1.
- No freeform tutoring chat is allowed in session v1.
- No project tasks are allowed in session v1.
- No peer comparison is allowed in session v1.
