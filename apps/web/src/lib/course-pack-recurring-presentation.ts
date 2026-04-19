import type { RecurringFocusDecision } from "./api";

type RecurringSurface = "today" | "session" | "summary";

type RecurringPresentation = {
  title: string;
  description: string;
  reasonChip: string;
  supportingText: string;
};

export function getRecurringFocusPresentation(
  surface: RecurringSurface,
  input: {
    courseTitle: string;
    decision: RecurringFocusDecision;
  },
): RecurringPresentation {
  switch (surface) {
    case "today":
      return getTodayRecurringPresentation(input);
    case "session":
      return getSessionRecurringPresentation(input);
    case "summary":
      return getSummaryRecurringPresentation(input);
  }
}

function getTodayRecurringPresentation(input: {
  courseTitle: string;
  decision: RecurringFocusDecision;
}): RecurringPresentation {
  switch (input.decision.decisionType) {
    case "returning_to_resolved_area":
      return {
        title: `نعود إلى ${input.decision.currentFocusLabel} لسبب جديد وواضح`,
        description: `${input.decision.sourceLabel} كان قد هدأ بما يكفي داخل ${input.courseTitle}، لكنه عاد الآن بإشارة أقوى أو أوضح، لذلك يعيده TwinCoach إلى الواجهة عن قصد بدل اعتباره مجرد أثر قريب في الذاكرة.`,
        reasonChip: "عودة تستحق الانتباه",
        supportingText:
          "هذه ليست عودة عشوائية، وليست مجرد ذكرى قريبة. هناك سبب أوضح يجعل هذا الجزء هو البداية الأنسب الآن.",
      };
    case "holding_against_recent_residue":
      return {
        title: `لا نعيد ${input.decision.sourceLabel} إلى الواجهة الآن`,
        description: `${input.decision.sourceLabel} ما زال قريبًا في ذاكرتك الحديثة، لكن TwinCoach لا يبالغ في رد الفعل. خطوة اليوم تتحرك إلى ${input.decision.currentFocusLabel} لأن هذا هو الامتداد الأنسب الآن.`,
        reasonChip: "ذاكرة قريبة فقط",
        supportingText:
          "إذا عاد هذا الجزء بإشارة أوضح سنعود له بصراحة، لكننا لا نجرّه إلى الواجهة فقط لأنه كان حاضرًا مؤخرًا.",
      };
    case "escalating_recurring_area":
      return {
        title: `نبقي ${input.decision.currentFocusLabel} في الواجهة الآن`,
        description: `${input.decision.currentFocusLabel} عاد أكثر من مرة داخل ${input.courseTitle} وما زال يحمل إشارة دعم قريبة، لذلك يرفعه TwinCoach كأولوية أوضح بدل اعتباره تكرارًا عابرًا.`,
        reasonChip: "اهتمام أقوى الآن",
        supportingText:
          "هذا ليس تعليقًا للمسار. هو قرار قصير لإعطاء هذه المنطقة مرورًا أوضح قبل الانتقال إلى فكرة أخرى.",
      };
    case "staying_with_recurring_area":
      return {
        title: `نبقى مع ${input.decision.currentFocusLabel} قليلًا`,
        description: `${input.decision.currentFocusLabel} تكرر مؤخرًا داخل ${input.courseTitle} بما يكفي ليبقى حاضرًا في الخطوة التالية، لذلك يحافظ TwinCoach على نفس الخيط بدل الدوران السريع بعيدًا عنه.`,
        reasonChip: "جزء يتكرر مؤخرًا",
        supportingText:
          "نحن لا نعيد نفس الشيء بلا سبب. نبقي هذه المنطقة قريبة لأن آخر المرور عليها ما زال مرتبطًا بما تحتاجه الآن.",
      };
    case "rotating_from_recurring_area":
      return {
        title: `ننتقل الآن إلى ${input.decision.currentFocusLabel}`,
        description: `${input.decision.sourceLabel} كان يتكرر مؤخرًا، لكن TwinCoach لا يتركك عالقًا فيه. الخطوة الحالية تتحرك إلى ${input.decision.currentFocusLabel} لأن هذا هو الامتداد الأنسب الآن.`,
        reasonChip: "انتقال مقصود",
        supportingText:
          "التكرار السابق ما زال مفهومًا، لكن ليس من المفيد إبقاؤه في المقدمة أكثر من هذا الآن.",
      };
    case "rotating_after_stabilization":
    default:
      return {
        title: `يمكننا الآن التحرك بعد ${input.decision.sourceLabel}`,
        description: `${input.decision.sourceLabel} يبدو أكثر استقرارًا الآن، لذلك يعود TwinCoach إلى ${input.decision.currentFocusLabel} ضمن المسار الطبيعي بدل إبقاء المتابعة على نفس الجزء.`,
        reasonChip: "استقرار كافٍ",
        supportingText:
          "هذا يعني أن المنطقة السابقة لم تعد تحتاج اهتمامًا خاصًا الآن، ويمكن للخطوة التالية أن تتحرك بهدوء إلى ما بعدها.",
      };
  }
}

function getSessionRecurringPresentation(input: {
  courseTitle: string;
  decision: RecurringFocusDecision;
}): RecurringPresentation {
  switch (input.decision.decisionType) {
    case "returning_to_resolved_area":
      return {
        title: `هذه الجلسة تعود إلى ${input.decision.currentFocusLabel} عن قصد`,
        description: `${input.decision.sourceLabel} كان قد هدأ سابقًا، لكن هذه الجلسة تعود إليه لأن TwinCoach يرى سببًا جديدًا وواضحًا يجعل الرجوع إليه مشروعًا الآن داخل ${input.courseTitle}.`,
        reasonChip: "عودة مبررة",
        supportingText:
          "هذه ليست قفزة عشوائية إلى موضوع قديم. الجلسة تبدأ من هذا الجزء لأن إشاراته الحالية تقول إنه عاد ويستحق مرورًا جديدًا.",
      };
    case "holding_against_recent_residue":
      return {
        title: `هذه الجلسة لا تعيد ${input.decision.sourceLabel} فقط لأنه حديث`,
        description: `${input.decision.sourceLabel} ما زال قريبًا في الذاكرة، لكن هذه الجلسة تبدأ من ${input.decision.currentFocusLabel} لأن TwinCoach لا يعيد الجزء السابق بلا سبب حقيقي.`,
        reasonChip: "لا نبالغ في التكرار",
        supportingText:
          "إذا ظهر سبب أوضح سنعود إليه، لكن هذه الجلسة لا تبنى على بقايا القرب وحدها.",
      };
    case "escalating_recurring_area":
      return {
        title: `هذه الجلسة تشد الانتباه إلى ${input.decision.currentFocusLabel}`,
        description: `${input.decision.currentFocusLabel} لم يعد مجرد تكرار قريب. TwinCoach يصعّد الاهتمام به الآن لأن هذه المنطقة ما زالت تحتاج تثبيتًا أوضح داخل ${input.courseTitle}.`,
        reasonChip: "تصعيد مقصود",
        supportingText:
          "هذه ليست تكرارًا عشوائيًا. الجلسة تحاول تثبيت الجزء الذي ما زال يعود معك بدل تركه يتكرر من غير حل واضح.",
      };
    case "staying_with_recurring_area":
      return {
        title: `نبدأ من ${input.decision.currentFocusLabel} مرة أخرى عن قصد`,
        description: `${input.decision.currentFocusLabel} ما زال أقرب نقطة تحتاج متابعة قصيرة، لذلك تبدأ الجلسة منه بدل فتح موضوع بعيد عنه.`,
        reasonChip: "استمرار قريب",
        supportingText:
          "الهدف هنا ليس التكرار نفسه، بل جعل هذا الجزء أكثر ثباتًا قبل توسيع الحركة إلى ما بعده.",
      };
    case "rotating_from_recurring_area":
      return {
        title: `ننتقل من ${input.decision.sourceLabel} إلى ${input.decision.currentFocusLabel}`,
        description: `${input.decision.sourceLabel} كان حاضرًا أكثر من مرة مؤخرًا، لكن هذه الجلسة تبدأ من ${input.decision.currentFocusLabel} لأن TwinCoach يرى أن الوقت مناسب للدوران إلى خطوة أخرى مرتبطة به.`,
        reasonChip: "انتقال موثوق",
        supportingText:
          "التحرك هنا ليس قفزة مفاجئة. هو انتقال مقصود بعد أن أخذ الجزء المتكرر ما يكفي من الانتباه القريب.",
      };
    case "rotating_after_stabilization":
    default:
      return {
        title: `نعود الآن إلى مسار أوسع من ${input.decision.currentFocusLabel}`,
        description: `${input.decision.sourceLabel} يبدو أكثر استقرارًا الآن، لذلك تبدأ هذه الجلسة من ${input.decision.currentFocusLabel} كخطوة طبيعية تالية بدل الاستمرار في نفس منطقة التكرار.`,
        reasonChip: "عودة للمسار الطبيعي",
        supportingText:
          "هذا يوضح أن TwinCoach لم ينسَ المنطقة السابقة، بل أنهى متابعتها بما يكفي وانتقل الآن بشكل مقصود.",
      };
  }
}

function getSummaryRecurringPresentation(input: {
  courseTitle: string;
  decision: RecurringFocusDecision;
}): RecurringPresentation {
  switch (input.decision.decisionType) {
    case "returning_to_resolved_area":
      return {
        title: `${input.decision.currentFocusLabel} عاد هذه المرة لسبب حقيقي`,
        description: `هذه الجلسة أكدت أن ${input.decision.currentFocusLabel} لم يعد مجرد خيط قديم قريب، بل عاد بإشارة تستحق انتباهًا جديدًا داخل ${input.courseTitle}.`,
        reasonChip: "عودة حقيقية",
        supportingText:
          "إذا ظل هذا الجزء يحمل نفس الإشارة فسيبقى قريبًا، وإذا هدأ مرة أخرى فسيتحرك TwinCoach عنه بهدوء.",
      };
    case "holding_against_recent_residue":
      return {
        title: `لم نعد إلى ${input.decision.sourceLabel} بلا سبب`,
        description: `${input.decision.sourceLabel} ظل قريبًا في الذاكرة الحديثة، لكن هذه الجلسة بقيت مع ${input.decision.currentFocusLabel} لأن TwinCoach لا يخلط بين القرب الزمني والحاجة الحقيقية للعودة.`,
        reasonChip: "ليس سببًا كافيًا وحده",
        supportingText:
          "هذا يعني أننا لا نبالغ في التكرار. سنعود فقط إذا ظهر سبب أوضح يجعل الرجوع مفيدًا فعلًا.",
      };
    case "escalating_recurring_area":
      return {
        title: `${input.decision.currentFocusLabel} ما زال يستحق اهتمامًا أوضح`,
        description: `هذه الجلسة أوضحت أن ${input.decision.currentFocusLabel} ما زال يعود كمنطقة تحتاج تثبيتًا أقوى، لذلك قد يبقيه TwinCoach قريبًا في الخطوة التالية بدل الانتقال السريع عنه.`,
        reasonChip: "ما زال يحتاج انتباهًا",
        supportingText:
          "هذا لا يعني تعثرًا كبيرًا. فقط يعني أن أفضل متابعة تالية ما زالت قريبة من هذا الجزء قبل التحرك بعيدًا عنه.",
      };
    case "staying_with_recurring_area":
      return {
        title: `${input.decision.currentFocusLabel} ما زال حاضرًا في المسار القريب`,
        description: `هذه الجلسة دعمت ${input.decision.currentFocusLabel}، لكنه ما زال من المناطق التي عادت مؤخرًا، لذلك قد تبقى الخطوة التالية قريبة منه بدل القفز إلى موضوع منفصل.`,
        reasonChip: "ما زال قريبًا من الخطوة التالية",
        supportingText:
          "TwinCoach يحاول إنهاء هذا الخيط بهدوء، لا إبقاءك داخله للأبد.",
      };
    case "rotating_from_recurring_area":
      return {
        title: `يمكننا الآن التحرك بعد ${input.decision.sourceLabel}`,
        description: `${input.decision.sourceLabel} ظل حاضرًا مؤخرًا، لكن هذه الجلسة تؤكد أن TwinCoach يستطيع أن يدور الآن إلى ${input.decision.currentFocusLabel} بدل إبقاء نفس المنطقة في الواجهة.`,
        reasonChip: "جاهز للدوران",
        supportingText:
          "الجزء المتكرر لا يختفي من الذاكرة، لكنه لم يعد يقود الخطوة التالية وحده.",
      };
    case "rotating_after_stabilization":
    default:
      return {
        title: `${input.decision.sourceLabel} يبدو أكثر استقرارًا الآن`,
        description: `${input.decision.sourceLabel} لم يعد يحتاج متابعة خاصة في هذه اللحظة، لذلك سيعود TwinCoach إلى ${input.decision.currentFocusLabel} ضمن المسار الطبيعي القادم داخل ${input.courseTitle}.`,
        reasonChip: "استقرار يسمح بالحركة",
        supportingText:
          "هذا يوضح أن TwinCoach أنهى خيط التكرار السابق بما يكفي، وسيعود الآن إلى المسار الطبيعي بخطوة أوسع وأكثر طبيعية.",
      };
  }
}
