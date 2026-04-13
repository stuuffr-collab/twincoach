`contract_pg09_error_taxonomy_v1`

Canonical source of truth for Programming Study Persona v1 error taxonomy.

## 1. Error Tag Enum
- `syntax_form_error`
- `value_tracking_error`
- `branch_logic_error`
- `loop_control_error`
- `function_usage_error`
- `debugging_strategy_error`

## 2. Concept Mapping
- `syntax_form_error`
  - variables
  - conditionals
  - loops
  - functions
- `value_tracking_error`
  - variables
  - tracing
  - loops
- `branch_logic_error`
  - conditionals
- `loop_control_error`
  - loops
- `function_usage_error`
  - functions
- `debugging_strategy_error`
  - debugging tasks across all concepts

## 3. Planner Effects
- `syntax_form_error`
  - weakens `syntaxStabilityState`
  - biases toward `concept_repair`
- `value_tracking_error`
  - weakens `logicTracingState`
  - biases toward trace-heavy tasks
- `branch_logic_error`
  - raises conditional logic as focus concept priority
- `loop_control_error`
  - raises loops as focus concept priority
- `function_usage_error`
  - raises functions as focus concept priority
- `debugging_strategy_error`
  - weakens `debuggingResilienceState`
  - biases toward `debugging_drill`

## 4. Classification Rules
- If error cause is ambiguous, set `primaryErrorTag = null`.
- Blank answers must not be overclassified in v1.
- One incorrect answer may map to at most one `primaryErrorTag` in v1.

