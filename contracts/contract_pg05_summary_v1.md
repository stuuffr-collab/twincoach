`contract_pg05_summary_v1`

Canonical source of truth for Programming Study Persona v1 session summary behavior.

## 1. Route Contract
- `GET /session/:sessionId/summary`

## 2. Response Payload
- `sessionId`
- `sessionMode`
- `focusConceptId`
- `focusConceptLabel`
- `completedTaskCount`
- `correctCount`
- `incorrectCount`
- `whatImproved`
- `whatNeedsSupport`
- `studyPatternObserved`
- `nextBestAction`

```json
{
  "sessionId": "string",
  "sessionMode": "steady_practice | concept_repair | debugging_drill | recovery_mode",
  "focusConceptId": "string",
  "focusConceptLabel": "string",
  "completedTaskCount": 4,
  "correctCount": 3,
  "incorrectCount": 1,
  "whatImproved": {
    "code": "concept_strengthened | debugging_recovery | steady_completion",
    "label": "string",
    "text": "string"
  },
  "whatNeedsSupport": {
    "code": "concept_still_needs_support | syntax_still_fragile | debugging_still_needs_structure",
    "conceptId": "string",
    "label": "string",
    "text": "string"
  },
  "studyPatternObserved": {
    "code": "recovered_after_mistake | steady_throughout | hesitated_but_completed | needed_hint_to_progress",
    "label": "string",
    "text": "string"
  },
  "nextBestAction": {
    "route": "/today",
    "label": "Back to Your Programming State",
    "text": "string"
  }
}
```

## 3. Summary Meaning Rules
- `whatImproved`
  - must identify one strongest positive learning change from this session
  - must be grounded in observed session evidence
- `whatNeedsSupport`
  - must identify one concept or study issue that remains the next planning priority
- `studyPatternObserved`
  - must identify one safe learner-behavior observation only
- `nextBestAction`
  - must always direct back to `/today`

## 4. Constraint Notes
- Summary must not expose raw telemetry in v1.
- Summary must not expose hidden persona scores in v1.
- Summary must not create a secondary branching decision tree in v1.

