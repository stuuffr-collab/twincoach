import type { CoursePackSupportLevel } from "./api";

type TodayPresentation = {
  supportChip: string;
  nextStepLead: string;
  primaryActionLabel: string;
  primaryActionSupportingText: string;
};

type SessionPresentation = {
  expectationTitle: string;
  expectationText: string;
  evaluationTitle: string;
  evaluationText: string;
  outcomeTitle: string;
  outcomeText: string;
  submitSupportingText: string;
  continueSupportingText: string;
  completedSupportingText: string;
  helpHint: string;
};

type SummaryPresentation = {
  heroText: string;
  interpretationText: string;
  nextStepLead: string;
  completedLabel: string;
  positiveLabel: string;
  reviewLabel: string;
  stickySupportingText: string;
};

export type SupportLevelPresentation = {
  modeMeaning: string;
  modeMeaningLabel: string;
  today: TodayPresentation;
  session: SessionPresentation;
  summary: SummaryPresentation;
};

export function getSupportLevelPresentation(
  level: CoursePackSupportLevel | null,
  options?: {
    hasActiveSession?: boolean;
  },
): SupportLevelPresentation {
  const hasActiveSession = options?.hasActiveSession ?? false;

  switch (level) {
    case "full_coach":
      return {
        modeMeaning:
          "TwinCoach يتعامل هنا مع هذه الخطوة كتدريب أعمق على المفهوم الحالي، ويقرأ أداء الجلسة كإشارة أقوى داخل حدود المحرك المؤكد.",
        modeMeaningLabel: "ما معنى هذا الوضع لك الآن؟",
        today: {
          supportChip: hasActiveSession
            ? "نكمل تدريبًا تكيفيًا أعمق من آخر خطوة محفوظة."
            : "جلسة تدريب تكيفي أعمق على مفهوم واحد من مقررك.",
          nextStepLead:
            "الخطوة التالية هنا تدريب مباشر على هذا المفهوم، لا مجرد تنظيم للدراسة.",
          primaryActionLabel: hasActiveSession
            ? "أكمل التدريب العميق"
            : "ابدأ تدريبًا عميقًا",
          primaryActionSupportingText:
            "سنستخدم هذه الجلسة لقراءة أدق لما ثبت في أدائك وما يحتاج إصلاحًا داخل هذا المفهوم.",
        },
        session: {
          expectationTitle: "المطلوب منك الآن",
          expectationText:
            "جاوب على المهمة كما تفهمها الآن، لأن هذه الجلسة مصممة لالتقاط ما ثبت وما يحتاج إصلاحًا داخل المفهوم الحالي.",
          evaluationTitle: "كيف نقرأ هذه الخطوة؟",
          evaluationText:
            "سنستخدم استجابتك هنا كإشارة أداء فعلية داخل حدود المفاهيم التي يستطيع TwinCoach تدريبها بعمق.",
          outcomeTitle: "ماذا تتوقع في النهاية؟",
          outcomeText:
            "ستخرج بصورة أوضح عن مستوى ثباتك على هذا المفهوم، وما إذا كنت تحتاج جولة إصلاح تالية أو تستطيع التقدم.",
          submitSupportingText:
            "نقرأ هذه الخطوة كأداء فعلي على المفهوم الحالي داخل مقررك.",
          continueSupportingText:
            "سنحمل نتيجة هذه الخطوة إلى الخطوة التالية داخل نفس المفهوم كلما أمكن.",
          completedSupportingText:
            "سننقلك إلى خلاصة تربط الأداء بالمفهوم الحالي داخل المقرر النشط.",
          helpHint: "الدعم هنا يساعدك على إصلاح الفهم، لا فقط على متابعة التسلسل.",
        },
        summary: {
          heroText:
            "هذه الخلاصة تقرأ أداءك على المفهوم الحالي داخل المقرر النشط.",
          interpretationText:
            "بما أن هذا المقرر في وضع تدريب كامل، يمكننا هنا أن نربط نتائج الجلسة بإشارة أداء أقوى على هذا المفهوم، من دون تجاوز حدود المحرك المؤكد.",
          nextStepLead:
            "الخطوة التالية مبنية على ما ثبت في الأداء وما يحتاج إصلاحًا بعد هذه الجلسة.",
          completedLabel: "مكتمل",
          positiveLabel: "موفّق",
          reviewLabel: "للمراجعة",
          stickySupportingText:
            "هذه الخلاصة تقرأ الأداء على المفهوم الحالي وتجهز الخطوة التالية بوضوح.",
        },
      };
    case "guided_study":
      return {
        modeMeaning:
          "TwinCoach يوجّه هنا ترتيب الدراسة والمراجعة بوضوح، من دون ادعاء تقييم عميق لكل جزئية أو لكل سطر.",
        modeMeaningLabel: "ما الذي يعنيه هذا الوضع لك الآن؟",
        today: {
          supportChip: hasActiveSession
            ? "نكمل خطوة دراسة موجهة من آخر موضع محفوظ."
            : "خطوة دراسة موجهة تبقيك على ترتيب واضح داخل المقرر.",
          nextStepLead:
            "الخطوة التالية ستوجّهك داخل أولويات المقرر مع دعم مركز، لا مع حكم عميق على كل جزئية.",
          primaryActionLabel: hasActiveSession
            ? "أكمل الدراسة الموجهة"
            : "ابدأ دراسة موجهة",
          primaryActionSupportingText:
            "سنثبت الاتجاه ونقربك من الأولوية التالية داخل المقرر مع توقعات واضحة وصادقة.",
        },
        session: {
          expectationTitle: "المطلوب منك الآن",
          expectationText:
            "جاوب لتثبيت فهمك الحالي ولمعرفة أين تحتاج التوجيه التالي داخل المقرر، لا لإثبات كمال الأداء.",
          evaluationTitle: "كيف نقرأ هذه الخطوة؟",
          evaluationText:
            "سنستخدم إجابتك هنا كإشارة توجيه وترتيب للمراجعة التالية، لا كحكم عميق على كل تفصيل.",
          outcomeTitle: "ماذا تتوقع في النهاية؟",
          outcomeText:
            "ستخرج بإحساس أوضح بما الذي تراجعه بعد هذه الخطوة، وما الذي أصبح أكثر ثباتًا من قبل.",
          submitSupportingText:
            "نستخدم هذه الخطوة لتوجيه المراجعة التالية داخل المقرر، لا لإصدار حكم واسع على مستواك.",
          continueSupportingText:
            "سنقودك إلى الخطوة التالية مع توجيه أوضح وترتيب أكثر تركيزًا.",
          completedSupportingText:
            "سننقلك إلى خلاصة تشرح الاتجاه التالي داخل المقرر بوضوح وصراحة.",
          helpHint: "الدعم هنا يوضح الطريق التالي أكثر مما يدّعي تصحيحًا عميقًا لكل نقطة.",
        },
        summary: {
          heroText:
            "هذه الخلاصة توجهك داخل المقرر أكثر مما تحكم على كل جزئية.",
          interpretationText:
            "في الدراسة الموجهة، نقرأ هذه الجلسة كإشارة اتجاه وتثبيت للأولوية التالية، لا كحكم عميق على كل سطر أو كل خطأ.",
          nextStepLead:
            "الخطوة التالية مبنية على التوجيه الدراسي التالي داخل المقرر، لا على قراءة تقييمية أوسع مما يدعمه المحرك.",
          completedLabel: "مكتمل",
          positiveLabel: "أوضح الآن",
          reviewLabel: "يحتاج متابعة",
          stickySupportingText:
            "هذه الخلاصة تثبت الاتجاه التالي داخل المقرر وتوضح أين تعود بعد هذه الخطوة.",
        },
      };
    case "planning_review":
      return {
        modeMeaning:
          "TwinCoach يستخدم هذه المواد هنا لبناء مراجعة منظمة وخطة واضحة، لا لتقديم تدريب تصحيحي عميق أو حكم أداء واسع.",
        modeMeaningLabel: "ما الذي يعنيه هذا الوضع لك الآن؟",
        today: {
          supportChip: hasActiveSession
            ? "نكمل خطوة مراجعة منظمة من آخر موضع محفوظ."
            : "خطوة مراجعة منظمة تحفظ وضوح الخطة الحالية.",
          nextStepLead:
            "الخطوة التالية مخصّصة لترتيب المراجعة وتثبيت الأولوية الحالية، لا لتقييم تدريبي عميق.",
          primaryActionLabel: hasActiveSession
            ? "أكمل المراجعة المنظمة"
            : "ابدأ مراجعة منظمة",
          primaryActionSupportingText:
            "سنحافظ على وضوح الخطة ونحدد ماذا يعود إلى جدولك بعد هذه الخطوة.",
        },
        session: {
          expectationTitle: "المطلوب منك الآن",
          expectationText:
            "تعامل مع هذه المهمة كخطوة مراجعة منظمة تساعدنا على تثبيت الأولوية الحالية داخل خطتك.",
          evaluationTitle: "كيف نقرأ هذه الخطوة؟",
          evaluationText:
            "هذه الجلسة لا تدّعي تقييمًا عميقًا؛ هي تلتقط أين تحتاج العودة المنظمة داخل الخطة الحالية.",
          outcomeTitle: "ماذا تتوقع في النهاية؟",
          outcomeText:
            "ستخرج بخطوة مراجعة تالية أوضح وبصورة أفضل عن المنطقة التي تستحق عودة سريعة داخل المقرر.",
          submitSupportingText:
            "هذه خطوة مراجعة منظمة داخل خطة المقرر الحالية، وليست حكمًا تدريبيًا واسعًا.",
          continueSupportingText:
            "سنكمل المراجعة المنظمة من نفس السياق حتى تبقى الخطة متماسكة.",
          completedSupportingText:
            "سننقلك إلى خلاصة تخدم خطة المراجعة التالية وتوضح أين تعود بعد ذلك.",
          helpHint: "الدعم هنا يحافظ على وضوح الخطة ويمنع التشتت بين ملفات المقرر.",
        },
        summary: {
          heroText:
            "هذه الخلاصة تخدم الخطة والمراجعة، لا تفسيرًا تدريبيًا عميقًا.",
          interpretationText:
            "في التخطيط والمراجعة، نستخدم الجلسة لترتيب العودة للمفاهيم المهمة وتثبيت أولوية المراجعة التالية فقط.",
          nextStepLead:
            "الخطوة التالية مبنية على تنظيم المراجعة التالية داخل المقرر، لا على ادعاء تقييم أعمق مما يدعمه هذا الوضع.",
          completedLabel: "مُراجع",
          positiveLabel: "أوضح الآن",
          reviewLabel: "عودة للخطة",
          stickySupportingText:
            "هذه الخلاصة تضبط أولوية المراجعة التالية وتبقي الخطة واضحة وقابلة للتنفيذ.",
        },
      };
    default:
      return {
        modeMeaning:
          "سيظل TwinCoach واضحًا حول نوع الدعم الذي يقدمه لك في هذه الخطوة.",
        modeMeaningLabel: "ما الذي يعنيه هذا الوضع لك الآن؟",
        today: {
          supportChip: hasActiveSession
            ? "سنفتح لك الجلسة من آخر خطوة محفوظة."
            : "جلسة قصيرة وواضحة تكفي لتثبيت الاتجاه التالي.",
          nextStepLead: "الخطوة التالية مصممة لتبقيك على اتجاه واضح.",
          primaryActionLabel: hasActiveSession
            ? "أكمل الجلسة"
            : "ابدأ الجلسة",
          primaryActionSupportingText:
            "سنحافظ على خطوة واضحة ومحددة داخل مسارك الحالي.",
        },
        session: {
          expectationTitle: "المطلوب منك الآن",
          expectationText:
            "جاوب على الخطوة الحالية كما تفهمها الآن، ثم دع TwinCoach يقودك إلى الخطوة التالية.",
          evaluationTitle: "كيف نقرأ هذه الخطوة؟",
          evaluationText:
            "نستخدم هذه الخطوة لفهم أفضل دعم تالي داخل مسارك الحالي.",
          outcomeTitle: "ماذا تتوقع في النهاية؟",
          outcomeText:
            "ستخرج بخطوة تالية أوضح وصورة أفضل عن أين تركز بعد ذلك.",
          submitSupportingText:
            "نحفظ التقدم بعد كل خطوة بطريقة واضحة ومباشرة.",
          continueSupportingText:
            "خطوتك محفوظة، ويمكنك المتابعة الآن.",
          completedSupportingText:
            "سننقلك إلى خلاصة الجلسة والخطوة التالية الجاهزة لك.",
          helpHint: "الدعم هنا يوضح لك الخطوة التالية بقدر الإمكان.",
        },
        summary: {
          heroText: "هذه الخلاصة مرتبطة بجلسة اليوم وما أظهرته من خطوة دعم تالية.",
          interpretationText:
            "نستخدم هذه الخلاصة لتوضيح ما ظهر في الجلسة وما الذي ينبغي أن تتجه إليه بعد ذلك.",
          nextStepLead: "الخطوة التالية مبنية على ما ظهر في هذه الجلسة فقط.",
          completedLabel: "مكتمل",
          positiveLabel: "أوضح الآن",
          reviewLabel: "للمتابعة",
          stickySupportingText:
            "الخلاصة محفوظة، والخطوة التالية جاهزة بوضوح.",
        },
      };
  }
}
