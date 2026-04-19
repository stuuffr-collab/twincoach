"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  submitOnboarding,
  type BiggestDifficulty,
  type CurrentComfortLevel,
  type HelpKind,
  type PriorProgrammingExposure,
} from "@/src/lib/api";

const priorProgrammingExposureOptions: Array<{
  value: PriorProgrammingExposure;
  label: string;
  helper: string;
}> = [
  {
    value: "none",
    label: "لم أدرس البرمجة من قبل",
    helper: "سنبدأ بهدوء من الأساس ونختار لك مدخلًا واضحًا.",
  },
  {
    value: "school_basics",
    label: "أساسيات دراسية بسيطة",
    helper: "سنفترض أنك رأيت أمثلة وتمارين قصيرة من قبل.",
  },
  {
    value: "self_taught_basics",
    label: "أساسيات تعلّمتها ذاتيًا",
    helper: "سنحافظ على بداية مرنة تناسب من جرّب التعلم بمفرده.",
  },
  {
    value: "completed_intro_course",
    label: "أنهيت مقررًا تمهيديًا",
    helper: "سنبدأ من مستوى أكثر ثباتًا دون افتراض تقدّم زائد.",
  },
];

const comfortLevelOptions: Array<{
  value: CurrentComfortLevel;
  label: string;
  helper: string;
}> = [
  {
    value: "very_low",
    label: "منخفض جدًا",
    helper: "سنخفف البداية ونجعل أول خطوة واضحة وغير ضاغطة.",
  },
  {
    value: "low",
    label: "منخفض",
    helper: "سنختار لك وتيرة هادئة مع دعم أوضح عند التعثر.",
  },
  {
    value: "medium",
    label: "متوسط",
    helper: "سنثبت التقدّم ونوجّه التدريب نحو الفكرة الأهم الآن.",
  },
];

const biggestDifficultyOptions: Array<{
  value: BiggestDifficulty;
  label: string;
  helper: string;
}> = [
  {
    value: "reading_code",
    label: "قراءة الكود",
    helper: "سنستخدم تدريبًا يوضّح ما يحدث سطرًا بعد سطر.",
  },
  {
    value: "writing_syntax",
    label: "كتابة صياغة بايثون",
    helper: "سنخفف الحمل على الصياغة ونبنيها خطوة خطوة.",
  },
  {
    value: "tracing_logic",
    label: "تتبّع المنطق والقيم",
    helper: "سنركّز على فهم تغيّر القيم ومسار التنفيذ بوضوح أكبر.",
  },
  {
    value: "debugging_errors",
    label: "إصلاح الأخطاء",
    helper: "سنختار نمط دعم يساعدك تعرف الخطوة التالية عند الخطأ.",
  },
];

const preferredHelpStyleOptions: Array<{
  value: HelpKind;
  label: string;
  helper: string;
}> = [
  {
    value: "step_breakdown",
    label: "تفكيك الخطوات",
    helper: "تفضّل أن نجزّئ الفكرة إلى خطوات صغيرة وواضحة.",
  },
  {
    value: "worked_example",
    label: "مثال محلول",
    helper: "تفهم أسرع عندما ترى مثالًا واضحًا قبل المحاولة.",
  },
  {
    value: "debugging_hint",
    label: "تلميح للإصلاح",
    helper: "تفضّل تلميحًا قصيرًا يقودك إلى التعديل التالي.",
  },
  {
    value: "concept_explanation",
    label: "شرح الفكرة",
    helper: "ترتاح عندما نفك الفكرة أولًا قبل إعادة المحاولة.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [priorProgrammingExposure, setPriorProgrammingExposure] = useState<
    PriorProgrammingExposure | ""
  >("");
  const [currentComfortLevel, setCurrentComfortLevel] = useState<
    CurrentComfortLevel | ""
  >("");
  const [biggestDifficulty, setBiggestDifficulty] = useState<
    BiggestDifficulty | ""
  >("");
  const [preferredHelpStyle, setPreferredHelpStyle] = useState<HelpKind | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isFormValid = useMemo(() => {
    return Boolean(
      priorProgrammingExposure &&
        currentComfortLevel &&
        biggestDifficulty &&
        preferredHelpStyle,
    );
  }, [
    biggestDifficulty,
    currentComfortLevel,
    preferredHelpStyle,
    priorProgrammingExposure,
  ]);

  async function handleSubmit() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const onboardingPayload = {
        priorProgrammingExposure: priorProgrammingExposure as PriorProgrammingExposure,
        currentComfortLevel: currentComfortLevel as CurrentComfortLevel,
        biggestDifficulty: biggestDifficulty as BiggestDifficulty,
        preferredHelpStyle: preferredHelpStyle as HelpKind,
      };

      const payload = await submitOnboarding({
        ...onboardingPayload,
      });

      router.replace(payload.nextRoute);
    } catch {
      setError("تعذّر حفظ بداية المسار الآن. جرّب مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StudentShell>
      <PageHeader
        detail="هذه ليست استمارة طويلة ولا تصنيفًا لك. أربع اختيارات قصيرة فقط تساعد TwinCoach يفهم من أين يبدأ معك وكيف يوجّه تدريبك الأول في بايثون."
        eyebrow="بداية المسار"
        subtitle="نلتقط أول إشارة عن طريقتك في التعلّم حتى نختار سرعة البداية وشكل الدعم الأنسب لك."
        title="نضبط نقطة انطلاقك في البرمجة"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="rounded-[2rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Python CS1
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              أقل من دقيقة
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              4 اختيارات
            </span>
          </div>
          <div className="mt-4 text-lg font-semibold leading-8 text-[var(--text)]">
            من هنا يبدأ مسار تدريبك الشخصي. نستخدم هذه البداية لنرسم أول صورة موثوقة
            عن الطريقة الأنسب لتوجيه ممارستك في بايثون.
          </div>
          <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            لسنا نحاول أن نضع عليك حكمًا. نحن فقط نضبط بداية هادئة لخطوة التهيئة
            الأولى، ولنمط التدريب الأول، ولنمط الدعم الذي يفيدك أكثر عندما تتعثر.
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 shadow-sm">
          <div className="mb-5">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              ما الذي نحتاج معرفته أولًا؟
            </div>
            <div className="mt-2 text-base font-semibold leading-7 text-[var(--text)]">
              اختر أربع إشارات تساعدنا نوجّه أول خطوة تدريبية لك بشكل أدق.
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                خبرتك السابقة
              </span>
              <span className="text-base font-semibold leading-7 text-[var(--text)]">
                ما مقدار تعرّضك للبرمجة حتى الآن؟
              </span>
              <span className="text-sm leading-7 text-[var(--text-muted)]">
                اختر الأقرب لحالتك. هذا يحدد سرعة البداية المناسبة.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setPriorProgrammingExposure(
                    event.target.value as PriorProgrammingExposure | "",
                  )
                }
                value={priorProgrammingExposure}
              >
                <option value="">اختر مستوى خبرتك السابقة</option>
                {priorProgrammingExposureOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {priorProgrammingExposure ? (
                <span className="text-sm leading-7 text-[var(--text-muted)]">
                  {
                    priorProgrammingExposureOptions.find(
                      (option) => option.value === priorProgrammingExposure,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                مستوى الارتياح الحالي
              </span>
              <span className="text-base font-semibold leading-7 text-[var(--text)]">
                كيف تشعر الآن مع بايثون؟
              </span>
              <span className="text-sm leading-7 text-[var(--text-muted)]">
                هذا يساعدنا نجعل بداية التهيئة عادلة وواضحة.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setCurrentComfortLevel(
                    event.target.value as CurrentComfortLevel | "",
                  )
                }
                value={currentComfortLevel}
              >
                <option value="">اختر مستوى ارتياحك الحالي</option>
                {comfortLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {currentComfortLevel ? (
                <span className="text-sm leading-7 text-[var(--text-muted)]">
                  {
                    comfortLevelOptions.find(
                      (option) => option.value === currentComfortLevel,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                موضع التعثر الأكبر
              </span>
              <span className="text-base font-semibold leading-7 text-[var(--text)]">
                ما الذي يبدو أصعب عليك عند دراسة البرمجة؟
              </span>
              <span className="text-sm leading-7 text-[var(--text-muted)]">
                من هنا نعرف أين يجب أن يبدأ الدعم أولًا.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setBiggestDifficulty(
                    event.target.value as BiggestDifficulty | "",
                  )
                }
                value={biggestDifficulty}
              >
                <option value="">اختر موضع التعثر الأكبر</option>
                {biggestDifficultyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {biggestDifficulty ? (
                <span className="text-sm leading-7 text-[var(--text-muted)]">
                  {
                    biggestDifficultyOptions.find(
                      (option) => option.value === biggestDifficulty,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                شكل الدعم الأنسب لك
              </span>
              <span className="text-base font-semibold leading-7 text-[var(--text)]">
                عندما تتعثر، ما نوع المساعدة الذي يفيدك أكثر؟
              </span>
              <span className="text-sm leading-7 text-[var(--text-muted)]">
                سنفضّل هذا الشكل عندما نقدّم لك دعمًا أثناء التدريب.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setPreferredHelpStyle(event.target.value as HelpKind | "")
                }
                value={preferredHelpStyle}
              >
                <option value="">اختر شكل الدعم الذي تفضّله</option>
                {preferredHelpStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {preferredHelpStyle ? (
                <span className="text-sm leading-7 text-[var(--text-muted)]">
                  {
                    preferredHelpStyleOptions.find(
                      (option) => option.value === preferredHelpStyle,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>
          </div>
        </div>

        {error ? (
          <StatePanel
            description={error}
            eyebrow="مشكلة مؤقتة"
            title="تعذّر حفظ بداية المسار الآن."
            tone="error"
          />
        ) : null}
      </section>
      <StickyActionBar
        disabled={!isFormValid || isSubmitting}
        label={isSubmitting ? "نحفظ بداية المسار..." : "ابدأ تهيئة مساري"}
        onClick={handleSubmit}
        supportingText="بعدها نأخذك إلى خطوة تهيئة قصيرة تبني أول صورة عن حالتك البرمجية."
      />
    </StudentShell>
  );
}
