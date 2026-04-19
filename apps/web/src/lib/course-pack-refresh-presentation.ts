import type {
  ActiveCourseContext,
  CoursePackSupportLevel,
  DailySessionPayload,
  SessionSummary,
} from "./api";

type RefreshSurface = "today" | "session" | "summary";

type RefreshPresentationInput = {
  courseTitle: string;
  focusLabel: string;
  refreshContext:
    | NonNullable<ActiveCourseContext["refreshContext"]>
    | NonNullable<DailySessionPayload["refreshHandoff"]>
    | NonNullable<SessionSummary["refreshHandoff"]>
    | null;
};

type RefreshPresentation = {
  title: string;
  description: string;
  reasonChip: string;
  supportingText: string;
};

type FollowThroughPresentationInput = {
  courseTitle: string;
  focusLabel: string;
  followThrough:
    | NonNullable<ActiveCourseContext["followThrough"]>
    | null;
  willContinueAfterSession?: boolean | null;
};

type ResolutionPresentationInput = {
  courseTitle: string;
  focusLabel: string;
  resolution:
    | NonNullable<ActiveCourseContext["resolution"]>
    | null;
};

export function getRefreshPresentation(
  surface: RefreshSurface,
  input: RefreshPresentationInput,
): RefreshPresentation {
  const reasonType = input.refreshContext?.reasonType ?? "changed_concept";
  const sourceLabel = input.refreshContext?.sourceLabel ?? input.focusLabel;
  const supportLevelText = getSupportLevelLabel(
    input.refreshContext?.currentSupportLevel ?? null,
  );

  switch (surface) {
    case "today":
      return {
        title: `نبدأ الآن من ${input.focusLabel}`,
        description: getTodayDescription({
          courseTitle: input.courseTitle,
          sourceLabel,
          reasonType,
          supportLevelText,
        }),
        reasonChip: getReasonChip(reasonType),
        supportingText:
          "هذه هي أول نقطة نعيد منها ترتيب الخطوة التالية بعد آخر تحديث راجعته.",
      };
    case "session":
      return {
        title: "هذه أول جلسة بعد تحديث المقرر",
        description: getSessionDescription({
          sourceLabel,
          reasonType,
        }),
        reasonChip: getReasonChip(reasonType),
        supportingText:
          "هذه إعادة دخول مقصودة من أكثر جزء تغيّر ويستحق أن تبدأ منه الآن.",
      };
    case "summary":
      return {
        title: "أول جلسة بعد تحديث المقرر اكتملت",
        description: getSummaryDescription({
          sourceLabel,
          reasonType,
        }),
        reasonChip: getReasonChip(reasonType),
        supportingText: `أفضل متابعة تالية الآن هي البناء من ${sourceLabel} قبل توسيع الخطوة التالية.`,
      };
  }
}

export function getRefreshFollowThroughPresentation(
  surface: RefreshSurface,
  input: FollowThroughPresentationInput,
): RefreshPresentation {
  const reasonType = input.followThrough?.reasonType ?? "changed_concept";
  const targetLabel = input.followThrough?.targetLabel ?? input.focusLabel;

  switch (surface) {
    case "today":
      return {
        title: `نبقى مع ${targetLabel} خطوة إضافية`,
        description: getTodayFollowThroughDescription({
          courseTitle: input.courseTitle,
          targetLabel,
          reasonType,
        }),
        reasonChip: "متابعة قصيرة",
        supportingText:
          "الجزء المحدّث حصل على أول مرور، لكن TwinCoach يفضّل خطوة إضافية واحدة قبل العودة إلى مسار أوسع.",
      };
    case "session":
      return {
        title: `نكمل من ${targetLabel}`,
        description: getSessionFollowThroughDescription({
          targetLabel,
          reasonType,
        }),
        reasonChip: "متابعة مقصودة",
        supportingText:
          "هذه ليست إعادة بداية جديدة. هي خطوة متابعة واحدة لتثبيت ما تغيّر قبل الانتقال بعيدًا عنه.",
      };
    case "summary":
      return input.willContinueAfterSession
        ? {
            title: `ما زلنا نحتاج مرورًا آخر على ${targetLabel}`,
            description: `هذه الجلسة ثبتت الاتجاه، لكن ${targetLabel} ما زال يستحق خطوة متابعة قصيرة قبل أن يتركه TwinCoach وينتقل لغيره.`,
            reasonChip: "متابعة مستمرة",
            supportingText:
              "المسار لم يتجمد، لكن الخطوة التالية ستبقى قريبة من هذا الجزء حتى يستقر أكثر.",
          }
        : {
            title: `أصبح ${targetLabel} أكثر استقرارًا الآن`,
            description: `هذه الجلسة كانت خطوة المتابعة الأخيرة على ${targetLabel}، ويستطيع TwinCoach الآن أن يعود إلى المسار التالي بدون البقاء عالقًا هنا.`,
            reasonChip: "جاهز للانتقال",
            supportingText:
              "ستميل الخطوة التالية إلى مسار أكثر طبيعية بدل البقاء على نفس الموضوع.",
          };
  }
}

export function getRefreshResolutionPresentation(
  surface: RefreshSurface,
  input: ResolutionPresentationInput,
): RefreshPresentation {
  const reasonType = input.resolution?.reasonType ?? "changed_concept";
  const resolvedLabel = input.resolution?.resolvedLabel ?? input.focusLabel;

  switch (surface) {
    case "today":
      return {
        title:
          resolvedLabel === input.focusLabel
            ? `استقر ${resolvedLabel} بما يكفي الآن`
            : `أنهينا متابعة ${resolvedLabel} ونعود الآن إلى ${input.focusLabel}`,
        description: getTodayResolutionDescription({
          courseTitle: input.courseTitle,
          resolvedLabel,
          focusLabel: input.focusLabel,
          reasonType,
        }),
        reasonChip: "عودة للمسار الطبيعي",
        supportingText:
          "أنهى TwinCoach متابعة التحديث لهذا الجزء، وعادت الخطوة التالية الآن إلى مسار دراسة طبيعي وواضح.",
      };
    case "session":
      return {
        title:
          resolvedLabel === input.focusLabel
            ? `نبدأ من ${input.focusLabel} لكن خارج وضع المتابعة`
            : `ننتقل الآن من ${resolvedLabel} إلى ${input.focusLabel}`,
        description: getSessionResolutionDescription({
          resolvedLabel,
          focusLabel: input.focusLabel,
          reasonType,
        }),
        reasonChip: "عودة مقصودة",
        supportingText:
          "هذه ليست متابعة جديدة لنفس الجزء. إنها عودة متعمدة إلى الإيقاع الطبيعي بعد أن أصبح الجزء المحدّث أكثر استقرارًا.",
      };
    case "summary":
      return {
        title: `أصبح ${resolvedLabel} أكثر استقرارًا الآن`,
        description: getSummaryResolutionDescription({
          resolvedLabel,
          focusLabel: input.focusLabel,
          reasonType,
        }),
        reasonChip: "استقرار كافٍ",
        supportingText:
          resolvedLabel === input.focusLabel
            ? "TwinCoach أنهى متابعة التحديث هنا، وإذا بقي هذا الجزء حاضرًا فذلك لأنه عاد يظهر كأفضل خطوة طبيعية الآن."
            : `سيميل المسار التالي الآن إلى ${input.focusLabel} بدل البقاء عالقًا في ${resolvedLabel}.`,
      };
  }
}

function getTodayDescription(input: {
  courseTitle: string;
  sourceLabel: string;
  reasonType: NonNullable<
    RefreshPresentationInput["refreshContext"]
  >["reasonType"];
  supportLevelText: string;
}) {
  switch (input.reasonType) {
    case "new_material":
      return `ظهر ${input.sourceLabel} كمادة جديدة داخل ${input.courseTitle}، لذلك جعله TwinCoach نقطة البداية الأولى الآن في وضع ${input.supportLevelText}.`;
    case "changed_blueprint_priority":
      return `أولوية ${input.sourceLabel} ارتفعت داخل ${input.courseTitle}، لذلك يأتي هذا الجزء أولًا الآن بدل الاستمرار من ترتيب أقدم.`;
    case "support_level_impact":
      return `طريقة الدعم نفسها تغيّرت داخل ${input.courseTitle}، لذلك نبدأ من ${input.sourceLabel} حتى يتماشى أول restart مع الوضع الجديد.`;
    case "changed_concept":
    default:
      return `${input.sourceLabel} هو أكثر جزء تغيّر داخل ${input.courseTitle}، لذلك يبدأ منه TwinCoach الآن قبل العودة إلى بقية الخطة.`;
  }
}

function getSessionDescription(input: {
  sourceLabel: string;
  reasonType: NonNullable<
    RefreshPresentationInput["refreshContext"]
  >["reasonType"];
}) {
  switch (input.reasonType) {
    case "new_material":
      return `هذه الجلسة تبدأ من ${input.sourceLabel} لأنه دخل حديثًا إلى خريطة المقرر ويحتاج أول مرور واضح بعد التحديث.`;
    case "changed_blueprint_priority":
      return `هذه الجلسة تبدأ من ${input.sourceLabel} لأن أولويته تغيّرت في الخطة المؤكدة وأصبح أفضل نقطة لإعادة الدخول الآن.`;
    case "support_level_impact":
      return `هذه الجلسة تبدأ من ${input.sourceLabel} لأن وضع الدعم تغيّر، ونريد أن تكون أول عودة من نقطة تناسب هذا التغيير.`;
    case "changed_concept":
    default:
      return `هذه الجلسة تبدأ من ${input.sourceLabel} لأنه الجزء الذي تغيّر فعليًا ويعطيك أوضح restart بعد تحديث المقرر.`;
  }
}

function getSummaryDescription(input: {
  sourceLabel: string;
  reasonType: NonNullable<
    RefreshPresentationInput["refreshContext"]
  >["reasonType"];
}) {
  switch (input.reasonType) {
    case "new_material":
      return `هذه الجلسة غطّت أول مادة جديدة بعد التحديث: ${input.sourceLabel}. الآن يمكن أن يبني TwinCoach الخطوة التالية من هذه الإضافة بدل تجاهلها.`;
    case "changed_blueprint_priority":
      return `هذه الجلسة بدأت من ${input.sourceLabel} لأنه أصبح أولوية أوضح بعد التحديث. وهذا يجعل المتابعة التالية أكثر اتساقًا مع الخطة الجديدة.`;
    case "support_level_impact":
      return `هذه الجلسة كانت أول خطوة بعد تغيّر نوع الدعم، وركزت على ${input.sourceLabel} حتى يبدأ المسار الجديد من نقطة مفهومة وواضحة.`;
    case "changed_concept":
    default:
      return `هذه الجلسة عالجت أول جزء تغيّر بعد التحديث: ${input.sourceLabel}. الآن يمكن متابعة الخطة من هذا الأساس المحدث بدل الرجوع إلى افتراضات أقدم.`;
  }
}

function getReasonChip(
  reasonType: NonNullable<RefreshPresentationInput["refreshContext"]>["reasonType"],
) {
  switch (reasonType) {
    case "new_material":
      return "مادة جديدة";
    case "changed_blueprint_priority":
      return "أولوية محدثة";
    case "support_level_impact":
      return "تأثير على نوع الدعم";
    case "changed_concept":
    default:
      return "جزء تغيّر";
  }
}

function getSupportLevelLabel(level: CoursePackSupportLevel | null) {
  switch (level) {
    case "full_coach":
      return "Full Coach";
    case "guided_study":
      return "Guided Study";
    case "planning_review":
      return "Planning + Review";
    default:
      return "الوضع الحالي";
  }
}

function getTodayFollowThroughDescription(input: {
  courseTitle: string;
  targetLabel: string;
  reasonType: NonNullable<ActiveCourseContext["followThrough"]>["reasonType"];
}) {
  switch (input.reasonType) {
    case "new_material":
      return `${input.targetLabel} دخل حديثًا إلى ${input.courseTitle}، وبعد أول مرور عليه ما زال يستحق خطوة متابعة قصيرة.`;
    case "changed_blueprint_priority":
      return `${input.targetLabel} ما زال يقود أولوية الخطة بعد التحديث، لذلك تبقى الخطوة التالية قريبة منه بدل الانتقال السريع.`;
    case "support_level_impact":
      return `بعد تغيّر نوع الدعم، ما زال ${input.targetLabel} أفضل نقطة لخطوة متابعة واحدة قبل العودة إلى مسار أوسع.`;
    case "changed_concept":
    default:
      return `${input.targetLabel} كان أكثر جزء تغيّر بعد التحديث، وما زال يستحق متابعة خفيفة قبل الانتقال بعيدًا عنه.`;
  }
}

function getSessionFollowThroughDescription(input: {
  targetLabel: string;
  reasonType: NonNullable<ActiveCourseContext["followThrough"]>["reasonType"];
}) {
  switch (input.reasonType) {
    case "new_material":
      return `نبقى مع ${input.targetLabel} خطوة إضافية لأنه مادة جديدة والمرور الأول وحده لا يكفي دائمًا.`;
    case "changed_blueprint_priority":
      return `نبقى مع ${input.targetLabel} لأن أولويته المحدّثة ما زالت تحتاج خطوة واضحة أخرى قبل التوسع.`;
    case "support_level_impact":
      return `نبقى مع ${input.targetLabel} لأن الوضع الجديد للدعم يستفيد من خطوة متابعة واحدة أكثر ثباتًا.`;
    case "changed_concept":
    default:
      return `نبقى مع ${input.targetLabel} لأن هذا الجزء تغيّر فعليًا ويستحق مرورًا إضافيًا صغيرًا قبل الانتقال لغيره.`;
  }
}

function getTodayResolutionDescription(input: {
  courseTitle: string;
  resolvedLabel: string;
  focusLabel: string;
  reasonType: NonNullable<ActiveCourseContext["resolution"]>["reasonType"];
}) {
  if (input.resolvedLabel === input.focusLabel) {
    return `${input.resolvedLabel} أصبح أكثر استقرارًا داخل ${input.courseTitle}، لذلك عاد TwinCoach الآن إلى الإيقاع الطبيعي حتى لو بقيت الخطوة التالية قريبة من نفس الجزء.`;
  }

  switch (input.reasonType) {
    case "new_material":
      return `المادة الجديدة ${input.resolvedLabel} أخذت ما تحتاجه من إعادة الدخول والمتابعة، لذلك يعود TwinCoach الآن إلى ${input.focusLabel} كأفضل خطوة طبيعية تالية داخل ${input.courseTitle}.`;
    case "changed_blueprint_priority":
      return `بعد أن استقرت أولوية ${input.resolvedLabel} في الخطة المحدّثة، يعود TwinCoach الآن إلى ${input.focusLabel} بدل إبقاء المسار عالقًا في نفس الجزء.`;
    case "support_level_impact":
      return `تأثير تغيّر نوع الدعم على ${input.resolvedLabel} أصبح أوضح الآن، لذلك يعود TwinCoach إلى ${input.focusLabel} كخطوة طبيعية تالية.`;
    case "changed_concept":
    default:
      return `${input.resolvedLabel} لم يعد يحتاج متابعة خاصة الآن، لذلك يعود TwinCoach إلى ${input.focusLabel} ضمن المسار الطبيعي للدراسة.`;
  }
}

function getSessionResolutionDescription(input: {
  resolvedLabel: string;
  focusLabel: string;
  reasonType: NonNullable<ActiveCourseContext["resolution"]>["reasonType"];
}) {
  if (input.resolvedLabel === input.focusLabel) {
    return `أصبح ${input.resolvedLabel} أكثر استقرارًا، لذلك تبدأ هذه الجلسة من نفس المنطقة لكن بوصفها خطوة طبيعية لا متابعة خاصة.`;
  }

  switch (input.reasonType) {
    case "new_material":
      return `${input.resolvedLabel} أخذ أول مرور والمتابعة التي احتاجها، ولهذا تبدأ هذه الجلسة من ${input.focusLabel} بدل الاستمرار داخل المادة الجديدة نفسها.`;
    case "changed_blueprint_priority":
      return `${input.resolvedLabel} استقر بما يكفي بعد تغيّر الأولوية، ولهذا تنتقل هذه الجلسة الآن إلى ${input.focusLabel} ضمن المسار الطبيعي.`;
    case "support_level_impact":
      return `بعد أن استقر أثر تغيّر نوع الدعم على ${input.resolvedLabel}، تعود هذه الجلسة الآن إلى ${input.focusLabel} بوصفه الخطوة الطبيعية التالية.`;
    case "changed_concept":
    default:
      return `${input.resolvedLabel} لم يعد يحتاج متابعة خاصة، لذلك تبدأ هذه الجلسة من ${input.focusLabel} بدل البقاء على نفس الجزء.`;
  }
}

function getSummaryResolutionDescription(input: {
  resolvedLabel: string;
  focusLabel: string;
  reasonType: NonNullable<ActiveCourseContext["resolution"]>["reasonType"];
}) {
  if (input.resolvedLabel === input.focusLabel) {
    return `المسار المحدّث حول ${input.resolvedLabel} يبدو الآن أكثر استقرارًا، ويمكن لـ TwinCoach أن يتعامل معه من هنا كجزء من الإيقاع الطبيعي لا كحالة متابعة خاصة.`;
  }

  switch (input.reasonType) {
    case "new_material":
      return `${input.resolvedLabel} كمواد جديدة أصبح أكثر وضوحًا الآن، ولذلك يمكن لـ TwinCoach أن يعود إلى ${input.focusLabel} ويستأنف المسار الطبيعي.`;
    case "changed_blueprint_priority":
      return `بعد أن استقر أثر تغيّر الأولوية حول ${input.resolvedLabel}، يمكن لـ TwinCoach أن يغادر هذا الجزء ويعود إلى ${input.focusLabel} ضمن الخطة الطبيعية.`;
    case "support_level_impact":
      return `تأثير تغيّر نوع الدعم على ${input.resolvedLabel} أصبح مستقرًا بما يكفي، ولذلك يمكن لـ TwinCoach أن يستأنف الحركة الطبيعية من ${input.focusLabel}.`;
    case "changed_concept":
    default:
      return `${input.resolvedLabel} يبدو الآن مستقرًا بما يكفي، ولذلك يمكن لـ TwinCoach أن يعود إلى ${input.focusLabel} دون إبقاء متابعة خاصة لهذا الجزء.`;
  }
}
