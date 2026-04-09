`contract_sc04_answer_submit_and_feedback_v1`

## 1. Answer Submit Request Contract
- `sessionItemId`
- `answerValue`
- `checkpointToken`

## 2. Answer Submit Response Contract
- `isCorrect`
- `feedbackType`
- `feedbackText`
- `sessionStatus`

## 3. Feedback Contract
- Feedback is represented by:
  - `feedbackType`
  - `feedbackText`
- Approved `feedbackType` values only:
  - `correct`
  - `needs_review`
  - `try_fix`
  - `needs_another_check`
- Week 1 feedback behavior:
  - `correct` = answer accepted as correct
  - `needs_review` = answer accepted as incorrect and learner should review the idea
  - `try_fix` = answer accepted as incorrect and learner should retry mentally using the feedback
  - `needs_another_check` = answer accepted but evidence is not strong enough for a stronger conclusion
- No additional feedback structure is allowed in Week 1.

## 4. Submit Outcome Rules
- Successful submit
  - request is valid
  - session is active
  - learner owns the session
  - `checkpointToken` matches current session checkpoint
  - backend persists one attempt
  - backend returns the approved response contract
- Stale submit
  - `checkpointToken` does not match the current session checkpoint
  - backend rejects the submit
  - backend must not write a new attempt
  - backend must not return feedback
- Duplicate submit
  - request repeats an already-confirmed submit for the same checkpoint
  - backend must not write a new attempt
  - backend must not return a second valid progression result
- Invalid session / invalid ownership
  - session does not exist, is not active, or does not belong to the learner
  - backend rejects the submit
  - backend must not return feedback
- Completed session submit
  - session is already completed
  - backend rejects the submit
  - backend must not return feedback

## 5. Frontend Handling Notes
- Frontend shows feedback only when the backend returns a successful submit response using the approved response contract.
- Frontend stays on the same item until a successful submit response is received.
- If a successful submit response returns `sessionStatus = in_progress`, frontend shows feedback first, then requests the next session state from the backend before rendering the next item.
- If a successful submit response returns `sessionStatus = completed`, frontend shows feedback, then exits the active answer loop.
- If submit is stale, duplicate, invalid, or completed-session submit:
  - frontend must not advance optimistically
  - frontend must not fabricate feedback
  - frontend must request refetch or recovery handling based on current session state

## 6. Constraint Notes
- No extra response variants are allowed in Week 1.
- No future-phase feedback shapes are allowed.
- No hint payloads are allowed.
- No remediation payloads are allowed.
- No follow-up payloads are allowed in Week 1.
- No extra fields outside what is required for the Week 1 answer loop are allowed.
