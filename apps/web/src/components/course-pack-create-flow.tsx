"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StudentShell } from "@/src/components/student-shell";
import {
  activateCoursePack,
  ApiError,
  archiveCoursePack,
  clearRecentCoursePackId,
  createCoursePack,
  ensureLearnerIdentity,
  fetchCoursePacks,
  getRecentCoursePackId,
  setRecentCoursePackId,
  type CoursePackReadinessState,
  type CoursePackRecord,
  type CoursePackSupportLevel,
} from "@/src/lib/api";
import {
  describePackDrift,
  describeSupportLevel,
  formatActiveContextState,
  formatDriftStatus,
  formatLifecycleState,
  formatReadinessState,
  formatSupportLevel,
  getDriftTone,
  getSupportLevelTone,
} from "@/src/lib/course-pack-ui";

type CreateFormState = {
  courseTitle: string;
  courseCode: string;
  institutionLabel: string;
  termLabel: string;
  primaryLanguage: string;
};

type PackStatusCue = {
  label: string;
  description: string;
  toneClassName: string;
};

type ActivationState = {
  canActivate: boolean;
  reason: string;
};

const initialFormState: CreateFormState = {
  courseTitle: "",
  courseCode: "",
  institutionLabel: "",
  termLabel: "",
  primaryLanguage: "ar",
};

export function CoursePackCreateFlow() {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormState>(initialFormState);
  const [coursePacks, setCoursePacks] = useState<CoursePackRecord[]>([]);
  const [recentCoursePackId, setLocalRecentCoursePackId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingPackId, setProcessingPackId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCoursePackManagement() {
      try {
        await ensureLearnerIdentity();
        const packs = await fetchCoursePacks();

        if (cancelled) {
          return;
        }

        setCoursePacks(packs);
        setLocalRecentCoursePackId(getRecentCoursePackId());
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "تعذر تحميل حزم المقررات الآن. حاول مرة أخرى بعد لحظة.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCoursePackManagement();

    return () => {
      cancelled = true;
    };
  }, []);

  const activePack = useMemo(
    () => coursePacks.find((pack) => pack.isActive) ?? null,
    [coursePacks],
  );
  const visiblePacks = useMemo(
    () => coursePacks.filter((pack) => !pack.archivedAt),
    [coursePacks],
  );
  const archivedPacks = useMemo(
    () => coursePacks.filter((pack) => Boolean(pack.archivedAt)),
    [coursePacks],
  );
  const recentPack = useMemo(
    () =>
      recentCoursePackId
        ? coursePacks.find((pack) => pack.coursePackId === recentCoursePackId) ?? null
        : null,
    [coursePacks, recentCoursePackId],
  );

  async function refreshCoursePacks() {
    const packs = await fetchCoursePacks();
    setCoursePacks(packs);
    setLocalRecentCoursePackId(getRecentCoursePackId());
  }

  async function handleCreateCoursePack() {
    if (submitting || !form.courseTitle.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");
    setStatusMessage("");

    try {
      const coursePack = await createCoursePack({
        courseTitle: form.courseTitle.trim(),
        courseCode: form.courseCode.trim() || undefined,
        institutionLabel: form.institutionLabel.trim() || undefined,
        termLabel: form.termLabel.trim() || undefined,
        primaryLanguage: form.primaryLanguage,
      });

      setRecentCoursePackId(coursePack.coursePackId);
      router.replace(`/course-pack/${coursePack.coursePackId}`);
    } catch (createError) {
      setError(
        createError instanceof ApiError
          ? createError.message
          : "تعذر إنشاء حزمة المقرر الآن. حاول مرة أخرى.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivatePack(coursePack: CoursePackRecord) {
    if (processingPackId) {
      return;
    }

    setProcessingPackId(coursePack.coursePackId);
    setError("");
    setStatusMessage("");

    try {
      await activateCoursePack({
        coursePackId: coursePack.coursePackId,
      });
      setRecentCoursePackId(coursePack.coursePackId);
      router.replace("/today");
    } catch (activationError) {
      setError(
        activationError instanceof ApiError
          ? activationError.message
          : "تعذر تبديل المقرر النشط الآن. حاول مرة أخرى.",
      );
    } finally {
      setProcessingPackId("");
    }
  }

  async function handleArchivePack(coursePack: CoursePackRecord) {
    if (processingPackId) {
      return;
    }

    setProcessingPackId(coursePack.coursePackId);
    setError("");
    setStatusMessage("");

    try {
      await archiveCoursePack(coursePack.coursePackId);

      if (recentCoursePackId === coursePack.coursePackId) {
        clearRecentCoursePackId();
      }

      await refreshCoursePacks();
      setStatusMessage("تم إخفاء هذه الحزمة من القائمة النشطة. يمكنك فتحها لاحقًا من القسم المؤرشف.");
    } catch (archiveError) {
      setError(
        archiveError instanceof ApiError
          ? archiveError.message
          : "تعذر أرشفة هذه الحزمة الآن.",
      );
    } finally {
      setProcessingPackId("");
    }
  }

  function handleOpenPack(coursePackId: string) {
    setRecentCoursePackId(coursePackId);
    router.push(`/course-pack/${coursePackId}`);
  }

  return (
    <StudentShell>
      <PageHeader
        eyebrow="مقرراتك"
        subtitle="هنا ترى كل حزم المقررات التي أنشأتها، وتختار أيها يكون هو السياق النشط داخل TwinCoach."
        title="إدارة حزم المقررات"
        detail="التبديل هنا يغيّر المقرر النشط عبر Today والجلسات والملخص وملفك الخفيف، من دون أن يغيّر ملفاتك أو مراجعتك المؤكدة."
      />

      <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
        {loading ? (
          <StatePanel
            eyebrow="حزم المقررات"
            title="نجمع حزم المقررات الخاصة بك"
            description="هذه خطوة قصيرة لعرض الحزمة النشطة والحزم الجاهزة أو المتوقفة بوضوح."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            eyebrow="حزم المقررات"
            title="تعذر فتح لوحة المقررات الآن"
            description={error}
            tone="error"
          />
        ) : null}

        {statusMessage ? (
          <StatePanel
            eyebrow="حزم المقررات"
            title="تم تحديث الحالة"
            description={statusMessage}
            tone="recovery"
          />
        ) : null}

        {activePack ? (
          <div className="motion-rise rounded-[1.9rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-xs font-semibold text-emerald-900">
              المقرر النشط الآن
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-emerald-950">
                {activePack.courseTitle}
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportLevelTone(getEffectiveSupportLevel(activePack))}`}
              >
                {formatSupportLevel(getEffectiveSupportLevel(activePack))}
              </span>
            </div>
            <div className="mt-3 text-sm leading-7 text-emerald-950">
              هذا هو المقرر الذي يوجّه Today والجلسات والملخص الآن. إذا فعّلت مقررًا آخر من القائمة، فسيصبح هو السياق النشط بدلًا منه.
            </div>
            {activePack.driftStatus !== "clean" ||
            activePack.activeContextState === "stale" ? (
              <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-white/80 p-3 text-sm leading-7 text-emerald-950">
                {describePackDrift(activePack)}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                href="/today"
              >
                تابع داخل TwinCoach
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5"
                href={`/course-pack/${activePack.coursePackId}`}
                onClick={() => setRecentCoursePackId(activePack.coursePackId)}
              >
                افتح مساحة هذا المقرر
              </Link>
            </div>
          </div>
        ) : null}

        {recentPack && !recentPack.isActive ? (
          <div className="motion-rise rounded-[1.75rem] border border-[var(--border)] bg-white/88 p-5 shadow-sm">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              متابعة سريعة
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--text)]">
              آخر حزمة عملت عليها: {recentPack.courseTitle}
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              يمكنك الرجوع مباشرة إلى مساحة هذه الحزمة، أو تفعيلها إذا كانت جاهزة لذلك.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => handleOpenPack(recentPack.coursePackId)}
                type="button"
              >
                افتح آخر حزمة
              </button>
              {getActivationState(recentPack).canActivate ? (
                <button
                  className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={processingPackId === recentPack.coursePackId}
                  onClick={() => void handleActivatePack(recentPack)}
                  type="button"
                >
                  {processingPackId === recentPack.coursePackId
                    ? "نفعّل هذا المقرر..."
                    : "فعّل آخر حزمة"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="motion-rise-delay-1 stage-card rounded-[2rem] p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                حزم المقررات الحالية
              </div>
              <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                كل حزمة تمثّل مقررًا أكاديميًا واحدًا
              </div>
            </div>
            <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)] shadow-sm">
              {coursePacks.length} حزمة
            </span>
          </div>

          {!loading && visiblePacks.length === 0 ? (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white/80 p-5 text-sm leading-7 text-[var(--text-muted)]">
              لا توجد لديك حزم مقررات بعد. ابدأ بإنشاء حزمة جديدة في القسم التالي.
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {visiblePacks.map((coursePack) => {
              const supportLevel = getEffectiveSupportLevel(coursePack);
              const statusCue = getPackStatusCue(coursePack);
              const activationState = getActivationState(coursePack);
              const archiveAllowed =
                !coursePack.isActive && coursePack.lifecycleState !== "archived";

              return (
                <div
                  key={coursePack.coursePackId}
                  className={`rounded-[1.6rem] border p-4 shadow-sm ${
                    coursePack.isActive
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[var(--border)] bg-white/92"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-[var(--text)]">
                          {coursePack.courseTitle}
                        </div>
                        {coursePack.courseCode ? (
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                            {coursePack.courseCode}
                          </span>
                        ) : null}
                        {coursePack.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900">
                            نشط الآن
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportLevelTone(supportLevel)}`}
                        >
                          {formatSupportLevel(supportLevel)}
                        </span>
                        <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                          {formatLifecycleState(coursePack.lifecycleState)}
                        </span>
                        <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                          {formatReadinessState(coursePack.readinessState)}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusCue.toneClassName}`}
                        >
                          {statusCue.label}
                        </span>
                        {coursePack.driftStatus !== "clean" ? (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDriftTone(coursePack.driftStatus)}`}
                          >
                            {formatDriftStatus(coursePack.driftStatus)}
                          </span>
                        ) : null}
                        {coursePack.activeContextState === "stale" ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950">
                            {formatActiveContextState(coursePack.activeContextState)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-left text-xs leading-6 text-[var(--text-muted)]">
                      <div>آخر تحديث</div>
                      <div className="font-semibold text-[var(--text)]">
                        {formatUpdatedAt(coursePack.updatedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {statusCue.description}
                  </div>

                  {coursePack.driftStatus !== "clean" ||
                  coursePack.activeContextState === "stale" ? (
                    <div className="mt-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
                      {describePackDrift(coursePack)}
                    </div>
                  ) : null}

                  {supportLevel ? (
                    <div className="mt-3 rounded-[1.2rem] border border-[var(--border)] bg-white/85 p-3 text-sm leading-7 text-[var(--text)] shadow-sm">
                      {describeSupportLevel(supportLevel)}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-[var(--text-muted)]">
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 shadow-sm">
                      {coursePack.documentCount} ملف
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 shadow-sm">
                      {coursePack.confirmedUnitCount} وحدة مؤكدة
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 shadow-sm">
                      {coursePack.confirmedConceptCount} مفهوم مؤكد
                    </span>
                    {coursePack.unsupportedTopicCount > 0 ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900 shadow-sm">
                        {coursePack.unsupportedTopicCount} موضوعات غير مدعومة بالكامل
                      </span>
                    ) : null}
                  </div>

                  {!coursePack.isActive && activationState.reason ? (
                    <div className="mt-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-900">
                      {activationState.reason}
                    </div>
                  ) : null}

                  {activationState.canActivate ? (
                    <div className="mt-3 rounded-[1.2rem] border border-blue-200 bg-blue-50 p-3 text-sm leading-7 text-blue-950">
                      تفعيل هذه الحزمة سيجعل هذا المقرر هو السياق النشط في Today والجلسات والملخص وملفك الخفيف. يمكنك العودة إلى أي حزمة أخرى جاهزة لاحقًا من هنا.
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {coursePack.isActive ? (
                      <Link
                        className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        href="/today"
                      >
                        تابع هذا المقرر
                      </Link>
                    ) : activationState.canActivate ? (
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={processingPackId === coursePack.coursePackId}
                        onClick={() => void handleActivatePack(coursePack)}
                        type="button"
                      >
                        {processingPackId === coursePack.coursePackId
                          ? "نفعّل هذا المقرر..."
                          : "فعّل هذا المقرر"}
                      </button>
                    ) : (
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        onClick={() => handleOpenPack(coursePack.coursePackId)}
                        type="button"
                      >
                        {getWorkspaceActionLabel(coursePack)}
                      </button>
                    )}

                    <button
                      className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      onClick={() => handleOpenPack(coursePack.coursePackId)}
                      type="button"
                    >
                      افتح مساحة الحزمة
                    </button>

                    {archiveAllowed ? (
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={processingPackId === coursePack.coursePackId}
                        onClick={() => void handleArchivePack(coursePack)}
                        type="button"
                      >
                        {processingPackId === coursePack.coursePackId
                          ? "نؤرشف الحزمة..."
                          : "أرشف هذه الحزمة"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {archivedPacks.length > 0 ? (
          <div className="motion-rise-delay-2 rounded-[1.75rem] border border-[var(--border)] bg-white/85 p-5 shadow-sm">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              الحزم المؤرشفة
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              هذه الحزم مخفية من المسار النشط، لكنها ما زالت متاحة للفتح أو لإعادة التفعيل إذا كانت جاهزة.
            </div>
            <div className="mt-4 space-y-3">
              {archivedPacks.map((coursePack) => {
                const activationState = getActivationState(coursePack);
                const supportLevel = getEffectiveSupportLevel(coursePack);

                return (
                  <div
                    key={coursePack.coursePackId}
                    className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">
                          {coursePack.courseTitle}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900">
                            مؤرشف
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getSupportLevelTone(supportLevel)}`}
                          >
                            {formatSupportLevel(supportLevel)}
                          </span>
                        </div>
                      </div>
                      <div className="text-left text-xs text-[var(--text-muted)]">
                        {formatUpdatedAt(coursePack.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        onClick={() => handleOpenPack(coursePack.coursePackId)}
                        type="button"
                      >
                        افتح الحزمة
                      </button>
                      {activationState.canActivate ? (
                        <button
                          className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={processingPackId === coursePack.coursePackId}
                          onClick={() => void handleActivatePack(coursePack)}
                          type="button"
                        >
                          {processingPackId === coursePack.coursePackId
                            ? "نعيد التفعيل..."
                            : "فعّل مجددًا"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="motion-rise-delay-3 stage-card rounded-[2rem] p-5 md:p-6">
          <div className="text-xs font-semibold text-[var(--text-muted)]">
            حزمة مقرر جديدة
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">
            أنشئ حزمة لمقرر أكاديمي واحد
          </div>
          <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
            حزمة المقرر تعني: ملفات PDF لمادة واحدة فعلية. سنستخدمها لبناء هيكل المقرر وخريطة تركيز للاختبار، ثم نطلب منك مراجعتها قبل أي تفعيل.
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-right">
              <span className="text-sm font-semibold text-[var(--text)]">
                عنوان المقرر
              </span>
              <input
                className="min-h-12 rounded-[1.15rem] border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    courseTitle: event.target.value,
                  }))
                }
                placeholder="مثال: مبادئ الاقتصاد الجزئي"
                type="text"
                value={form.courseTitle}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-right">
                <span className="text-sm font-semibold text-[var(--text)]">
                  رمز المقرر (اختياري)
                </span>
                <input
                  className="min-h-12 rounded-[1.15rem] border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      courseCode: event.target.value,
                    }))
                  }
                  placeholder="ECON 101"
                  type="text"
                  value={form.courseCode}
                />
              </label>

              <label className="grid gap-2 text-right">
                <span className="text-sm font-semibold text-[var(--text)]">
                  اللغة الأساسية
                </span>
                <select
                  className="min-h-12 rounded-[1.15rem] border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      primaryLanguage: event.target.value,
                    }))
                  }
                  value={form.primaryLanguage}
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-right">
                <span className="text-sm font-semibold text-[var(--text)]">
                  الجهة أو الكلية (اختياري)
                </span>
                <input
                  className="min-h-12 rounded-[1.15rem] border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      institutionLabel: event.target.value,
                    }))
                  }
                  placeholder="جامعة أو كلية"
                  type="text"
                  value={form.institutionLabel}
                />
              </label>

              <label className="grid gap-2 text-right">
                <span className="text-sm font-semibold text-[var(--text)]">
                  الفصل أو الفترة (اختياري)
                </span>
                <input
                  className="min-h-12 rounded-[1.15rem] border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      termLabel: event.target.value,
                    }))
                  }
                  placeholder="ربيع 2026"
                  type="text"
                  value={form.termLabel}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !form.courseTitle.trim()}
              onClick={() => void handleCreateCoursePack()}
              type="button"
            >
              {submitting ? "ننشىء الحزمة..." : "ابدأ حزمة جديدة"}
            </button>
            <span className="inline-flex items-center text-sm text-[var(--text-muted)]">
              سنفتح لك مباشرة مساحة رفع الملفات ومراجعة الخريطة.
            </span>
          </div>
        </div>
      </section>
    </StudentShell>
  );
}

function getEffectiveSupportLevel(
  coursePack: CoursePackRecord,
): CoursePackSupportLevel | null {
  return coursePack.supportLevelFinal ?? coursePack.supportLevelCandidate;
}

function getPackStatusCue(coursePack: CoursePackRecord): PackStatusCue {
  if (coursePack.requiresReconfirmation) {
    return {
      label: "تحتاج مراجعة جديدة",
      description: describePackDrift(coursePack),
      toneClassName: "border-rose-300 bg-rose-100 text-rose-950",
    };
  }

  if (coursePack.driftStatus === "pending_refresh") {
    return {
      label: "تحتاج تحديث الخريطة",
      description: describePackDrift(coursePack),
      toneClassName: "border-amber-300 bg-amber-100 text-amber-950",
    };
  }

  if (coursePack.activeContextState === "stale") {
    return {
      label: "التفعيل يحتاج تحديثًا",
      description: describePackDrift(coursePack),
      toneClassName: "border-blue-300 bg-blue-100 text-blue-950",
    };
  }

  if (coursePack.isActive) {
    return {
      label: "نشط الآن",
      description:
        "هذه الحزمة هي التي يعتمد عليها TwinCoach الآن عبر Today والجلسات والملخص.",
      toneClassName: "border-emerald-300 bg-emerald-100 text-emerald-950",
    };
  }

  if (coursePack.lifecycleState === "archived") {
    return {
      label: "مؤرشف",
      description:
        "هذه الحزمة مخفية من المسار النشط حاليًا، لكنها ما زالت متاحة للفتح أو لإعادة التفعيل إذا كانت جاهزة.",
      toneClassName: "border-slate-300 bg-slate-100 text-slate-900",
    };
  }

  if (
    coursePack.readinessState === "activation_ready" &&
    getEffectiveSupportLevel(coursePack) !== "not_ready"
  ) {
    return {
      label: "جاهز للتفعيل",
      description:
        "يمكنك جعل هذا المقرر هو السياق النشط الآن، لأن المراجعة المؤكدة ومستوى الدعم يسمحان بذلك.",
      toneClassName: "border-blue-300 bg-blue-100 text-blue-950",
    };
  }

  if (
    coursePack.readinessState === "review_ready" ||
    coursePack.lifecycleState === "awaiting_confirmation"
  ) {
    return {
      label: "جاهز للمراجعة",
      description:
        "الخريطة وخريطة التركيز أصبحتا جاهزتين، وما زالت هذه الحزمة تحتاج مراجعتك قبل أن تصبح قابلة للتفعيل.",
      toneClassName: "border-violet-300 bg-violet-100 text-violet-950",
    };
  }

  if (coursePack.readinessState === "awaiting_extraction") {
    return {
      label: "جاهز لبناء الخريطة",
      description:
        "الملفات وأنواعها تبدو كافية الآن. افتح الحزمة لتبني TwinCoach خريطة المقرر وخريطة التركيز.",
      toneClassName: "border-cyan-300 bg-cyan-100 text-cyan-950",
    };
  }

  if (coursePack.readinessState === "awaiting_roles") {
    return {
      label: "ينتظر تصحيح نوع الملفات",
      description:
        "ما زلنا نحتاج منك تأكيد نوع بعض الملفات قبل أن نكمل البناء بشكل موثوق.",
      toneClassName: "border-amber-300 bg-amber-100 text-amber-950",
    };
  }

  if (coursePack.readinessState === "awaiting_documents") {
    return {
      label: "ينتظر ملفات",
      description:
        "هذه الحزمة لم تحصل بعد على ملفات كافية لنبدأ فهم المقرر منها.",
      toneClassName: "border-slate-300 bg-slate-100 text-slate-900",
    };
  }

  return {
    label: "متوقف مؤقتًا",
    description:
      "هذه الحزمة تحتاج تصحيح ملف أو استكمال خطوة قبل أن نستخدمها بشكل آمن داخل TwinCoach.",
    toneClassName: "border-rose-300 bg-rose-100 text-rose-950",
  };
}

function getActivationState(coursePack: CoursePackRecord): ActivationState {
  if (coursePack.isActive) {
    return {
      canActivate: false,
      reason: "",
    };
  }

  if (coursePack.driftStatus === "pending_refresh") {
    return {
      canActivate: false,
      reason:
        "قبل التفعيل نحتاج أولًا إلى إعادة بناء الخريطة من الملفات المحدثة، حتى لا يعتمد TwinCoach على نسخة قديمة من هذه الحزمة.",
    };
  }

  if (coursePack.requiresReconfirmation || coursePack.driftStatus === "review_required") {
    return {
      canActivate: false,
      reason:
        "هذه الحزمة تغيّرت بما يكفي لتحتاج مراجعة جديدة قبل التفعيل. افتح الحزمة وراجع التغييرات المؤثرة أولًا.",
    };
  }

  const supportLevel = getEffectiveSupportLevel(coursePack);

  if (supportLevel === "not_ready") {
    return {
      canActivate: false,
      reason:
        "مستوى الدعم الحالي لهذه الحزمة غير جاهز للتفعيل بعد. افتح الحزمة لمراجعة السبب أو استكمال الخطوة الناقصة.",
    };
  }

  if (coursePack.readinessState !== "activation_ready") {
    return {
      canActivate: false,
      reason: getReadinessExplanation(coursePack.readinessState),
    };
  }

  return {
    canActivate: true,
    reason: "",
  };
}

function getWorkspaceActionLabel(coursePack: CoursePackRecord) {
  switch (coursePack.readinessState) {
    case "awaiting_documents":
    case "awaiting_roles":
    case "awaiting_extraction":
      return "أكمل هذه الحزمة";
    case "review_ready":
      return "راجع هذه الحزمة";
    case "blocked":
      return "راجع سبب التوقف";
    default:
      return "افتح هذه الحزمة";
  }
}

function getReadinessExplanation(readinessState: CoursePackReadinessState) {
  switch (readinessState) {
    case "awaiting_documents":
      return "هذه الحزمة ما زالت تنتظر رفع ملفات المقرر أولًا.";
    case "awaiting_roles":
      return "هذه الحزمة ما زالت تنتظر منك مراجعة نوع الملفات قبل أن تصبح جاهزة.";
    case "awaiting_extraction":
      return "هذه الحزمة جاهزة لبناء الخريطة، لكنها لم تصل بعد إلى مراجعة قابلة للتفعيل.";
    case "review_ready":
      return "الخريطة جاهزة، لكنك ما زلت بحاجة إلى حفظ مراجعتك المؤكدة قبل التفعيل.";
    case "blocked":
      return "هذه الحزمة متوقفة حاليًا بسبب ملف أو دور ملف يحتاج تصحيحًا.";
    case "activation_ready":
      return "";
  }
}

function formatUpdatedAt(dateValue: string) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}
