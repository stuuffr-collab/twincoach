`contract_pg08_session_mode_system_v1`

Canonical source of truth for Programming Study Persona v1 session modes.

## 1. Session Mode Enum
- `steady_practice`
- `concept_repair`
- `debugging_drill`
- `recovery_mode`

## 2. Trigger Priority Order
- `recovery_mode`
  - trigger if `sessionMomentumState = low`
- `debugging_drill`
  - trigger if `debuggingResilienceState = fragile`
  - and learner has at least `2` recent debugging-related misses across last `4` incorrect programming tasks
- `concept_repair`
  - trigger if `focusConceptId` exists
  - and that concept `masteryState = emerging`
- `steady_practice`
  - default fallback mode

## 3. Learner-Facing Explanations
- `steady_practice`
  - `Today's session keeps your Python foundations moving.`
- `concept_repair`
  - `Today's session focuses on one concept that still needs support.`
- `debugging_drill`
  - `Today's session focuses on debugging one step at a time.`
- `recovery_mode`
  - `Today's session is shorter and designed to get you moving again.`

## 4. Task Selection Consequences
- `steady_practice`
  - balanced task mix
  - moderate difficulty
  - one concept confirmation at end
- `concept_repair`
  - focus-concept heavy
  - higher ratio of trace and concept tasks
  - no difficulty escalation
- `debugging_drill`
  - debugging-heavy mix
  - at least two bug-oriented tasks
  - one trace-support task
- `recovery_mode`
  - shorter session
  - easier win-first first task
  - no hardest task placement

## 5. Uncertainty Rules
- Mode rationale text must use:
  - `recent work suggests`
  - `we think`
  - `today's session focuses on`
- Mode rationale text must not use:
  - hidden-trait certainty claims
  - personality labels

