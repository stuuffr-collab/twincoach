`contract_sc03_session_and_question_payload_v1`

## 1. Session Payload Contract
- `sessionId`
- `status`
- `currentIndex`
- `totalItems`
- `checkpointToken`
- `currentItem`

## 2. Current Item Payload Contract
- `questionItemId`
- `topicId`
- `questionType`
- `stem`
- `choices`
- `inputMode`

## 3. Progress Fields
- Current item position: `currentIndex`
- Total items: `totalItems`
- Session status: `status`
- Checkpoint token: `checkpointToken`

## 4. Question Rendering Rules
- Frontend must rely only on:
  - `questionType`
  - `stem`
  - `choices`
  - `inputMode`
  - `currentIndex`
  - `totalItems`
  - `status`
  - `checkpointToken`
- Frontend must ignore any field not defined in this contract.
- Week 1 rendering supports only:
  - `multiple_choice`
  - `numeric_input`
  - `expression_choice`
- Out of scope for Week 1:
  - additional question types
  - hint payloads
  - remediation payloads
  - follow-up payloads
  - explanation payloads
  - media payloads
  - formatting extension fields

## 5. Constraint Notes
- No extra payload fields are allowed in the Week 1 session payload.
- No extra payload fields are allowed in the Week 1 current item payload.
- No alternate payload variants are allowed.
- No free-form extensions are allowed.
- No future-phase fields are allowed.
