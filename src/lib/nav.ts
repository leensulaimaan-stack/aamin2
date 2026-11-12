import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ClipboardCheck,
  FolderKanban,
  Gavel,
  Home,
  ListChecks,
  Network,
  Settings,
  ShieldAlert,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Me } from "./auth";

export type NavItem = { to: string; label: string; icon: LucideIcon; show?: (me: Me) => boolean };

export const mainNav: NavItem[] = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/tasks", label: "مهامي", icon: ListChecks },
  { to: "/jawlati", label: "جولتي", icon: ClipboardCheck },
  { to: "/projects", label: "المشاريع", icon: FolderKanban },
];

export const moreNav: NavItem[] = [
  { to: "/complex", label: "المهام المعقدة", icon: Network },
  { to: "/goals", label: "الأهداف السنوية", icon: Target },
  { to: "/jawlati/findings", label: "الملاحظات والإجراءات", icon: ShieldAlert },
  { to: "/jawlati/board", label: "لوحة المباني", icon: Trophy },
  { to: "/jawlati/approvals", label: "اعتماد الجولات", icon: CheckSquare, show: (m) => m.isStaff },
  { to: "/tasks/team", label: "مهام الفريق", icon: ListChecks, show: (m) => m.isStaff },
  { to: "/dashboard", label: "لوحة الفريق", icon: BarChart3, show: (m) => m.isStaff },
  { to: "/decisions", label: "قرارات الأسبوع", icon: Gavel, show: (m) => m.isStaff },
  { to: "/jawlati/setup", label: "المباني والجولات", icon: Building2, show: (m) => m.isStaff },
  { to: "/users", label: "المستخدمون", icon: Users, show: (m) => m.isAdmin },
  { to: "/notifications", label: "التنبيهات", icon: Bell },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export const visible = (items: NavItem[], me?: Me | null) =>
  items.filter((i) => !i.show || (me && i.show(me)));
