const CANONICAL_TO_ENGINE_CONCEPT_ID: Record<string, string> = {
  "programming_v1:variables": "py_c01_variables",
  "programming_v1:conditionals": "py_c02_conditionals",
  "programming_v1:loops": "py_c03_loops",
  "programming_v1:functions": "py_c04_functions",
  "programming_v1:tracing": "py_c05_tracing_state",
  "programming_v1:debugging": "py_c06_basic_debugging",
};

export function getEngineConceptIdForCanonicalTemplate(
  canonicalTemplateId: string | null | undefined,
) {
  if (!canonicalTemplateId) {
    return null;
  }

  return CANONICAL_TO_ENGINE_CONCEPT_ID[canonicalTemplateId] ?? null;
}
