"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InlineReveal } from "@/src/components/inline-reveal";
import { PackProgressMemoryCard } from "@/src/components/pack-progress-memory-card";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  activateCoursePack,
  ApiError,
  clearRecentCoursePackId,
  confirmCoursePackDocumentRole,
  createCoursePackConfirmation,
  ensureLearnerIdentity,
  fetchCoursePack,
  fetchLatestCoursePackConfirmation,
  fetchLatestCoursePackExtraction,
  fetchTodaySummary,
  removeCoursePackDocument,
  replaceCoursePackDocument,
  setRecentCoursePackId,
  type CoursePackConceptCandidate,
  type CoursePackConfirmation,
  type CoursePackConfirmationPayload,
  type CoursePackDocumentRole,
  type CoursePackExtraction,
  type PackProgressMemory,
  type CoursePackRecord,
  type CoursePackUnitCandidate,
  runCoursePackExtraction,
  uploadCoursePackDocument,
} from "@/src/lib/api";
import {
  buildCoursePackRereviewQueue,
  buildCoursePackReviewDiff,
} from "@/src/lib/course-pack-diff";
import {
  describeSupportLevel,
  describePackDrift,
  formatActiveContextState,
  formatBlockingIssue,
  formatCoachabilityStatus,
  formatDriftReasonCode,
  formatDriftStatus,
  formatCoursePackRole,
  formatCoverageStatus,
  formatEvidenceType,
  formatFileSize,
  formatLifecycleState,
  formatParseStatus,
  formatPercent,
  formatPracticeNeed,
  formatPriorityTier,
  formatReadinessState,
  formatRecurrenceSignal,
  formatSupportLevel,
  formatTimeShare,
  formatUnsupportedTopicReason,
  formatValidationStatus,
  formatWarningCode,
  getDriftTone,
  getSupportLevelTone,
} from "@/src/lib/course-pack-ui";

type CoursePackWorkspaceProps = {
  coursePackId: string;
};

type UploadEntry = {
  name: string;
  progress: number;
  status: "uploading" | "success" | "error";
  message: string;
};

type ActivePackMemoryState = {
  courseTitle: string;
  currentFocusLabel: string;
  memory: PackProgressMemory;
};

type ReviewState = {
  confirmedUnitCandidateIds: string[];
  confirmedConceptCandidateIds: string[];
  unitLabels: Record<string, string>;
  conceptLabels: Record<string, string>;
  removedItemIds: string[];
  irrelevantItemIds: string[];
  reorderedUnitIds: string[];
  mergeActions: Array<{
    targetSourceConceptCandidateId: string;
    sourceConceptCandidateIds: string[];
  }>;
  examImportantConceptIds: string[];
  acknowledgeLowConfidence: boolean;
};

type ResolvedUnit = {
  sourceUnitCandidateId: string;
  label: string;
  defaultLabel: string;
  sequenceOrder: number;
  confidenceScore: number;
  isLowConfidence: boolean;
  sourceEvidenceIds: string[];
};

type ResolvedConcept = {
  sourceConceptCandidateId: string;
  sourceUnitCandidateId: string | null;
  label: string;
  defaultLabel: string;
  normalizedLabel: string;
  sequenceOrder: number;
  coachabilityStatus: string;
  assessmentRelevance: string;
  confidenceScore: number;
  isLowConfidence: boolean;
  isExamImportant: boolean;
  sourceEvidenceIds: string[];
};

const ROLE_OPTIONS: Array<{ value: CoursePackDocumentRole; label: string }> = [
  { value: "syllabus", label: "خطة المقرر" },
  { value: "lecture_notes", label: "ملاحظات محاضرات" },
  { value: "slides", label: "شرائح" },
  { value: "past_exam", label: "اختبار سابق" },
  { value: "lab_sheet", label: "ورقة مختبر" },
  { value: "assignment", label: "واجب أو تكليف" },
  { value: "reference", label: "مرجع" },
  { value: "other", label: "ملف آخر" },
  { value: "unknown", label: "غير واضح بعد" },
];

export function CoursePackWorkspace({
  coursePackId,
}: CoursePackWorkspaceProps) {
  const router = useRouter();
  const [coursePack, setCoursePack] = useState<CoursePackRecord | null>(null);
  const [extraction, setExtraction] = useState<CoursePackExtraction | null>(null);
  const [confirmation, setConfirmation] = useState<CoursePackConfirmation | null>(
    null,
  );
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [reviewedQueueItemIds, setReviewedQueueItemIds] = useState<string[]>([]);
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [activePackMemory, setActivePackMemory] =
    useState<ActivePackMemoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<
    "idle" | "uploading" | "extracting" | "confirming" | "activating"
  >("idle");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursePackId]);

  useEffect(() => {
    if (!extraction) {
      setReviewState(null);
      return;
    }

    setReviewState(buildReviewState(extraction, confirmation));
  }, [extraction, confirmation]);

  useEffect(() => {
    setReviewedQueueItemIds([]);
  }, [extraction?.extractionSnapshotId, confirmation?.confirmationSnapshotId]);

  const evidenceMap = useMemo(
    () =>
      new Map(
        (extraction?.sourceEvidence ?? []).map((item) => [item.evidenceId, item]),
      ),
    [extraction],
  );

  const includedUnits = useMemo(
    () =>
      extraction && reviewState ? resolveUnits(extraction, reviewState) : [],
    [extraction, reviewState],
  );

  const includedConcepts = useMemo(
    () =>
      extraction && reviewState
        ? resolveConcepts(extraction, reviewState, includedUnits)
        : [],
    [extraction, reviewState, includedUnits],
  );

  const lowConfidenceUnits = useMemo(() => {
    const graphUnitIds = new Set(
      extraction?.courseGraph?.units.map((unit) => unit.sourceUnitCandidateId) ?? [],
    );

    return (
      extraction?.units.filter((unit) => !graphUnitIds.has(unit.unitCandidateId)) ?? []
    );
  }, [extraction]);

  const lowConfidenceConcepts = useMemo(() => {
    const graphConceptIds = new Set(
      extraction?.courseGraph?.concepts.map(
        (concept) => concept.sourceConceptCandidateId,
      ) ?? [],
    );

    return (
      extraction?.concepts.filter(
        (concept) => !graphConceptIds.has(concept.conceptCandidateId),
      ) ?? []
    );
  }, [extraction]);

  const mergeSuggestions = useMemo(
    () => deriveMergeSuggestions(includedConcepts),
    [includedConcepts],
  );

  const mergedConceptIds = useMemo(() => {
    const ids = new Set<string>();

    for (const action of reviewState?.mergeActions ?? []) {
      for (const sourceConceptCandidateId of action.sourceConceptCandidateIds) {
        if (sourceConceptCandidateId !== action.targetSourceConceptCandidateId) {
          ids.add(sourceConceptCandidateId);
        }
      }
    }

    return ids;
  }, [reviewState]);

  const requiresLowConfidenceAcknowledgment =
    includedUnits.some((unit) => unit.isLowConfidence) ||
    includedConcepts.some((concept) => concept.isLowConfidence);

  const latestConfirmationMatchesExtraction = Boolean(
    extraction &&
      confirmation &&
      confirmation.extractionSnapshotId === extraction.extractionSnapshotId &&
      confirmation.status !== "superseded",
  );
  const requiresReconfirmation = coursePack?.requiresReconfirmation === true;
  const pendingRefresh = coursePack?.driftStatus === "pending_refresh";
  const activeContextStale = coursePack?.activeContextState === "stale";
  const showingStaleExtraction = pendingRefresh === true && Boolean(extraction);
  const reviewDiff = useMemo(
    () =>
      buildCoursePackReviewDiff({
        coursePack,
        extraction,
        confirmation,
      }),
    [confirmation, coursePack, extraction],
  );
  const changedUnitIds = useMemo(
    () =>
      new Set([
        ...reviewDiff.changedUnits.changed.map((item) => item.sourceId),
      ]),
    [reviewDiff.changedUnits.changed],
  );
  const addedUnitIds = useMemo(
    () => new Set(reviewDiff.changedUnits.added.map((item) => item.sourceId)),
    [reviewDiff.changedUnits.added],
  );
  const changedConceptIds = useMemo(
    () =>
      new Set([
        ...reviewDiff.changedConcepts.changed.map((item) => item.sourceId),
      ]),
    [reviewDiff.changedConcepts.changed],
  );
  const addedConceptIds = useMemo(
    () => new Set(reviewDiff.changedConcepts.added.map((item) => item.sourceId)),
    [reviewDiff.changedConcepts.added],
  );
  const documentChangeSummary = [
    reviewDiff.documentChanges.added
      ? "أُضيفت ملفات جديدة إلى هذه الحزمة."
      : null,
    reviewDiff.documentChanges.removed
      ? "استُبعد ملف كان ضمن النسخة السابقة."
      : null,
    reviewDiff.documentChanges.replaced
      ? "استُبدل أحد الملفات بنسخة أحدث."
      : null,
    reviewDiff.documentChanges.roleChanged
      ? "تغيّر فهم TwinCoach لنوع بعض الملفات."
      : null,
  ].filter((item): item is string => Boolean(item));

  const rereviewQueue = useMemo(
    () =>
      buildCoursePackRereviewQueue({
        reviewDiff,
        confirmation,
        extraction,
        reviewedItemIds: reviewedQueueItemIds,
      }),
    [confirmation, extraction, reviewDiff, reviewedQueueItemIds],
  );
  const queueRequiresCompletion =
    reviewDiff.reviewStatus === "review_required" &&
    rereviewQueue.reviewableCount > 0;
  const queueBlockingReview =
    queueRequiresCompletion && rereviewQueue.remainingReviewCount > 0;
  const displayUnits = useMemo(
    () =>
      prioritizeUnitsForReview({
        units: includedUnits,
        changedUnitIds,
        addedUnitIds,
        queueRequiresCompletion,
      }),
    [addedUnitIds, changedUnitIds, includedUnits, queueRequiresCompletion],
  );
  const displayConcepts = useMemo(
    () =>
      prioritizeConceptsForReview({
        concepts: includedConcepts,
        changedConceptIds,
        addedConceptIds,
        queueRequiresCompletion,
      }),
    [addedConceptIds, changedConceptIds, includedConcepts, queueRequiresCompletion],
  );

  const extractionReady =
    coursePack?.readinessState === "awaiting_extraction" &&
    coursePack.documents.some(
      (document) =>
        document.validationStatus === "valid" &&
        (document.parseStatus === "parsed" || document.parseStatus === "partial") &&
        Boolean(document.confirmedRole),
    );

  const confirmationReady =
    Boolean(extraction?.courseGraph) &&
    Boolean(extraction?.examBlueprint) &&
    Boolean(reviewState) &&
    coursePack?.readinessState === "review_ready" &&
    pendingRefresh !== true &&
    queueBlockingReview !== true &&
    (!requiresLowConfidenceAcknowledgment ||
      reviewState?.acknowledgeLowConfidence === true);

  const activationReady =
    Boolean(confirmation) &&
    coursePack?.readinessState === "activation_ready" &&
    coursePack.supportLevelCandidate !== "not_ready" &&
    requiresReconfirmation !== true &&
    pendingRefresh !== true &&
    (!coursePack.isActive ||
      activeContextStale === true ||
      confirmation?.status !== "activated");

  const canRunExtraction = extractionReady && actionState === "idle";
  const canConfirm = confirmationReady && actionState === "idle";
  const canActivate = activationReady && actionState === "idle";

  async function resolveActivePackMemory(packPayload: CoursePackRecord) {
    if (!packPayload.isActive) {
      return null;
    }

    try {
      const todaySummary = await fetchTodaySummary();

      if (
        todaySummary.activeCourseContext?.coursePackId !== packPayload.coursePackId ||
        !todaySummary.packProgressMemory
      ) {
        return null;
      }

      return {
        courseTitle: todaySummary.activeCourseContext.courseTitle,
        currentFocusLabel:
          todaySummary.activeCourseContext.focusNormalizedConceptLabel ??
          todaySummary.focusConceptLabel,
        memory: todaySummary.packProgressMemory,
      } satisfies ActivePackMemoryState;
    } catch {
      return null;
    }
  }

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      await ensureLearnerIdentity();
      const [packPayload, extractionPayload, confirmationPayload] =
        await Promise.all([
          fetchCoursePack(coursePackId),
          fetchLatestCoursePackExtraction(coursePackId),
          fetchLatestCoursePackConfirmation(coursePackId),
        ]);
      const packMemory = await resolveActivePackMemory(packPayload);

      setRecentCoursePackId(coursePackId);
      setCoursePack(packPayload);
      setExtraction(extractionPayload);
      setConfirmation(confirmationPayload);
      setActivePackMemory(packMemory);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        clearRecentCoursePackId();
        setError("لم نعثر على هذه الحزمة. يمكنك بدء حزمة جديدة بدلًا من ذلك.");
      } else if (loadError instanceof ApiError) {
        setError(loadError.message);
      } else {
        setError("تعذر تحميل صفحة المقرر الآن.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshWorkspace() {
    const [packPayload, extractionPayload, confirmationPayload] = await Promise.all([
      fetchCoursePack(coursePackId),
      fetchLatestCoursePackExtraction(coursePackId),
      fetchLatestCoursePackConfirmation(coursePackId),
    ]);
    const packMemory = await resolveActivePackMemory(packPayload);

    setCoursePack(packPayload);
    setExtraction(extractionPayload);
    setConfirmation(confirmationPayload);
    setActivePackMemory(packMemory);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setActionState("uploading");
    setError("");

    for (const file of files) {
      setUploadEntries((current) => [
        ...current,
        {
          name: file.name,
          progress: 0,
          status: "uploading",
          message: "يجري رفع الملف...",
        },
      ]);

      try {
        await uploadCoursePackDocument({
          coursePackId,
          file,
          onProgress: (progress) => {
            setUploadEntries((current) =>
              current.map((entry) =>
                entry.name === file.name
                  ? {
                      ...entry,
                      progress,
                      message: progress >= 100 ? "نثبت الملف..." : `اكتمل ${progress}%`,
                    }
                  : entry,
              ),
            );
          },
        });

        setUploadEntries((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? {
                  ...entry,
                  progress: 100,
                  status: "success",
                  message: "تم حفظ الملف داخل الحزمة.",
                }
              : entry,
          ),
        );
      } catch (uploadError) {
        setUploadEntries((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? {
                  ...entry,
                  status: "error",
                  message:
                    uploadError instanceof ApiError
                      ? uploadError.message
                      : "تعذر رفع هذا الملف.",
                }
              : entry,
          ),
        );
      }
    }

    event.target.value = "";

    try {
      await refreshWorkspace();
      setStatusMessage("تم تحديث الحزمة بالملفات الجديدة.");
    } catch {
      setError("تم رفع بعض الملفات، لكن تعذر تحديث العرض الحالي.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleRoleChange(
    documentId: string,
    confirmedRole: CoursePackDocumentRole,
  ) {
    setActionState("uploading");
    setError("");

    try {
      await confirmCoursePackDocumentRole({
        coursePackId,
        documentId,
        confirmedRole,
      });
      await refreshWorkspace();
      setStatusMessage("تم حفظ نوع الملف.");
    } catch (roleError) {
      setError(
        roleError instanceof ApiError
          ? roleError.message
          : "تعذر حفظ نوع الملف الآن.",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleReplaceDocument(
    documentId: string,
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    setActionState("uploading");
    setError("");

    try {
      await replaceCoursePackDocument({
        coursePackId,
        documentId,
        file,
      });
      await refreshWorkspace();
      setStatusMessage("تم استبدال الملف وحفظ النسخة الجديدة داخل الحزمة.");
    } catch (replaceError) {
      setError(
        replaceError instanceof ApiError
          ? replaceError.message
          : "تعذر استبدال هذا الملف الآن.",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleRemoveDocument(documentId: string) {
    setActionState("uploading");
    setError("");

    try {
      await removeCoursePackDocument({
        coursePackId,
        documentId,
      });
      await refreshWorkspace();
      setStatusMessage("تم استبعاد هذا الملف من الحزمة الحالية.");
    } catch (removeError) {
      setError(
        removeError instanceof ApiError
          ? removeError.message
          : "تعذر إزالة هذا الملف الآن.",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleRunExtraction() {
    if (!canRunExtraction) {
      return;
    }

    setActionState("extracting");
    setError("");

    try {
      const extractionPayload = await runCoursePackExtraction(coursePackId);
      setExtraction(extractionPayload);
      const [packPayload, confirmationPayload] = await Promise.all([
        fetchCoursePack(coursePackId),
        fetchLatestCoursePackConfirmation(coursePackId),
      ]);
      setCoursePack(packPayload);
      setConfirmation(confirmationPayload);
      setStatusMessage("أصبحت خريطة المقرر جاهزة للمراجعة.");
    } catch (extractionError) {
      setError(
        extractionError instanceof ApiError
          ? extractionError.message
          : "تعذر بناء خريطة المقرر الآن.",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleConfirmReview() {
    if (!extraction || !reviewState || !canConfirm) {
      return;
    }

    setActionState("confirming");
    setError("");

    try {
      const confirmationPayload = await createCoursePackConfirmation({
        coursePackId,
        payload: buildConfirmationPayload(reviewState, includedUnits, includedConcepts),
      });
      setConfirmation(confirmationPayload);
      const refreshedPack = await fetchCoursePack(coursePackId);
      setCoursePack(refreshedPack);
      setStatusMessage(
        refreshedPack.isActive && refreshedPack.activeContextState === "stale"
          ? "تم حفظ المراجعة الجديدة. بقي فقط تحديث التفعيل حتى يعيد TwinCoach ضبط التركيز والخطوة التالية على النسخة الأحدث."
          : "تم حفظ هذه المراجعة، ويمكنك الآن التفعيل إذا كانت الحزمة جاهزة.",
      );
    } catch (confirmationError) {
      setError(
        confirmationError instanceof ApiError
          ? confirmationError.message
          : "تعذر حفظ المراجعة الحالية.",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleActivate() {
    if (!confirmation || !canActivate) {
      return;
    }

    setActionState("activating");
    setError("");

    try {
      await activateCoursePack({
        coursePackId,
        confirmationSnapshotId: confirmation.confirmationSnapshotId,
      });
      setRecentCoursePackId(coursePackId);
      router.replace("/today?coursePackRefreshed=1");
    } catch (activationError) {
      setError(
        activationError instanceof ApiError
          ? activationError.message
          : "تعذر تفعيل هذه الحزمة الآن.",
      );
      setActionState("idle");
    }
  }

  function updateReviewState(
    updater: (current: ReviewState) => ReviewState,
  ) {
    setReviewState((current) => (current ? updater(current) : current));
  }

  function toggleReviewedQueueItem(queueItemId: string) {
    setReviewedQueueItemIds((current) =>
      current.includes(queueItemId)
        ? current.filter((itemId) => itemId !== queueItemId)
        : [...current, queueItemId],
    );
  }

  if (loading) {
    return (
      <StudentShell>
        <PageHeader eyebrow="مقررّك" subtitle="نراجع حالة هذه الحزمة." title="نحمّل مساحة المقرر" />
        <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
          <StatePanel eyebrow="حزمة المقرر" title="نجلب ملفات المقرر" description="هذه خطوة قصيرة لقراءة الحالة الحالية من TwinCoach." tone="loading" />
        </section>
      </StudentShell>
    );
  }

  if (error && !coursePack) {
    return (
      <StudentShell>
        <PageHeader eyebrow="مقررّك" subtitle="تعذر فتح هذه الحزمة." title="لم نتمكن من متابعة المقرر" />
        <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
          <StatePanel eyebrow="حزمة المقرر" title="تعذر فتح الحزمة" description={error} tone="error" />
          <Link className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href="/course-pack">
            ابدأ حزمة جديدة
          </Link>
        </section>
      </StudentShell>
    );
  }

  const returningToToday =
    coursePack?.isActive === true &&
    !canActivate &&
    !canConfirm &&
    !canRunExtraction &&
    !queueBlockingReview;
  const hasActionableStep =
    returningToToday ||
    canActivate ||
    canConfirm ||
    canRunExtraction ||
    queueBlockingReview;

  const confirmationStatusText =
    !confirmation
      ? ""
      : requiresReconfirmation
        ? "التغييرات الأخيرة خرجت عن نطاق آخر مراجعة محفوظة، لذلك نحتاج منك مراجعة جديدة قبل أن نعتمد هذه النسخة."
        : coursePack?.isActive && activeContextStale
          ? "راجعت النسخة الأحدث بالفعل، لكن TwinCoach ما زال يعمل على سياق أقدم حتى تحدّث التفعيل."
          : latestConfirmationMatchesExtraction || !coursePack?.requiresReconfirmation
            ? "هذه المراجعة ما زالت تغطي أحدث نسخة محفوظة من الحزمة."
            : "لديك مراجعة أقدم من أحدث Extraction، لذلك يلزم حفظ مراجعة جديدة قبل التفعيل.";

  const primaryActionLabel = returningToToday
    ? "العودة إلى تدريبك الحالي"
    : queueBlockingReview
      ? "راجع العناصر المتغيّرة أولًا"
    : activationReady
      ? actionState === "activating"
        ? coursePack?.isActive
          ? "نحدّث المقرر النشط..."
          : "نجعل هذا المقرر هو المقرر النشط..."
        : coursePack?.isActive
          ? "حدّث المقرر النشط"
          : "فعّل هذا المقرر"
      : confirmationReady
        ? actionState === "confirming"
          ? "نحفظ هذه المراجعة..."
          : "احفظ هذه المراجعة"
        : extractionReady
          ? actionState === "extracting"
            ? "نبني خريطة المقرر..."
            : "ابنِ خريطة المقرر"
          : "أكمل الخطوة الحالية أولًا";

  const primaryActionSupportingText = returningToToday
    ? "تم تفعيل هذه الحزمة بالفعل. سنعيدك الآن إلى مسار TwinCoach العادي."
    : queueBlockingReview
      ? `بقي ${rereviewQueue.remainingReviewCount} من العناصر المتغيّرة تحتاج مراجعة سريعة قبل حفظ النسخة الجديدة.`
    : activationReady
      ? coursePack?.isActive
        ? "سنحدّث السياق النشط ليطابق آخر مراجعة حفظتها، ثم نعيد ضبط التركيز والخطوة التالية وفق ما تغيّر."
        : "التفعيل سيجعل هذا المقرر هو السياق الحالي داخل TwinCoach."
      : confirmationReady
        ? "لن نفعّل شيئًا قبل حفظ مراجعتك الحالية. بعد الحفظ يمكننا تحديث الخطة التالية حول العناصر المتغيّرة فقط."
        : extractionReady
          ? "سنحلل الملفات المؤكدة فقط، ثم نعرض الخريطة قبل أي تفعيل."
          : "ارفع الملفات وصحّح نوعها أولًا، ثم أكمل الخطوة التالية.";

  return (
    <StudentShell>
      <PageHeader
        eyebrow="مقررّك"
        subtitle="راجع ما فهمه TwinCoach من ملفات هذه المادة قبل أي تفعيل."
        title={coursePack?.courseTitle ?? "حزمة مقرر"}
        detail={coursePack ? `${formatLifecycleState(coursePack.lifecycleState)} • ${formatReadinessState(coursePack.readinessState)}` : undefined}
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
        {error ? <StatePanel eyebrow="حزمة المقرر" title="توجد ملاحظة تحتاج انتباهك" description={error} tone="error" /> : null}
        {statusMessage ? <StatePanel eyebrow="حزمة المقرر" title="تم تحديث الحالة" description={statusMessage} tone="recovery" /> : null}
        {coursePack?.isActive && activePackMemory ? (
          <PackProgressMemoryCard
            compact
            courseTitle={activePackMemory.courseTitle}
            currentFocusLabel={activePackMemory.currentFocusLabel}
            memory={activePackMemory.memory}
            surface="workspace"
          />
        ) : null}
        {coursePack && (coursePack.driftStatus !== "clean" || coursePack.activeContextState === "stale") ? (
          <div className={`motion-rise rounded-[1.75rem] border p-5 shadow-sm ${getDriftTone(coursePack.driftStatus)}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-semibold">
                {formatDriftStatus(coursePack.driftStatus)}
              </span>
              <span className="inline-flex rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-semibold">
                {formatActiveContextState(coursePack.activeContextState)}
              </span>
            </div>
            <div className="mt-3 text-base font-semibold">
              {coursePack.requiresReconfirmation
                ? "هذه الحزمة تحتاج مراجعة جديدة قبل الاعتماد على النسخة الحالية."
                : coursePack.activeContextState === "stale"
                  ? "ما زالت لديك نسخة نشطة أقدم من آخر تحديث محفوظ."
                  : "هناك تحديث جديد يحتاج خطوة قصيرة حتى يعود TwinCoach إلى نفس النسخة التي تراجعها."}
            </div>
            <div className="mt-2 text-sm leading-7">
              {describePackDrift(coursePack)}
            </div>
            {coursePack.driftReasonCodes.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {coursePack.driftReasonCodes.map((reasonCode) => (
                  <div
                    key={reasonCode}
                    className="rounded-[1rem] border border-current/15 bg-white/75 px-3 py-2 text-sm leading-7"
                  >
                    {formatDriftReasonCode(reasonCode)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {coursePack && confirmation ? (
          <div className="motion-rise rounded-[1.75rem] border border-[var(--border)] bg-white/92 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {reviewDiff.reviewStatusLabel}
              </span>
              {reviewDiff.supportLevelImpact ? (
                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-950">
                  تغيّر مستوى الدعم: {formatSupportLevel(reviewDiff.supportLevelImpact.before)} ← سابقًا، والآن {formatSupportLevel(reviewDiff.supportLevelImpact.after)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
              ملخص ما تغيّر منذ آخر مراجعة
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--text)]">
              {reviewDiff.reviewStatusText}
            </div>
            {documentChangeSummary.length > 0 ? (
              <div className="mt-4 space-y-2">
                {documentChangeSummary.map((item) => (
                  <div
                    key={item}
                    className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-7 text-slate-900"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.15rem] border border-[var(--border)] bg-white p-3 text-sm leading-7 text-[var(--text)] shadow-sm">
                {reviewDiff.extractionChangedMaterially
                  ? "التغييرات أثّرت على الخريطة أو التركيز بما يكفي لتحتاج نظرًا سريعًا قبل الاعتماد."
                  : "لا نرى هنا تغيّرًا جوهريًا في الخريطة يفرض إعادة مراجعة كاملة."}
              </div>
              <div className="rounded-[1.15rem] border border-[var(--border)] bg-white p-3 text-sm leading-7 text-[var(--text)] shadow-sm">
                {requiresReconfirmation
                  ? "المطلوب الآن: مرّ على العناصر المتغيرة أدناه ثم احفظ مراجعة جديدة."
                  : activeContextStale
                    ? "المطلوب الآن: لا تحتاج مراجعة كاملة. يكفي تحديث التفعيل حين تكون جاهزًا."
                    : pendingRefresh
                      ? "المطلوب الآن: أعد بناء الخريطة أولًا حتى نعرض لك الفرق الفعلي."
                      : "المراجعة الحالية ما زالت تغطي النسخة المعروضة، ويمكنك متابعة العمل بشكل طبيعي."}
              </div>
            </div>
          </div>
        ) : null}

        {coursePack ? (
          <div className="motion-rise stage-card rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">{formatLifecycleState(coursePack.lifecycleState)}</span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">{formatReadinessState(coursePack.readinessState)}</span>
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSupportLevelTone(coursePack.supportLevelCandidate)}`}>{formatSupportLevel(coursePack.supportLevelCandidate)}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                <div className="text-xs font-semibold text-[var(--text-muted)]">معلومات الحزمة</div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--text)]">
                  <div>عدد الملفات الحالية: {coursePack.documentCount}</div>
                  <div>الوحدات المؤكدة: {coursePack.confirmedUnitCount}</div>
                  <div>المفاهيم المؤكدة: {coursePack.confirmedConceptCount}</div>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                <div className="text-xs font-semibold text-[var(--text-muted)]">مستوى الدعم الحالي</div>
                <div className="mt-3 text-base font-semibold text-[var(--text)]">{formatSupportLevel(coursePack.supportLevelCandidate)}</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{describeSupportLevel(coursePack.supportLevelCandidate)}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="motion-rise-delay-1 stage-card rounded-[2rem] p-5 md:p-6">
          <div className="text-xs font-semibold text-[var(--text-muted)]">رفع ملفات PDF</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">ارفع ملفات المقرر الفعلية</div>
          <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">ندعم في هذه المرحلة ملفات PDF النصية الخاصة بمقرر واحد فقط.</div>
          <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">يمكنك هنا إضافة ملف جديد إلى نفس الحزمة، أو استبدال ملف قائم من بطاقته في الأسفل.</div>
          <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--primary)]/16 bg-[var(--primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            اختر ملفات PDF
            <input accept=".pdf,application/pdf" className="hidden" multiple onChange={handleUpload} type="file" />
          </label>
          {uploadEntries.length > 0 ? (
            <div className="mt-4 space-y-3">
              {uploadEntries.map((entry) => (
                <div key={`${entry.name}-${entry.status}`} className="rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">{entry.name}</div>
                    <div className="text-xs font-semibold text-[var(--text-muted)]">{entry.status === "uploading" ? `${entry.progress}%` : entry.status === "success" ? "تم" : "تعذر"}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${entry.status === "error" ? "bg-red-400" : "bg-[var(--primary)]"}`} style={{ width: `${Math.max(entry.progress, entry.status === "error" ? 100 : 4)}%` }} />
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{entry.message}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {coursePack?.documents.length ? (
          <div className="motion-rise-delay-2 stage-card rounded-[2rem] p-5 md:p-6">
            <div className="text-xs font-semibold text-[var(--text-muted)]">مراجعة نوع كل ملف</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text)]">صحّح فهمنا للملفات قبل التحليل</div>
            <div className="mt-4 space-y-3">
              {coursePack.documents.map((document) => (
                <div key={document.documentId} className="rounded-[1.4rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{document.originalFilename}</div>
                      <div className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{formatFileSize(document.byteSize)}{document.pageCount ? ` • ${document.pageCount} صفحة` : ""}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{formatValidationStatus(document.validationStatus)}</span>
                      <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{formatParseStatus(document.parseStatus)}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-muted)]">النوع المقترح</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{formatCoursePackRole(document.suggestedRole)}</div>
                      {document.roleConfidenceScore != null ? <div className="mt-1 text-xs text-[var(--text-muted)]">درجة الثقة: {formatPercent(document.roleConfidenceScore)}</div> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="min-h-11 rounded-[1rem] border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--text)] outline-none transition focus:border-[var(--primary)]" disabled={document.validationStatus !== "valid" || actionState !== "idle"} onChange={(event) => void handleRoleChange(document.documentId, event.target.value as CoursePackDocumentRole)} value={document.confirmedRole ?? document.suggestedRole ?? "unknown"}>
                        {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <label className={`inline-flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${actionState !== "idle" ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500" : "border-[var(--border)] bg-white text-[var(--text)]"}`}>
                        استبدل الملف
                        <input
                          accept=".pdf,application/pdf"
                          className="hidden"
                          disabled={actionState !== "idle"}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void handleReplaceDocument(document.documentId, file);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={actionState !== "idle" || coursePack.documents.length <= 1}
                        onClick={() => void handleRemoveDocument(document.documentId)}
                        type="button"
                      >
                        استبعد هذا الملف
                      </button>
                    </div>
                  </div>
                  {document.warningCodes.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {document.warningCodes.map((warningCode) => <div key={warningCode} className="rounded-[1.1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-7 text-amber-950">{formatWarningCode(warningCode)}</div>)}
                    </div>
                  ) : null}
                  {document.blockingIssueCode ? <div className="mt-4 rounded-[1.1rem] border border-red-200 bg-red-50 px-3 py-2 text-sm leading-7 text-red-950">{formatBlockingIssue(document.blockingIssueCode)}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {coursePack?.readinessState === "awaiting_extraction" && !extraction ? (
          <StatePanel
            eyebrow="خريطة المقرر"
            title="جاهز لبناء الخريطة"
            description="بعد أن تأكدت أنواع الملفات، يمكننا الآن استخراج وحدات المقرر وخريطة التركيز للاختبار."
            tone="recovery"
          />
        ) : null}

        {extraction ? (
          <>
            {!showingStaleExtraction &&
            (reviewDiff.changedItemsCount > 0 ||
              rereviewQueue.activationRefreshRequired) ? (
              <div
                className="motion-rise-delay-2 stage-card rounded-[2rem] p-5 md:p-6"
                id="changed-review-queue"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                      طابور المراجعة السريعة
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                      ابدأ فقط بما تغيّر أو بما قد يغيّر خطتك. ما لا يظهر هنا يظل صالحًا غالبًا كما كان.
                    </div>
                  </div>
                  {rereviewQueue.reviewableCount > 0 ? (
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      راجعت {rereviewQueue.reviewedCount} من{" "}
                      {rereviewQueue.reviewableCount}
                    </span>
                  ) : null}
                </div>

                {rereviewQueue.items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {rereviewQueue.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-[1.3rem] border px-4 py-3 shadow-sm ${getQueueItemTone(
                          item.status,
                          item.kind,
                        )}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex rounded-full border border-current/15 bg-white/70 px-3 py-1 text-xs font-semibold">
                                {getQueueItemKindLabel(item.kind)}
                              </span>
                              <span className="inline-flex rounded-full border border-current/15 bg-white/70 px-3 py-1 text-xs font-semibold">
                                {getQueueItemStatusLabel(item.status)}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-semibold text-current">
                              {item.label}
                            </div>
                            <div className="mt-2 text-sm leading-7 text-current/90">
                              {item.detail}
                            </div>
                          </div>
                          {item.status !== "needs_activation_refresh" ? (
                            <button
                              className="rounded-full border border-current/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-current transition hover:-translate-y-0.5 hover:bg-white"
                              onClick={() => toggleReviewedQueueItem(item.id)}
                              type="button"
                            >
                              {item.status === "reviewed"
                                ? "إلغاء كمراجع"
                                : "معلّم كمراجع"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 text-sm leading-7 text-[var(--text-muted)] shadow-sm">
                  {queueBlockingReview
                    ? `المطلوب الآن: مرّ على العناصر المتغيّرة أعلاه وحدّد ما راجعته. بعد ذلك فقط سنحفظ نسخة المراجعة الجديدة.`
                    : rereviewQueue.activationRefreshRequired
                      ? "المراجعة الجديدة جاهزة. بقي فقط تحديث التفعيل ليعيد TwinCoach ضبط تركيزك التالي وخطوة اليوم."
                      : "إذا ظهرت هنا تغييرات قليلة فقط، فهذا يعني أن بقية الحزمة ما زالت صالحة كما كانت."}
                </div>

                <div className="mt-4 space-y-4">
                  {reviewDiff.changedUnits.added.length > 0 ||
                  reviewDiff.changedUnits.changed.length > 0 ||
                  reviewDiff.changedUnits.removed.length > 0 ? (
                    <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        تغيّرات الوحدات
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
                        {reviewDiff.changedUnits.added.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
                            جديد: {item.label}
                          </div>
                        ))}
                        {reviewDiff.changedUnits.changed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
                            تغيّر: {item.after}
                          </div>
                        ))}
                        {reviewDiff.changedUnits.removed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-rose-950">
                            لم تعد ظاهرة: {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {reviewDiff.changedConcepts.added.length > 0 ||
                  reviewDiff.changedConcepts.changed.length > 0 ||
                  reviewDiff.changedConcepts.removed.length > 0 ? (
                    <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        تغيّرات المفاهيم
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
                        {reviewDiff.changedConcepts.added.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
                            جديد: {item.label}
                          </div>
                        ))}
                        {reviewDiff.changedConcepts.changed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
                            تغيّر: {item.after}
                          </div>
                        ))}
                        {reviewDiff.changedConcepts.removed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-rose-950">
                            لم يعد ظاهرًا: {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {reviewDiff.changedBlueprintAreas.added.length > 0 ||
                  reviewDiff.changedBlueprintAreas.changed.length > 0 ||
                  reviewDiff.changedBlueprintAreas.removed.length > 0 ? (
                    <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--text)]">
                        تغيّرات التركيز للاختبار
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--text-muted)]">
                        {reviewDiff.changedBlueprintAreas.added.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
                            ظهرت منطقة تركيز جديدة: {item.label}
                          </div>
                        ))}
                        {reviewDiff.changedBlueprintAreas.changed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
                            تغيّر: {item.after}
                          </div>
                        ))}
                        {reviewDiff.changedBlueprintAreas.removed.map((item) => (
                          <div key={item.id} className="rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-rose-950">
                            لم تعد ضمن مناطق التركيز الحالية: {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="motion-rise-delay-2 stage-card rounded-[2rem] p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                  {formatCoverageStatus(extraction.coverageStatus)}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                  متوسط الثقة {formatPercent(extraction.averageConfidenceScore)}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                  عناصر منخفضة الثقة: {extraction.lowConfidenceItemCount}
                </span>
              </div>

              {showingStaleExtraction ? (
                <div className="mt-4 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  التحديثات الأخيرة غيّرت ملفات هذه الحزمة بعد آخر Extraction معروض هنا. ما تراه أدناه ما زال يخص النسخة السابقة إلى أن تعيد بناء الخريطة من جديد.
                </div>
              ) : null}

              <div className="mt-4 text-xs font-semibold text-[var(--text-muted)]">
                الوحدات المستخرجة
              </div>
              <div className="mt-4 space-y-3">
                {displayUnits.map((unit, index) => (
                  <div
                    key={unit.sourceUnitCandidateId}
                    className="rounded-[1.35rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[var(--text-muted)]">
                          وحدة {index + 1}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {addedUnitIds.has(unit.sourceUnitCandidateId) ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950">
                              وحدة جديدة
                            </span>
                          ) : null}
                          {changedUnitIds.has(unit.sourceUnitCandidateId) ? (
                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-950">
                              تغيّرت منذ آخر مراجعة
                            </span>
                          ) : null}
                        </div>
                        <input
                          className="mt-2 min-h-11 w-full rounded-[1rem] border border-[var(--border)] bg-white px-4 text-base font-semibold text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                          onChange={(event) =>
                            updateReviewState((current) => ({
                              ...current,
                              unitLabels: {
                                ...current.unitLabels,
                                [unit.sourceUnitCandidateId]: event.target.value,
                              },
                            }))
                          }
                          value={reviewState?.unitLabels[unit.sourceUnitCandidateId] ?? unit.label}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              reorderedUnitIds: moveUnitInOrder(
                                current.reorderedUnitIds,
                                unit.sourceUnitCandidateId,
                                -1,
                              ),
                            }))
                          }
                          type="button"
                        >
                          ارفع
                        </button>
                        <button
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              reorderedUnitIds: moveUnitInOrder(
                                current.reorderedUnitIds,
                                unit.sourceUnitCandidateId,
                                1,
                              ),
                            }))
                          }
                          type="button"
                        >
                          اخفض
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unit.isLowConfidence ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                          منخفض الثقة
                        </span>
                      ) : null}
                      <button
                        className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                        onClick={() =>
                          updateReviewState((current) => ({
                            ...current,
                            removedItemIds: current.removedItemIds.filter(
                              (itemId) => itemId !== unit.sourceUnitCandidateId,
                            ),
                            irrelevantItemIds: current.irrelevantItemIds.filter(
                              (itemId) => itemId !== unit.sourceUnitCandidateId,
                            ),
                          }))
                        }
                        type="button"
                      >
                        إبقاء
                      </button>
                      <button
                        className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                        onClick={() =>
                          updateReviewState((current) => ({
                            ...current,
                            removedItemIds: addUniqueId(
                              current.removedItemIds.filter(
                                (itemId) => itemId !== unit.sourceUnitCandidateId,
                              ),
                              unit.sourceUnitCandidateId,
                            ),
                            irrelevantItemIds: current.irrelevantItemIds.filter(
                              (itemId) => itemId !== unit.sourceUnitCandidateId,
                            ),
                          }))
                        }
                        type="button"
                      >
                        استبعاد
                      </button>
                      <button
                        className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                        onClick={() =>
                          updateReviewState((current) => ({
                            ...current,
                            removedItemIds: current.removedItemIds.filter(
                              (itemId) => itemId !== unit.sourceUnitCandidateId,
                            ),
                            irrelevantItemIds: addUniqueId(
                              current.irrelevantItemIds.filter(
                                (itemId) => itemId !== unit.sourceUnitCandidateId,
                              ),
                              unit.sourceUnitCandidateId,
                            ),
                          }))
                        }
                        type="button"
                      >
                        ليس من مقرري
                      </button>
                    </div>
                    {unit.sourceEvidenceIds.length > 0 ? (
                      <div className="mt-3">
                        <InlineReveal label="اعرض الدليل" tone="soft">
                          <div className="space-y-2">
                            {unit.sourceEvidenceIds.slice(0, 2).map((evidenceId) => {
                              const evidence = evidenceMap.get(evidenceId);
                              if (!evidence) {
                                return null;
                              }

                              return (
                                <div
                                  key={evidenceId}
                                  className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                                    {formatEvidenceType(evidence.evidenceType)} • ص {evidence.pageStart}
                                  </div>
                                  <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                                    {evidence.snippet}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </InlineReveal>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                المفاهيم المستخرجة
              </div>
              <div className="mt-4 space-y-3">
                {displayConcepts.map((concept) => (
                  <div
                    key={concept.sourceConceptCandidateId}
                    className={`rounded-[1.35rem] border p-4 shadow-sm ${
                      mergedConceptIds.has(concept.sourceConceptCandidateId)
                        ? "border-slate-200 bg-slate-50 opacity-70"
                        : "border-[var(--border)] bg-white/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <input
                          className="min-h-11 w-full rounded-[1rem] border border-[var(--border)] bg-white px-4 text-base font-semibold text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                          onChange={(event) =>
                            updateReviewState((current) => ({
                              ...current,
                              conceptLabels: {
                                ...current.conceptLabels,
                                [concept.sourceConceptCandidateId]: event.target.value,
                              },
                            }))
                          }
                          value={
                            reviewState?.conceptLabels[concept.sourceConceptCandidateId] ??
                            concept.label
                          }
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {addedConceptIds.has(concept.sourceConceptCandidateId) ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950">
                              مفهوم جديد
                            </span>
                          ) : null}
                          {changedConceptIds.has(concept.sourceConceptCandidateId) ? (
                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-950">
                              تغيّر منذ آخر مراجعة
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)]">
                            {formatCoachabilityStatus(concept.coachabilityStatus)}
                          </span>
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)]">
                            {concept.assessmentRelevance === "high"
                              ? "مرتبط أكثر بالتقييم"
                              : concept.assessmentRelevance === "medium"
                                ? "مرتبط بالتقييم بدرجة متوسطة"
                                : "إشارة تقييم محدودة"}
                          </span>
                          {concept.isLowConfidence ? (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                              منخفض الثقة
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${
                            reviewState?.examImportantConceptIds.includes(
                              concept.sourceConceptCandidateId,
                            )
                              ? "border-blue-200 bg-blue-50 text-blue-900"
                              : "border-[var(--border)] bg-white text-[var(--text)]"
                          }`}
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              examImportantConceptIds:
                                current.examImportantConceptIds.includes(
                                  concept.sourceConceptCandidateId,
                                )
                                  ? current.examImportantConceptIds.filter(
                                      (itemId) =>
                                        itemId !== concept.sourceConceptCandidateId,
                                    )
                                  : [
                                      ...current.examImportantConceptIds,
                                      concept.sourceConceptCandidateId,
                                    ],
                            }))
                          }
                          type="button"
                        >
                          {reviewState?.examImportantConceptIds.includes(
                            concept.sourceConceptCandidateId,
                          )
                            ? "مهم للاختبار"
                            : "علّمه مهمًا"}
                        </button>
                        <button
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              removedItemIds: addUniqueId(
                                current.removedItemIds.filter(
                                  (itemId) => itemId !== concept.sourceConceptCandidateId,
                                ),
                                concept.sourceConceptCandidateId,
                              ),
                              irrelevantItemIds: current.irrelevantItemIds.filter(
                                (itemId) => itemId !== concept.sourceConceptCandidateId,
                              ),
                              mergeActions: stripConceptFromMergeActions(
                                current.mergeActions,
                                concept.sourceConceptCandidateId,
                              ),
                            }))
                          }
                          type="button"
                        >
                          استبعاد
                        </button>
                        <button
                          className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              removedItemIds: current.removedItemIds.filter(
                                (itemId) => itemId !== concept.sourceConceptCandidateId,
                              ),
                              irrelevantItemIds: addUniqueId(
                                current.irrelevantItemIds.filter(
                                  (itemId) => itemId !== concept.sourceConceptCandidateId,
                                ),
                                concept.sourceConceptCandidateId,
                              ),
                              mergeActions: stripConceptFromMergeActions(
                                current.mergeActions,
                                concept.sourceConceptCandidateId,
                              ),
                            }))
                          }
                          type="button"
                        >
                          ليس من مقرري
                        </button>
                      </div>
                    </div>
                    {concept.sourceEvidenceIds.length > 0 ? (
                      <div className="mt-3">
                        <InlineReveal label="اعرض الدليل" tone="soft">
                          <div className="space-y-2">
                            {concept.sourceEvidenceIds.slice(0, 2).map((evidenceId) => {
                              const evidence = evidenceMap.get(evidenceId);
                              if (!evidence) {
                                return null;
                              }

                              return (
                                <div
                                  key={evidenceId}
                                  className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                                    {formatEvidenceType(evidence.evidenceType)} • ص {evidence.pageStart}
                                  </div>
                                  <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                                    {evidence.snippet}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </InlineReveal>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {mergeSuggestions.length > 0 ? (
              <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  دمج التكرارات
                </div>
                <div className="mt-4 space-y-3">
                  {mergeSuggestions.map((suggestion) => {
                    const isApplied = reviewState?.mergeActions.some(
                      (action) =>
                        action.targetSourceConceptCandidateId ===
                        suggestion.targetSourceConceptCandidateId,
                    );

                    return (
                      <div
                        key={suggestion.targetSourceConceptCandidateId}
                        className="rounded-[1.3rem] border border-blue-200 bg-blue-50 p-4"
                      >
                        <div className="text-sm font-semibold text-blue-950">
                          {suggestion.labels.join(" + ")}
                        </div>
                        <button
                          className="mt-3 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              mergeActions: isApplied
                                ? current.mergeActions.filter(
                                    (action) =>
                                      action.targetSourceConceptCandidateId !==
                                      suggestion.targetSourceConceptCandidateId,
                                  )
                                : [...current.mergeActions, suggestion],
                            }))
                          }
                          type="button"
                        >
                          {isApplied ? "إلغاء الدمج" : "ادمج المتشابه"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {lowConfidenceUnits.length > 0 || lowConfidenceConcepts.length > 0 ? (
              <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  عناصر منخفضة الثقة
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  هذه العناصر بقيت خارج الرسم البياني المؤكد تلقائيًا. يمكنك إبقاء ما تراه مهمًا، لكننا سنطلب إقرارًا صريحًا قبل الحفظ.
                </div>
                <div className="mt-4 space-y-3">
                  {lowConfidenceUnits.map((unit) => (
                    <div key={unit.unitCandidateId} className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-amber-950">
                            {reviewState?.unitLabels[unit.unitCandidateId] ??
                              unit.normalizedTitle ??
                              unit.rawTitle}
                          </div>
                          <div className="mt-1 text-xs text-amber-900">
                            ثقة تقريبية: {formatPercent(unit.confidenceScore)}
                          </div>
                        </div>
                        <button
                          className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              confirmedUnitCandidateIds:
                                current.confirmedUnitCandidateIds.includes(unit.unitCandidateId)
                                  ? current.confirmedUnitCandidateIds.filter(
                                      (itemId) => itemId !== unit.unitCandidateId,
                                    )
                                  : [...current.confirmedUnitCandidateIds, unit.unitCandidateId],
                              reorderedUnitIds: current.reorderedUnitIds.includes(
                                unit.unitCandidateId,
                              )
                                ? current.reorderedUnitIds
                                : [...current.reorderedUnitIds, unit.unitCandidateId],
                            }))
                          }
                          type="button"
                        >
                          {reviewState?.confirmedUnitCandidateIds.includes(
                            unit.unitCandidateId,
                          )
                            ? "إزالة من المراجعة"
                            : "أضفه للمراجعة"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {lowConfidenceConcepts.map((concept) => (
                    <div key={concept.conceptCandidateId} className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-amber-950">
                            {reviewState?.conceptLabels[concept.conceptCandidateId] ??
                              concept.learnerLabelCandidate}
                          </div>
                          <div className="mt-1 text-xs text-amber-900">
                            {formatCoachabilityStatus(concept.coachabilityStatus)}
                          </div>
                        </div>
                        <button
                          className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                          onClick={() =>
                            updateReviewState((current) => ({
                              ...current,
                              confirmedConceptCandidateIds:
                                current.confirmedConceptCandidateIds.includes(
                                  concept.conceptCandidateId,
                                )
                                  ? current.confirmedConceptCandidateIds.filter(
                                      (itemId) =>
                                        itemId !== concept.conceptCandidateId,
                                    )
                                  : [...current.confirmedConceptCandidateIds, concept.conceptCandidateId],
                              confirmedUnitCandidateIds:
                                concept.unitCandidateId &&
                                !current.confirmedUnitCandidateIds.includes(
                                  concept.unitCandidateId,
                                )
                                  ? [...current.confirmedUnitCandidateIds, concept.unitCandidateId]
                                  : current.confirmedUnitCandidateIds,
                              reorderedUnitIds:
                                concept.unitCandidateId &&
                                !current.reorderedUnitIds.includes(concept.unitCandidateId)
                                  ? [...current.reorderedUnitIds, concept.unitCandidateId]
                                  : current.reorderedUnitIds,
                            }))
                          }
                          type="button"
                        >
                          {reviewState?.confirmedConceptCandidateIds.includes(
                            concept.conceptCandidateId,
                          )
                            ? "إزالة من المراجعة"
                            : "أضفه للمراجعة"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {extraction.unsupportedTopics.length > 0 ? (
              <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  مواضيع غير مدعومة بالكامل
                </div>
                <div className="mt-4 space-y-3">
                  {extraction.unsupportedTopics.map((topic) => (
                    <div key={topic.unsupportedTopicId} className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--text)]">{topic.rawLabel}</div>
                      <div className="mt-1 text-sm leading-7 text-[var(--text-muted)]">{formatUnsupportedTopicReason(topic.reasonCode)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {extraction.examBlueprint ? (
              <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  خريطة التركيز للاختبار
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  هذه ليست تنبؤًا يقينيًا، بل استدلالًا من الملفات التي رفعتها.
                </div>
                <div className="mt-4 space-y-3">
                  {extraction.examBlueprint.areas.map((area) => (
                    <div key={area.blueprintAreaId} className="rounded-[1.4rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-base font-semibold text-[var(--text)]">{area.label}</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{formatPriorityTier(area.priorityTier)}</span>
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{formatPracticeNeed(area.practiceNeed)}</span>
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{formatTimeShare(area.suggestedTimeSharePct)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                        {formatRecurrenceSignal(area.recurrenceSignal)} • ثقة تقريبية {formatPercent(area.confidenceScore)}
                      </div>
                      {area.sourceEvidenceIds.length > 0 ? (
                        <div className="mt-3">
                          <InlineReveal label="لماذا استنتجنا ذلك؟" tone="soft">
                            <div className="space-y-2">
                              {area.sourceEvidenceIds.slice(0, 2).map((evidenceId) => {
                                const evidence = evidenceMap.get(evidenceId);
                                if (!evidence) {
                                  return null;
                                }

                                return (
                                  <div
                                    key={evidenceId}
                                    className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2"
                                  >
                                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                                      {formatEvidenceType(evidence.evidenceType)} • ص {evidence.pageStart}
                                    </div>
                                    <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                                      {evidence.snippet}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </InlineReveal>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {reviewState && extraction ? (
          <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              التأكيد قبل التفعيل
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--text)]">
              نفعّل فقط ما راجعته بنفسك
            </div>
            {requiresLowConfidenceAcknowledgment ? (
              <label className="mt-4 flex items-start gap-3 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                <input
                  checked={reviewState.acknowledgeLowConfidence}
                  className="mt-1 h-4 w-4"
                  onChange={(event) =>
                    updateReviewState((current) => ({
                      ...current,
                      acknowledgeLowConfidence: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  أفهم أن بعض العناصر المعروضة منخفضة الثقة، وأريد إبقاءها ضمن المراجعة الحالية رغم ذلك.
                </span>
              </label>
            ) : null}
            {confirmation ? (
              <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-white/90 p-4 shadow-sm">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  آخر مراجعة محفوظة
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                  الحالة: {confirmation.status} • العناصر المعدلة: {confirmation.editedItemCount} • الدمج: {confirmation.mergeActionCount}
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  {confirmationStatusText}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      <StickyActionBar
        disabled={actionState !== "idle" || !hasActionableStep}
        label={primaryActionLabel}
        onClick={() => {
          if (returningToToday) {
            router.replace("/today");
            return;
          }
          if (queueBlockingReview) {
            document
              .getElementById("changed-review-queue")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (canActivate) {
            void handleActivate();
            return;
          }
          if (canConfirm) {
            void handleConfirmReview();
            return;
          }
          if (canRunExtraction) {
            void handleRunExtraction();
          }
        }}
        supportingText={primaryActionSupportingText}
      />
    </StudentShell>
  );
}

function getQueueItemKindLabel(
  kind: "unit" | "concept" | "blueprint" | "support_level" | "activation",
) {
  switch (kind) {
    case "unit":
      return "وحدة";
    case "concept":
      return "مفهوم";
    case "blueprint":
      return "تركيز الاختبار";
    case "support_level":
      return "مستوى الدعم";
    default:
      return "تحديث التفعيل";
  }
}

function getQueueItemStatusLabel(
  status:
    | "needs_quick_review"
    | "needs_explicit_confirmation"
    | "needs_activation_refresh"
    | "reviewed",
) {
  switch (status) {
    case "needs_quick_review":
      return "يحتاج مراجعة سريعة";
    case "needs_explicit_confirmation":
      return "يحتاج تأكيدًا صريحًا";
    case "needs_activation_refresh":
      return "يبقى تحديث التفعيل";
    default:
      return "تمت مراجعته";
  }
}

function getQueueItemTone(
  status:
    | "needs_quick_review"
    | "needs_explicit_confirmation"
    | "needs_activation_refresh"
    | "reviewed",
  kind: "unit" | "concept" | "blueprint" | "support_level" | "activation",
) {
  if (status === "reviewed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  }

  if (status === "needs_activation_refresh") {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }

  if (kind === "support_level" || kind === "blueprint") {
    return "border-blue-200 bg-blue-50 text-blue-950";
  }

  return status === "needs_explicit_confirmation"
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-[var(--border)] bg-white/95 text-[var(--text)]";
}

function prioritizeUnitsForReview(input: {
  units: ResolvedUnit[];
  changedUnitIds: Set<string>;
  addedUnitIds: Set<string>;
  queueRequiresCompletion: boolean;
}) {
  if (!input.queueRequiresCompletion) {
    return input.units;
  }

  return input.units.slice().sort((left, right) => {
    const leftWeight = input.addedUnitIds.has(left.sourceUnitCandidateId)
      ? 2
      : input.changedUnitIds.has(left.sourceUnitCandidateId)
        ? 1
        : 0;
    const rightWeight = input.addedUnitIds.has(right.sourceUnitCandidateId)
      ? 2
      : input.changedUnitIds.has(right.sourceUnitCandidateId)
        ? 1
        : 0;

    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight;
    }

    return left.sequenceOrder - right.sequenceOrder;
  });
}

function prioritizeConceptsForReview(input: {
  concepts: ResolvedConcept[];
  changedConceptIds: Set<string>;
  addedConceptIds: Set<string>;
  queueRequiresCompletion: boolean;
}) {
  if (!input.queueRequiresCompletion) {
    return input.concepts;
  }

  return input.concepts.slice().sort((left, right) => {
    const leftWeight = input.addedConceptIds.has(left.sourceConceptCandidateId)
      ? 2
      : input.changedConceptIds.has(left.sourceConceptCandidateId)
        ? 1
        : 0;
    const rightWeight = input.addedConceptIds.has(right.sourceConceptCandidateId)
      ? 2
      : input.changedConceptIds.has(right.sourceConceptCandidateId)
        ? 1
        : 0;

    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight;
    }

    return left.sequenceOrder - right.sequenceOrder;
  });
}

function buildReviewState(extraction: CoursePackExtraction, confirmation: CoursePackConfirmation | null): ReviewState {
  const unitLabels = Object.fromEntries(extraction.units.map((unit) => [unit.unitCandidateId, unit.normalizedTitle || unit.rawTitle]));
  const conceptLabels = Object.fromEntries(extraction.concepts.map((concept) => [concept.conceptCandidateId, concept.learnerLabelCandidate]));
  const graphUnitIds = extraction.courseGraph?.units.slice().sort((left, right) => left.sequenceOrder - right.sequenceOrder).map((unit) => unit.sourceUnitCandidateId) ?? [];
  const graphConceptIds = extraction.courseGraph?.concepts.map((concept) => concept.sourceConceptCandidateId) ?? [];

  if (!confirmation) {
    return { confirmedUnitCandidateIds: [], confirmedConceptCandidateIds: [], unitLabels, conceptLabels, removedItemIds: [], irrelevantItemIds: [], reorderedUnitIds: graphUnitIds, mergeActions: [], examImportantConceptIds: [], acknowledgeLowConfidence: false };
  }

  return {
    confirmedUnitCandidateIds: confirmation.units.filter((unit) => unit.isLowConfidence).map((unit) => unit.sourceUnitCandidateId),
    confirmedConceptCandidateIds: confirmation.concepts.filter((concept) => concept.isLowConfidence).map((concept) => concept.sourceConceptCandidateId),
    unitLabels: { ...unitLabels, ...Object.fromEntries(confirmation.units.map((unit) => [unit.sourceUnitCandidateId, unit.label])) },
    conceptLabels: { ...conceptLabels, ...Object.fromEntries(confirmation.concepts.map((concept) => [concept.sourceConceptCandidateId, concept.label])) },
    removedItemIds: [
      ...graphUnitIds.filter((unitId) => !confirmation.units.some((unit) => unit.sourceUnitCandidateId === unitId)),
      ...graphConceptIds.filter((conceptId) => !confirmation.concepts.some((concept) => concept.sourceConceptCandidateId === conceptId)),
    ],
    irrelevantItemIds: [],
    reorderedUnitIds: confirmation.units.slice().sort((left, right) => left.sequenceOrder - right.sequenceOrder).map((unit) => unit.sourceUnitCandidateId),
    mergeActions: confirmation.concepts.filter((concept) => concept.mergedSourceConceptCandidateIds.length > 1).map((concept) => ({ targetSourceConceptCandidateId: concept.sourceConceptCandidateId, sourceConceptCandidateIds: concept.mergedSourceConceptCandidateIds })),
    examImportantConceptIds: confirmation.concepts.filter((concept) => concept.isExamImportant).map((concept) => concept.sourceConceptCandidateId),
    acknowledgeLowConfidence: confirmation.lowConfidenceAcknowledged,
  };
}

function resolveUnits(extraction: CoursePackExtraction, reviewState: ReviewState) {
  const graphUnitIds = extraction.courseGraph?.units.map((unit) => unit.sourceUnitCandidateId) ?? [];
  const includedIds = new Set([
    ...graphUnitIds,
    ...reviewState.confirmedUnitCandidateIds,
    ...reviewState.confirmedConceptCandidateIds.map((conceptId) => extraction.concepts.find((concept) => concept.conceptCandidateId === conceptId)?.unitCandidateId).filter((unitId): unitId is string => Boolean(unitId)),
  ]);
  for (const itemId of [...reviewState.removedItemIds, ...reviewState.irrelevantItemIds]) {
    includedIds.delete(itemId);
  }
  const orderedIds = [...reviewState.reorderedUnitIds.filter((unitId) => includedIds.has(unitId)), ...[...includedIds].filter((unitId) => !reviewState.reorderedUnitIds.includes(unitId))];
  return orderedIds.map((unitId, index) => {
    const extractedUnit = extraction.units.find((unit) => unit.unitCandidateId === unitId);
    const graphUnit = extraction.courseGraph?.units.find((unit) => unit.sourceUnitCandidateId === unitId);
    if (!extractedUnit && !graphUnit) {
      return null;
    }
    return {
      sourceUnitCandidateId: unitId,
      label: reviewState.unitLabels[unitId] ?? graphUnit?.label ?? extractedUnit?.normalizedTitle ?? extractedUnit?.rawTitle ?? "وحدة",
      defaultLabel: graphUnit?.label ?? extractedUnit?.normalizedTitle ?? extractedUnit?.rawTitle ?? "وحدة",
      sequenceOrder: index + 1,
      confidenceScore: graphUnit?.confidenceScore ?? extractedUnit?.confidenceScore ?? 0,
      isLowConfidence: (graphUnit?.confidenceScore ?? extractedUnit?.confidenceScore ?? 0) < 0.55,
      sourceEvidenceIds: graphUnit?.sourceEvidenceIds ?? extractedUnit?.sourceEvidenceIds ?? [],
    } satisfies ResolvedUnit;
  }).filter((unit): unit is ResolvedUnit => Boolean(unit));
}

function resolveConcepts(extraction: CoursePackExtraction, reviewState: ReviewState, includedUnits: ResolvedUnit[]) {
  const graphConceptIds = extraction.courseGraph?.concepts.map((concept) => concept.sourceConceptCandidateId) ?? [];
  const includedIds = new Set([...graphConceptIds, ...reviewState.confirmedConceptCandidateIds]);
  for (const itemId of [...reviewState.removedItemIds, ...reviewState.irrelevantItemIds]) {
    includedIds.delete(itemId);
  }
  const includedUnitIds = new Set(includedUnits.map((unit) => unit.sourceUnitCandidateId));
  return [...includedIds].map((conceptId) => {
    const extractedConcept = extraction.concepts.find((concept) => concept.conceptCandidateId === conceptId);
    const graphConcept = extraction.courseGraph?.concepts.find((concept) => concept.sourceConceptCandidateId === conceptId);
    const graphUnit = graphConcept?.unitId ? extraction.courseGraph?.units.find((unit) => unit.graphUnitId === graphConcept.unitId) : null;
    const sourceUnitCandidateId = extractedConcept?.unitCandidateId ?? graphUnit?.sourceUnitCandidateId ?? null;
    if (sourceUnitCandidateId && !includedUnitIds.has(sourceUnitCandidateId)) {
      return null;
    }
    return {
      sourceConceptCandidateId: conceptId,
      sourceUnitCandidateId,
      label: reviewState.conceptLabels[conceptId] ?? graphConcept?.label ?? extractedConcept?.learnerLabelCandidate ?? "مفهوم",
      defaultLabel: graphConcept?.label ?? extractedConcept?.learnerLabelCandidate ?? "مفهوم",
      normalizedLabel: graphConcept?.normalizedLabel ?? normalizeLabel(reviewState.conceptLabels[conceptId] ?? extractedConcept?.learnerLabelCandidate ?? ""),
      sequenceOrder: graphConcept?.sequenceOrder ?? extractedConcept?.sequenceOrderCandidate ?? 1,
      coachabilityStatus: graphConcept?.coachabilityStatus ?? extractedConcept?.coachabilityStatus ?? "partially_supported",
      assessmentRelevance: graphConcept?.assessmentRelevance ?? extractedConcept?.assessmentRelevanceCandidate ?? "unknown",
      confidenceScore: graphConcept?.confidenceScore ?? extractedConcept?.mappingConfidenceScore ?? 0,
      isLowConfidence: (graphConcept?.confidenceScore ?? extractedConcept?.mappingConfidenceScore ?? 0) < 0.55,
      isExamImportant: reviewState.examImportantConceptIds.includes(conceptId),
      sourceEvidenceIds: graphConcept?.sourceEvidenceIds ?? extractedConcept?.sourceEvidenceIds ?? [],
    } satisfies ResolvedConcept;
  }).filter((concept): concept is ResolvedConcept => Boolean(concept)).sort((left, right) => left.sequenceOrder - right.sequenceOrder);
}

function deriveMergeSuggestions(concepts: ResolvedConcept[]) {
  const groups = new Map<string, ResolvedConcept[]>();
  for (const concept of concepts) {
    const groupKey = `${concept.sourceUnitCandidateId ?? "none"}::${normalizeLabel(concept.label)}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)?.push(concept);
  }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => {
    const ordered = group.slice().sort((left, right) => left.sequenceOrder - right.sequenceOrder);
    return { targetSourceConceptCandidateId: ordered[0].sourceConceptCandidateId, sourceConceptCandidateIds: ordered.map((concept) => concept.sourceConceptCandidateId), labels: ordered.map((concept) => concept.label) };
  });
}

function buildConfirmationPayload(reviewState: ReviewState, includedUnits: ResolvedUnit[], includedConcepts: ResolvedConcept[]): CoursePackConfirmationPayload {
  const includedUnitIds = new Set(includedUnits.map((unit) => unit.sourceUnitCandidateId));
  const includedConceptIds = new Set(includedConcepts.map((concept) => concept.sourceConceptCandidateId));
  return {
    confirmedUnitCandidateIds: reviewState.confirmedUnitCandidateIds.filter((unitId) => includedUnitIds.has(unitId)),
    confirmedConceptCandidateIds: reviewState.confirmedConceptCandidateIds.filter((conceptId) => includedConceptIds.has(conceptId)),
    unitEdits: includedUnits.filter((unit) => reviewState.unitLabels[unit.sourceUnitCandidateId]?.trim() && reviewState.unitLabels[unit.sourceUnitCandidateId].trim() !== unit.defaultLabel).map((unit) => ({ sourceUnitCandidateId: unit.sourceUnitCandidateId, label: reviewState.unitLabels[unit.sourceUnitCandidateId].trim() })),
    conceptEdits: includedConcepts.filter((concept) => reviewState.conceptLabels[concept.sourceConceptCandidateId]?.trim() && reviewState.conceptLabels[concept.sourceConceptCandidateId].trim() !== concept.defaultLabel).map((concept) => ({ sourceConceptCandidateId: concept.sourceConceptCandidateId, label: reviewState.conceptLabels[concept.sourceConceptCandidateId].trim() })),
    removedItemIds: reviewState.removedItemIds,
    reorderedUnitIds: includedUnits.map((unit) => unit.sourceUnitCandidateId),
    mergeActions: reviewState.mergeActions.filter((action) => includedConceptIds.has(action.targetSourceConceptCandidateId)),
    examImportantConceptIds: reviewState.examImportantConceptIds.filter((conceptId) => includedConceptIds.has(conceptId)),
    irrelevantItemIds: reviewState.irrelevantItemIds,
    acknowledgeLowConfidence: reviewState.acknowledgeLowConfidence,
  };
}

function addUniqueId(current: string[], itemId: string) {
  return current.includes(itemId) ? current : [...current, itemId];
}

function moveUnitInOrder(unitIds: string[], sourceUnitCandidateId: string, direction: -1 | 1) {
  const currentIndex = unitIds.indexOf(sourceUnitCandidateId);
  if (currentIndex < 0) {
    return unitIds;
  }
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= unitIds.length) {
    return unitIds;
  }
  const reorderedUnitIds = unitIds.slice();
  const [movedUnitId] = reorderedUnitIds.splice(currentIndex, 1);
  reorderedUnitIds.splice(nextIndex, 0, movedUnitId);
  return reorderedUnitIds;
}

function stripConceptFromMergeActions(mergeActions: ReviewState["mergeActions"], sourceConceptCandidateId: string) {
  return mergeActions.filter((action) => action.targetSourceConceptCandidateId !== sourceConceptCandidateId).map((action) => ({
    ...action,
    sourceConceptCandidateIds: action.sourceConceptCandidateIds.filter((conceptId) => conceptId !== sourceConceptCandidateId),
  })).filter((action) => action.sourceConceptCandidateIds.length > 1);
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}
