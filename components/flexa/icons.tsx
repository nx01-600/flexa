"use client";

import { CaretLeft, CaretRight, IconContext, type IconProps, type IconWeight as Weight } from "@phosphor-icons/react";
import type { ReactNode } from "react";

// Single icon entry point. Phosphor glyphs exported under the names the app
// already uses, so screens never import an icon library directly.
export {
  ArrowsLeftRight as ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  SealCheck as BadgeCheck,
  Money as Banknote,
  Bell,
  Bank as Building2,
  Bus,
  Calendar,
  CalendarCheck as CalendarClock,
  CalendarDots as CalendarDays,
  ChartBar as ChartColumn,
  Check,
  CurrencyCircleDollar as CircleDollarSign,
  Question as CircleHelp,
  MinusCircle as CircleMinus,
  Clock,
  CloudArrowUp as CloudUpload,
  DownloadSimple as Download,
  Drop as Droplets,
  DotsThreeVertical as EllipsisVertical,
  Eye,
  EyeSlash as EyeOff,
  Invoice as FileSpreadsheet,
  FileText,
  Flame,
  HandCoins,
  Heartbeat as HeartPulse,
  Hourglass,
  House,
  IdentificationCard as IdCard,
  Info,
  Key as KeyRound,
  SquaresFour as LayoutGrid,
  Lightbulb,
  Lock,
  LockKey as LockKeyhole,
  SignOut as LogOut,
  MapPin,
  List as Menu,
  ChatCircle as MessageCircle,
  Percent,
  Phone,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Scales as Scale,
  MagnifyingGlass as Search,
  GearSix as Settings,
  ShareNetwork as Share2,
  ShieldCheck,
  DeviceMobile as Smartphone,
  Sparkle as Sparkles,
  TrendUp as TrendingUp,
  Warning as TriangleAlert,
  Trophy,
  UserCheck,
  User as UserRound,
  UserMinus as UserX,
  UsersThree as Users,
  Wallet,
  WifiHigh as Wifi,
  X,
  Lightning as Zap,
} from "@phosphor-icons/react";
export type { Icon as IconType } from "@phosphor-icons/react";

// Carets are pure strokes: a filled caret turns into a triangle, so they stay bold.
export const ChevronLeft = (props: IconProps) => <CaretLeft weight="bold" {...props} />;
export const ChevronRight = (props: IconProps) => <CaretRight weight="bold" {...props} />;

// Sets the glyph style for everything inside: "bold" for UI glyphs,
// "fill" for icons sitting on a tinted circle.
export function IconWeight({ weight, children }: { weight: Weight; children: ReactNode }) {
  return <IconContext.Provider value={{ weight, mirrored: false }}>{children}</IconContext.Provider>;
}
