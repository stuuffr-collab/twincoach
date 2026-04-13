`contract_pg03_programming_state_v1`

Canonical source of truth for Programming Study Persona v1 programming-state behavior on `/today`.

## 1. Route Contract
- `GET /today`

## 2. Screen Contract
- Learner-facing screen meaning is `Your Programming State`.

## 3. Response Payload
- `screenTitle`
- `programmingStateCode`
- `programmingStateLabel`
- `focusConceptId`
- `focusConceptLabel`
- `sessionMode`
- `sessionModeLabel`
- `rationaleCode`
- `rationaleText`
- `nextStepText`
- `primaryActionLabel`
- `hasActiveDailySession`
- `activeSessionId`

```json
{
  "screenTitle": "Your Programming State",
  "programmingStateCode": "building_foundations | debugging_focus | steady_progress | recovery_needed",
  "programmingStateLabel": "string",
  "focusConceptId": "string",
  "focusConceptLabel": "string",
  "sessionMode": "steady_practice | concept_repair | debugging_drill | recovery_mode",
  "sessionModeLabel": "string",
  "rationaleCode": "recent_concept_errors | repeated_debugging_errors | strong_recent_progress | recent_dropoff",
  "rationaleText": "string",
  "nextStepText": "string",
  "primaryActionLabel": "Start today's session | Resume today's session",
  "hasActiveDailySession": true,
  "activeSessionId": "string | null"
}
```

## 4. Learner-Facing Language Rules
- `programmingStateLabel` must be plain-language and conservative.
- `sessionModeLabel` must be plain-language and conservative.
- `rationaleText` must use safe inference language.
- `nextStepText` must explain one clear next step only.
- Allowed phrasing:
  - `recent work suggests`
  - `we think`
  - `today's session focuses on`
- Disallowed phrasing:
  - clinical labels
  - hidden personality claims
  - certainty claims about internal traits

## 5. Constraint Notes
- `activeSessionId` may be `null` only when `hasActiveDailySession = false`.
- `/today` must expose one primary learner action only.
- `/today` must not expose raw persona scores in v1.
- `/today` must not expose charts, graphs, or dashboards in v1.

