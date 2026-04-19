import type { PackProgressMemory } from "@/src/lib/api";

type MemorySurface = "today" | "profile" | "workspace";

export function getPackProgressMemoryPresentation(
  surface: MemorySurface,
  input: {
    courseTitle: string;
    currentFocusLabel: string;
    memory: PackProgressMemory;
  },
) {
  const titleMap: Record<MemorySurface, string> = {
    today: "ما الذي نبني عليه الآن؟",
    profile: "ما الذي حافظ على استمراره مؤخرًا؟",
    workspace: "ذاكرة هذا المقرر مؤخرًا",
  };

  const description =
    input.memory.carryForward != null
      ? `TwinCoach لا يبدأ من الصفر هنا. التركيز الحالي في ${input.courseTitle} يبني على ${input.memory.carryForward.label} مما ظهر معك مؤخرًا.`
      : input.memory.recentlyStabilized != null
        ? `نعرض هنا آخر ما استقر مؤخرًا داخل ${input.courseTitle} حتى يبقى انتقالك إلى الخطوة الحالية واضحًا ومقصودًا.`
        : `نعرض هنا آخر المساحات التي عملت عليها داخل ${input.courseTitle} حتى يبقى انتقال TwinCoach واضحًا وغير مفاجئ.`;

  return {
    title: titleMap[surface],
    description,
    carryForwardText: input.memory.carryForward
      ? getCarryForwardText({
          currentFocusLabel: input.currentFocusLabel,
          carryForward: input.memory.carryForward,
        })
      : null,
    stabilizedText: input.memory.recentlyStabilized
      ? `${input.memory.recentlyStabilized.label} يبدو الآن أكثر استقرارًا من آخر دورة مراجعة قريبة.`
      : null,
    recurringText: input.memory.recurring
      ? input.memory.recurring.reason === "recent_support_signal"
        ? `${input.memory.recurring.label} ما زال يحتاج مرورًا أوضح قليلًا، لذلك نبقيه حاضرًا في الذاكرة القريبة.`
        : `${input.memory.recurring.label} عاد أكثر من مرة مؤخرًا، لذلك نعرضه كمساحة متكررة بدل اعتباره ملاحظة عابرة.`
      : null,
  };
}

export function getPackProgressHistoryItemLabel(
  item: PackProgressMemory["recentFocusHistory"][number],
) {
  if (item.status === "current") {
    return "الحالي الآن";
  }

  if (item.status === "recently_resolved") {
    return "استقر مؤخرًا";
  }

  if (item.isRecurring) {
    return "يتكرر مؤخرًا";
  }

  return "مرّ بنا مؤخرًا";
}

export function getPackProgressHistoryItemTone(
  item: PackProgressMemory["recentFocusHistory"][number],
) {
  if (item.status === "current") {
    return "border-[var(--primary-soft)] bg-[var(--primary-soft)]/15 text-[var(--primary-strong)]";
  }

  if (item.status === "recently_resolved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (item.isRecurring) {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }

  return "border-[var(--border)] bg-white text-[var(--text)]";
}

function getCarryForwardText(input: {
  currentFocusLabel: string;
  carryForward: NonNullable<PackProgressMemory["carryForward"]>;
}) {
  switch (input.carryForward.reason) {
    case "recently_stabilized":
      return `التركيز الحالي على ${input.currentFocusLabel} يأتي بعد أن أصبح ${input.carryForward.label} أوضح وأكثر استقرارًا.`;
    case "recurring_area":
      return `التركيز الحالي على ${input.currentFocusLabel} ما زال مرتبطًا بما كان يعود معك في ${input.carryForward.label}.`;
    default:
      return `التركيز الحالي على ${input.currentFocusLabel} يكمل ما بدأناه مؤخرًا في ${input.carryForward.label}.`;
  }
}
