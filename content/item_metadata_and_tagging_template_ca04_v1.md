## Item Metadata and Tagging Template

### Required Fields
- `questionItemId`
- `topicId`
- `role`
- `questionType`
- `stem`
- `choices`
- `inputMode`
- `correctAnswer`
- `difficulty`
- `estimatedTimeSec`
- `supportedFeedbackType`
- `supportedErrorTags`

### Approved Week 1 `role` Values
- `diagnostic_probe`

### Approved Week 1 `questionType` Values
- `multiple_choice`
- `numeric_input`
- `expression_choice`

### Approved Week 1 `supportedFeedbackType` Values
- `correct`
- `needs_review`
- `try_fix`
- `needs_another_check`

### Approved Week 1 `supportedErrorTags` Values
- `conceptual_misunderstanding`
- `procedural_error`
- `careless_mistake`
- `weak_prerequisite_knowledge`

### Tagging Rules
- An item may include only error tags that its response pattern can genuinely support.
- If an item cannot separate likely causes, omit stronger tags and keep the set narrow.
- No item may claim support for every error tag by default.
- `weak_prerequisite_knowledge` is valid only when the item clearly depends on an earlier skill.
- `careless_mistake` must be used sparingly and only where the distractor or answer pattern supports it.

### Week 1 Usage Rule
- All seed items in `seed_ready_content_fixture_pack_ca05_v1.json` must match this template exactly.
