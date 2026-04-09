## Week 1 Critical Path Test Matrix

### Boot and Routing
- New learner boot redirects to `/onboarding`
- Onboarding-complete learner with no diagnostic redirects to `/diagnostic`
- Learner with active diagnostic redirects to `/diagnostic`
- Learner with completed diagnostic redirects to `/today`

### Onboarding
- Valid `examDate` + valid `activeUnitId` submits successfully
- Invalid `examDate` blocks submit
- Invalid `activeUnitId` blocks submit
- Save failure keeps learner on `/onboarding`

### Diagnostic Rendering
- Session payload renders first question
- `multiple_choice` renders correctly
- `numeric_input` renders correctly
- `expression_choice` renders correctly
- Progress shows `currentIndex` and `totalItems`

### Answer Submit
- Valid submit persists once and returns feedback
- Stale submit does not advance learner
- Duplicate submit does not create a second attempt
- Invalid session or invalid ownership returns safe failure
- Completed session submit returns safe failure

### Today
- Today summary renders after diagnostic completion
- Start/resume state renders without crash

### Reliability and Recovery
- Refresh on `/diagnostic` resumes the active diagnostic session
- Refresh on `/session/:sessionId` resumes the active daily session
- Returning to `/` during active diagnostic redirects back into the learner slice without dead end
- Returning to `/` during active daily session redirects to `/today` with resume state
- Stale checkpoint submit returns safe failure and does not advance session state
- Duplicate submit returns safe failure and does not create a second attempt
- Save failure keeps learner on the same item with the current answer still visible
- Completed session submit returns safe failure
- Completed daily session summary loads from committed backend state
- Refresh on `/session/:sessionId/summary` reloads the committed summary without dead end

### Alpha Readiness Visibility
- Today shows `Insufficient Evidence` until enough cross-topic evidence exists
- Today shows a readiness explanation and one next step without dead end
- Today does not show a stronger readiness band while high-weight topics remain unseen
- Today lowers to `Needs Review` when due review or weak-topic state is active

### Review Resurfacing
- A due review topic is resurfaced inside the next daily session
- Daily session keeps a deterministic repair/core/review balance when due review exists
- Deactivated question items do not appear in new daily sessions

### Admin and Operator Support
- Learner lookup returns progress state, active session ids, topic states, and recent attempts
- Session preview returns committed session items and slot types
- Bad-item deactivation flips `isActive` to `false`
- Deactivated bad items remain excluded from newly created daily sessions
