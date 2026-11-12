export const APP_NAME = "آمن";
export const APP_NAME_EN = "Aamin";
export const APP_SUBTITLE = "متابعة مهام الصحة والسلامة والأمن والبيئة";

export const TASK_STATUSES = [
  "لم تبدأ",
  "قيد التنفيذ",
  "بانتظار جهة خارجية",
  "مكتملة",
  "ملغاة",
] as const;
export const OPEN_TASK = ["لم تبدأ", "قيد التنفيذ", "بانتظار جهة خارجية"] as const;
export const PRIORITIES = ["عادية", "عالية", "عاجلة"] as const;
export const CLASSES = ["طويلة", "معقدة", "روتينية", "عالقة", "قصيرة"] as const;
export const SEVERITIES = ["منخفضة", "متوسطة", "عالية", "حرجة"] as const;
export const DELAY_REASONS = [
  "بانتظار جهة خارجية",
  "بانتظار معلومات أو اعتماد",
  "تعارض أولويات",
  "ضغط عمل",
  "تغيّر النطاق",
  "أخرى",
] as const;
export const PARTY_TYPES = [
  "مشتريات",
  "ترخيص",
  "استشاري",
  "مقاول",
  "تحقيق",
  "تدقيق",
  "جهة داخلية أخرى",
  "جهة خارجية أخرى",
] as const;
export const DECISIONS = ["تنفيذ بموعد جديد", "إسناد لموظف آخر", "إلغاء"] as const;
export const RAG = ["على المسار", "معرّض للخطر", "متعثر"] as const;

export const CLASS_HINT: Record<string, string> = {
  طويلة: "مدتها أكثر من 30 يوماً — يُنصح بتحويلها إلى مشروع بمراحل قصيرة",
  معقدة: "فيها مشاركون أو تنتظر جهة خارجية — مسؤول واحد وخطوات واضحة",
  روتينية: "جولة تفتيش شهرية ضمن جولتي",
  عالقة: "لم تبدأ منذ أكثر من شهرين — تحتاج قراراً في اجتماع الأسبوع",
  قصيرة: "مهمة قصيرة — يكفي التذكير قبل الموعد",
};

export const BUILDING_FEATURES = [
  ["has_kitchen", "مطبخ"],
  ["has_parking", "مواقف"],
  ["has_generator", "مولد احتياطي"],
  ["has_elevators", "مصاعد"],
  ["has_aed", "جهاز AED"],
  ["has_fire_pump_room", "غرفة مضخات حريق"],
  ["has_chemical_storage", "تخزين مواد كيميائية"],
  ["has_smoking_area", "منطقة تدخين"],
  ["has_contractor_works", "أعمال مقاولين"],
] as const;

export const PHOTO_BUCKET = "inspection-photos";
