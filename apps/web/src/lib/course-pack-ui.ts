import type {
  CoursePackActiveContextState,
  CoursePackDocumentParseStatus,
  CoursePackDocumentRole,
  CoursePackDriftStatus,
  CoursePackDocumentValidationStatus,
  CoursePackLifecycleState,
  CoursePackReadinessState,
  CoursePackRecord,
  CoursePackSupportLevel,
} from "@/src/lib/api";

export function formatCoursePackRole(role: CoursePackDocumentRole | null) {
  switch (role) {
    case "syllabus":
      return "خطة المقرر";
    case "lecture_notes":
      return "ملاحظات محاضرات";
    case "slides":
      return "شرائح";
    case "past_exam":
      return "اختبار سابق";
    case "lab_sheet":
      return "ورقة مختبر";
    case "assignment":
      return "واجب أو تكليف";
    case "reference":
      return "مرجع";
    case "other":
      return "ملف آخر";
    case "unknown":
      return "غير واضح بعد";
    default:
      return "غير محدد";
  }
}

export function formatSupportLevel(level: CoursePackSupportLevel | null) {
  switch (level) {
    case "full_coach":
      return "تدريب كامل";
    case "guided_study":
      return "دراسة موجهة";
    case "planning_review":
      return "تخطيط ومراجعة";
    case "not_ready":
      return "غير جاهز للتفعيل";
    default:
      return "لم يُحسم بعد";
  }
}

export function describeSupportLevel(level: CoursePackSupportLevel | null) {
  switch (level) {
    case "full_coach":
      return "TwinCoach يستطيع هنا أن يقود جلسات تدريبية أعمق اعتمادًا على مفاهيم قابلة للربط بمحركه الحالي.";
    case "guided_study":
      return "سنوجّه ترتيب الدراسة والمراجعة بوضوح، لكن من دون ادعاء تقييم عميق لكل جزئية.";
    case "planning_review":
      return "سنستخدم المواد لبناء خطة ومناطق مراجعة واضحة، مع دعم أخف وبدون تدريب تصحيحي عميق.";
    case "not_ready":
      return "المواد الحالية لا تكفي بعد لتفعيل مسار دراسة آمن وواضح.";
    default:
      return "سنوضح مستوى الدعم بعد تحليل المواد.";
  }
}

export function getSupportLevelTone(level: CoursePackSupportLevel | null) {
  switch (level) {
    case "full_coach":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "guided_study":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "planning_review":
      return "border-slate-200 bg-slate-50 text-slate-900";
    case "not_ready":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-[var(--border)] bg-white text-[var(--text)]";
  }
}

export function formatReadinessState(state: CoursePackReadinessState) {
  switch (state) {
    case "awaiting_documents":
      return "ينتظر ملفاتك";
    case "awaiting_roles":
      return "ينتظر مراجعة نوع الملفات";
    case "awaiting_extraction":
      return "جاهز لبناء خريطة المقرر";
    case "review_ready":
      return "جاهز للمراجعة";
    case "activation_ready":
      return "جاهز للتفعيل";
    case "blocked":
      return "متوقف حتى نصحح ملفًا أو دورًا";
  }
}

export function formatLifecycleState(state: CoursePackLifecycleState) {
  switch (state) {
    case "draft":
      return "مسودة";
    case "ingesting":
      return "يجري استقبال الملفات";
    case "classifying":
      return "يجري فهم الملفات";
    case "extracting":
      return "يجري بناء خريطة المقرر";
    case "awaiting_confirmation":
      return "ينتظر تأكيدك";
    case "confirmed":
      return "مؤكد";
    case "active":
      return "نشط الآن";
    case "archived":
      return "مؤرشف";
    case "failed":
      return "توقف بسبب مشكلة";
  }
}

export function formatValidationStatus(
  status: CoursePackDocumentValidationStatus,
) {
  switch (status) {
    case "valid":
      return "صالح";
    case "rejected":
      return "مرفوض";
    default:
      return "قيد الفحص";
  }
}

export function formatParseStatus(status: CoursePackDocumentParseStatus) {
  switch (status) {
    case "parsed":
      return "مقروء بالكامل";
    case "partial":
      return "مقروء جزئيًا";
    case "blocked":
      return "متعذر قراءته";
    case "failed":
      return "فشل التحليل";
    case "parsing":
      return "يجري التحليل";
    default:
      return "قيد التحضير";
  }
}

export function formatCoverageStatus(status: string) {
  switch (status) {
    case "complete":
      return "تغطية قوية";
    case "partial":
      return "تغطية جزئية";
    case "weak":
      return "تغطية ضعيفة";
    default:
      return "غير واضحة بعد";
  }
}

export function formatPriorityTier(priorityTier: string) {
  switch (priorityTier) {
    case "high":
      return "أولوية عالية";
    case "medium":
      return "أولوية متوسطة";
    default:
      return "أولوية منخفضة";
  }
}

export function formatPracticeNeed(practiceNeed: string) {
  switch (practiceNeed) {
    case "high":
      return "يحتاج تدريبًا مكثفًا";
    case "medium":
      return "يحتاج تدريبًا متوسطًا";
    default:
      return "يحتاج مراجعة أخف";
  }
}

export function formatRecurrenceSignal(recurrenceSignal: string) {
  switch (recurrenceSignal) {
    case "strong":
      return "متكرر بوضوح";
    case "moderate":
      return "متكرر بدرجة متوسطة";
    case "weak":
      return "ظهر بشكل محدود";
    default:
      return "لا توجد إشارة كافية";
  }
}

export function formatCoachabilityStatus(status: string) {
  switch (status) {
    case "coachable":
      return "مدعوم للتدريب";
    case "partially_supported":
      return "مدعوم جزئيًا";
    case "unsupported":
      return "غير مدعوم للتدريب العميق";
    default:
      return "غير محسوم";
  }
}

export function formatEvidenceType(evidenceType: string) {
  switch (evidenceType) {
    case "heading":
      return "عنوان";
    case "objective":
      return "هدف تعلم";
    case "assessment_signal":
      return "إشارة تقييم";
    case "example":
      return "مثال";
    default:
      return "مقتطف داعم";
  }
}

export function formatWarningCode(warningCode: string) {
  switch (warningCode) {
    case "low_text_coverage":
      return "بعض الصفحات كانت نصوصها محدودة، لذلك القراءة هنا جزئية.";
    case "role_conflict":
      return "شكل الملف غير واضح بالكامل، لذا نحتاج منك تأكيد نوعه.";
    case "weak_headings":
      return "العناوين داخل الملف ليست واضحة بما يكفي، وقد يؤثر ذلك على ترتيب الخريطة.";
    case "sparse_assessment_signals":
      return "إشارات الامتحان في الملف محدودة، لذلك سنعرض درجة الثقة بصراحة.";
    case "duplicate_content_overlap":
      return "هذا الملف يبدو متداخلًا مع ملف آخر من نفس المادة.";
    default:
      return "وجدنا ملاحظة تستحق المراجعة قبل الاعتماد الكامل على هذا الملف.";
  }
}

export function formatBlockingIssue(blockingIssueCode: string | null) {
  switch (blockingIssueCode) {
    case "encrypted_pdf":
      return "هذا الملف محمي أو مشفر، ولا يمكن قراءته داخل TwinCoach الآن.";
    case "corrupted_pdf":
      return "تعذر فتح الملف بشكل سليم. جرّب رفع نسخة أخرى من نفس المادة.";
    case "page_count_exceeded":
      return "عدد صفحات الملف أكبر من الحد المدعوم في هذه النسخة.";
    case "ocr_required":
      return "هذا الملف يبدو كصور ممسوحة، وليس PDF نصيًّا قابلًا للقراءة في هذه النسخة.";
    case "unsupported_file_type":
      return "الملف ليس PDF مدعومًا.";
    case "parse_failed_no_text":
      return "لم نستطع استخراج نص قابل للاستخدام من هذا الملف.";
    case "duplicate_document":
      return "يبدو أن هذا الملف مكرر داخل نفس المادة.";
    default:
      return "تعذر استخدام هذا الملف داخل مسار المقرر الحالي.";
  }
}

export function formatUnsupportedTopicReason(reasonCode: string) {
  switch (reasonCode) {
    case "non_instructional_content":
      return "هذا الجزء لا يبدو مادة تعليمية مباشرة يمكن أن نبني عليها تدريبًا.";
    case "reference_only":
      return "هذا الموضوع يظهر كمرجع أكثر من كونه محورًا أساسيًا للتدريب.";
    default:
      return "استخرجناه من الملف، لكننا لا نستطيع دعمه الآن كجزء تدريبي عميق.";
  }
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${Math.round(value * 100)}٪`;
}

export function formatTimeShare(value: number) {
  return `${value}%`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDriftStatus(status: CoursePackDriftStatus) {
  switch (status) {
    case "pending_refresh":
      return "تحتاج الحزمة إلى تحديث الخريطة";
    case "review_required":
      return "تحتاج الحزمة إلى مراجعة جديدة";
    default:
      return "الحزمة متوافقة مع آخر مراجعة";
  }
}

export function getDriftTone(status: CoursePackDriftStatus) {
  switch (status) {
    case "pending_refresh":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "review_required":
      return "border-rose-200 bg-rose-50 text-rose-950";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
  }
}

export function formatDriftReasonCode(reasonCode: string) {
  switch (reasonCode) {
    case "documents_added":
      return "أضفت ملفات جديدة إلى هذه الحزمة.";
    case "documents_removed":
      return "أزلت ملفًا من هذه الحزمة.";
    case "documents_replaced":
      return "استبدلت أحد الملفات داخل هذه الحزمة.";
    case "document_roles_changed":
      return "تغيّر فهمنا لنوع بعض الملفات.";
    case "course_graph_changed":
      return "ترتيب الوحدات أو المفاهيم تغيّر بشكل قد يؤثر على المراجعة.";
    case "exam_blueprint_changed":
      return "مناطق التركيز المقترحة للاختبار تغيّرت.";
    case "support_level_changed":
      return "مستوى الدعم المناسب لهذه الحزمة تغيّر.";
    case "activation_refresh_required":
      return "راجعت التحديثات، لكن TwinCoach ما زال يحتاج إلى تحديث السياق النشط.";
    default:
      return "حدث تغيير يستحق المراجعة قبل الاعتماد الكامل على هذه الحزمة.";
  }
}

export function describePackDrift(coursePack: CoursePackRecord) {
  if (coursePack.driftStatus === "pending_refresh") {
    return coursePack.isActive
      ? "حدّثت مواد هذا المقرر، لكن TwinCoach ما زال يعمل على آخر نسخة راجعتها. ابنِ الخريطة من جديد حتى نعرف إن كان التغيير يستحق مراجعة جديدة."
      : "حدّثت مواد هذا المقرر بعد آخر تحليل محفوظ. ابنِ الخريطة من جديد قبل أن تعتمد على الحالة الحالية.";
  }

  if (coursePack.driftStatus === "review_required") {
    return coursePack.isActive
      ? "التحديثات الجديدة غيّرت ما يكفي من هيكل المقرر أو خريطة التركيز، لذلك نحتاج مراجعة جديدة قبل أن نعتبر السياق النشط محدثًا."
      : "التحديثات الجديدة غيّرت ما يكفي من هيكل المقرر أو خريطة التركيز، لذلك نحتاج مراجعة جديدة قبل التفعيل.";
  }

  if (
    coursePack.activeContextState === "stale" ||
    coursePack.requiresReconfirmation
  ) {
    return "لا يزال لديك سياق نشط أقدم من آخر مراجعة محفوظة. حدّث التفعيل عندما تكون جاهزًا.";
  }

  return "الحالة الحالية متوافقة مع آخر ملفات راجعتها وآخر تفعيل صالح لهذه الحزمة.";
}

export function formatActiveContextState(
  activeContextState: CoursePackActiveContextState,
) {
  return activeContextState === "stale"
    ? "السياق النشط يحتاج تحديثًا"
    : "السياق النشط محدث";
}
