`contract_pg02_diagnostic_v1`

Canonical source of truth for Programming Study Persona v1 diagnostic behavior and payloads.

## 1. Diagnostic Routes
- `POST /diagnostic/create-or-resume`
- `GET /session/:sessionId`
- `POST /session/:sessionId/answer`

## 2. Allowed Diagnostic Task Types
- `output_prediction`
- `trace_reasoning`
- `bug_spotting`
- `code_completion`
- `concept_choice`

## 3. Diagnostic Session Payload
- `sessionId`
- `sessionType`
- `status`
- `currentIndex`
- `totalItems`
- `checkpointToken`
- `currentTask`

```json
{
  "sessionId": "string",
  "sessionType": "diagnostic",
  "status": "generated | in_progress | completed",
  "currentIndex": 1,
  "totalItems": 6,
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
    "helperText": "string"
  }
}
```

## 4. Answer Submit Request
- `sessionItemId`
- `answerValue`
- `checkpointToken`

```json
{
  "sessionItemId": "string",
  "answerValue": "string",
  "checkpointToken": "string"
}
```

## 5. Answer Rules By Task Type
- `output_prediction`
  - `answerValue` must match one `choiceId`
- `trace_reasoning`
  - `answerValue` must match one `choiceId`
- `bug_spotting`
  - `answerValue` must match one `choiceId`
- `concept_choice`
  - `answerValue` must match one `choiceId`
- `code_completion`
  - `answerValue` is short text
  - backend normalizes by trim and internal whitespace collapse

## 6. Feedback Response
- `isCorrect`
- `feedbackType`
- `feedbackText`
- `sessionStatus`

```json
{
  "isCorrect": true,
  "feedbackType": "correct | needs_review | try_fix | needs_another_check",
  "feedbackText": "string",
  "sessionStatus": "generated | in_progress | completed"
}
```

## 7. Progression Rules
- Diagnostic always contains `6` tasks.
- Diagnostic contains `1` task per concept in v1.
- Diagnostic never branches in v1.
- Diagnostic always renders one task at a time.
- Frontend may continue only after backend-confirmed feedback state.

## 8. Error-Tag Mapping Rules
- Each diagnostic task declares `supportedErrorTags`.
- Backend may assign at most one `primaryErrorTag` for an incorrect answer.
- If the incorrect answer is ambiguous, backend must assign `primaryErrorTag = null`.
- Raw error tags are not shown to learners in diagnostic UI.

## 9. Exclusions
- No freeform coding is allowed in diagnostic v1.
- No code execution is allowed in diagnostic v1.
- No multi-step hint chains are allowed in diagnostic v1.
- No long-form explanation answers are allowed in diagnostic v1.
- No multi-file tasks are allowed in diagnostic v1.

