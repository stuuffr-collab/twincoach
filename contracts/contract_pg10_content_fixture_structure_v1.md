`contract_pg10_content_fixture_structure_v1`

Canonical source of truth for Programming Study Persona v1 content fixture pack structure.

## 1. Minimum Initial Pack Size
- `6` concept records
- `6` diagnostic task records
- `24` practice task records
- `4` hint template records
- `4` feedback template records
- `4` summary template records

## 2. Concept Record
```json
{
  "conceptId": "py_c01_variables",
  "sequenceOrder": 1,
  "learnerLabel": "Variables and expressions",
  "description": "string",
  "isActive": true
}
```

## 3. Diagnostic Task Record
```json
{
  "taskId": "py_diag_01",
  "conceptId": "py_c01_variables",
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
  "correctAnswer": "string",
  "supportedErrorTags": [
    "syntax_form_error",
    "value_tracking_error"
  ],
  "estimatedTimeSec": 45,
  "difficulty": "easy | medium",
  "isActive": true
}
```

## 4. Practice Task Record
```json
{
  "taskId": "py_practice_01",
  "conceptId": "py_c01_variables",
  "taskType": "output_prediction | trace_reasoning | bug_spotting | code_completion | concept_choice",
  "modeTags": [
    "steady_practice",
    "concept_repair"
  ],
  "prompt": "string",
  "codeSnippet": "string | null",
  "choices": [
    {
      "choiceId": "string",
      "label": "string"
    }
  ],
  "answerFormat": "single_choice | short_text",
  "correctAnswer": "string",
  "supportedErrorTags": [
    "syntax_form_error",
    "value_tracking_error"
  ],
  "hintTemplateId": "string | null",
  "feedbackTemplateId": "string",
  "estimatedTimeSec": 60,
  "difficulty": "easy | medium",
  "isActive": true
}
```

## 5. Hint Template Record
```json
{
  "hintTemplateId": "hint_debugging_hint_01",
  "helpKind": "step_breakdown | worked_example | debugging_hint | concept_explanation",
  "label": "Show hint",
  "templateText": "string",
  "allowedTaskTypes": [
    "output_prediction",
    "trace_reasoning"
  ],
  "allowedModes": [
    "steady_practice",
    "concept_repair"
  ]
}
```

## 6. Feedback Template Record
```json
{
  "feedbackTemplateId": "feedback_try_fix_01",
  "feedbackType": "correct | needs_review | try_fix | needs_another_check",
  "templateText": "string",
  "allowedTaskTypes": [
    "output_prediction",
    "trace_reasoning"
  ]
}
```

## 7. Summary Template Record
```json
{
  "summaryTemplateId": "summary_recovered_after_mistake_01",
  "summaryField": "whatImproved | whatNeedsSupport | studyPatternObserved | nextBestAction",
  "triggerCode": "string",
  "templateText": "string"
}
```

## 8. Constraint Notes
- Only Python CS1 content is allowed in this pack.
- Only approved v1 task types are allowed.
- Only approved v1 error tags are allowed.
- No execution-based content records are allowed in v1.
