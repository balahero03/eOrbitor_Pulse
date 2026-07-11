'use client';

// Central icon system — professional line/solid icons (Heroicons) replacing
// the app's earlier emoji glyphs, with a consistent per-meaning colour scheme
// in the spirit of Zoho/Google module icons. Prefer these over raw emoji.

import {
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  BellAlertIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  ScaleIcon,
  TagIcon,
  LockClosedIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShoppingBagIcon,
  MegaphoneIcon,
  TrophyIcon,
  MagnifyingGlassIcon,
  KeyIcon,
  UserIcon,
  UsersIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  PaperClipIcon,
  NoSymbolIcon,
  LightBulbIcon,
  BriefcaseIcon,
  ClockIcon,
  CubeIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArrowLeftIcon,
  PlusIcon,
  CheckIcon,
  Bars3Icon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  BellIcon,
  StarIcon,
  PauseCircleIcon,
  MegaphoneIcon as MegaphoneOutline,
  ViewfinderCircleIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/outline';

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface Meta {
  Icon: IconType;
  color: string; // tailwind text-* class
  tint: string; // tailwind bg-* class for the soft chip background
}

// ─── Activity / follow-up modes ───────────────────────────────────────────────
const ACTIVITY_META: Record<string, Meta> = {
  MEETING: { Icon: UserGroupIcon, color: 'text-indigo-600', tint: 'bg-indigo-50' },
  CALL: { Icon: PhoneIcon, color: 'text-green-600', tint: 'bg-green-50' },
  SITE_VISIT: { Icon: BuildingOffice2Icon, color: 'text-orange-600', tint: 'bg-orange-50' },
  DEMO: { Icon: ComputerDesktopIcon, color: 'text-violet-600', tint: 'bg-violet-50' },
  PROPOSAL: { Icon: DocumentTextIcon, color: 'text-blue-600', tint: 'bg-blue-50' },
  NEGOTIATION: { Icon: ScaleIcon, color: 'text-amber-600', tint: 'bg-amber-50' },
  FOLLOW_UP: { Icon: BellAlertIcon, color: 'text-rose-600', tint: 'bg-rose-50' },
  EMAIL: { Icon: EnvelopeIcon, color: 'text-sky-600', tint: 'bg-sky-50' },
  WHATSAPP: { Icon: ChatBubbleLeftRightIcon, color: 'text-green-600', tint: 'bg-green-50' },
  WORK: { Icon: Cog6ToothIcon, color: 'text-slate-600', tint: 'bg-slate-100' },
  TRAINING: { Icon: AcademicCapIcon, color: 'text-teal-600', tint: 'bg-teal-50' },
  OTHER: { Icon: TagIcon, color: 'text-gray-500', tint: 'bg-gray-100' },
};

const FOLLOWUP_META: Record<string, Meta> = {
  CALL: ACTIVITY_META.CALL,
  EMAIL: ACTIVITY_META.EMAIL,
  MEETING: ACTIVITY_META.MEETING,
  WHATSAPP: ACTIVITY_META.WHATSAPP,
  SITE_VISIT: { Icon: MapPinIcon, color: 'text-orange-600', tint: 'bg-orange-50' },
};

const FALLBACK: Meta = { Icon: TagIcon, color: 'text-gray-500', tint: 'bg-gray-100' };

// Inline coloured icon for an activity mode.
export function ActivityIcon({ mode, className = 'w-5 h-5' }: { mode: string; className?: string }) {
  const { Icon, color } = ACTIVITY_META[mode] || FALLBACK;
  return <Icon className={`${color} ${className}`} aria-hidden />;
}

// Icon inside a soft tinted rounded chip — the Zoho/Google "module tile" look.
export function ActivityChip({ mode, className = 'w-8 h-8' }: { mode: string; className?: string }) {
  const { Icon, color, tint } = ACTIVITY_META[mode] || FALLBACK;
  return (
    <span className={`inline-flex items-center justify-center rounded-lg ${tint} ${className}`}>
      <Icon className={`${color} w-1/2 h-1/2`} aria-hidden />
    </span>
  );
}

export function FollowUpIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
  const { Icon, color } = FOLLOWUP_META[type] || FALLBACK;
  return <Icon className={`${color} ${className}`} aria-hidden />;
}

export function FollowUpChip({ type, className = 'w-8 h-8' }: { type: string; className?: string }) {
  const { Icon, color, tint } = FOLLOWUP_META[type] || FALLBACK;
  return (
    <span className={`inline-flex items-center justify-center rounded-lg ${tint} ${className}`}>
      <Icon className={`${color} w-1/2 h-1/2`} aria-hidden />
    </span>
  );
}

export const ACTIVITY_LABELS: Record<string, string> = {
  MEETING: 'Meeting', CALL: 'Call', SITE_VISIT: 'Site Visit', DEMO: 'Demo',
  PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', FOLLOW_UP: 'Follow-up',
  EMAIL: 'Email', WHATSAPP: 'WhatsApp', WORK: 'Internal Work', TRAINING: 'Training', OTHER: 'Other',
};

// ─── Named single-purpose icons (coloured by default meaning) ─────────────────
// Thin wrappers so call sites read semantically and stay colour-consistent.
const mk = (Icon: IconType, defaultColor: string) =>
  function NamedIcon({ className = 'w-5 h-5', color }: { className?: string; color?: string }) {
    return <Icon className={`${color ?? defaultColor} ${className}`} aria-hidden />;
  };

export const QuotationIcon = mk(DocumentTextIcon, 'text-blue-600');
export const LockIcon = mk(LockClosedIcon, 'text-amber-600');
export const ClipboardIcon = mk(ClipboardDocumentListIcon, 'text-gray-400');
export const CalendarIcon = mk(CalendarDaysIcon, 'text-blue-600');
export const WarningIcon = mk(ExclamationTriangleIcon, 'text-amber-500');
export const SuccessIcon = mk(CheckCircleIcon, 'text-green-600');
export const ErrorIcon = mk(XCircleIcon, 'text-red-500');
export const BlockedIcon = mk(NoSymbolIcon, 'text-red-500');
export const OrderIcon = mk(ShoppingBagIcon, 'text-purple-600');
export const ProductIcon = mk(CubeIcon, 'text-purple-600');
export const AnnouncementIcon = mk(MegaphoneIcon, 'text-fuchsia-600');
export const TrophyIcon2 = mk(TrophyIcon, 'text-amber-500');
export const SearchIcon = mk(MagnifyingGlassIcon, 'text-gray-400');
export const KeyIcon2 = mk(KeyIcon, 'text-amber-600');
export const UserSingleIcon = mk(UserIcon, 'text-gray-500');
export const UsersMultiIcon = mk(UsersIcon, 'text-indigo-600');
export const ShieldIcon = mk(ShieldCheckIcon, 'text-emerald-600');
export const ReportIcon = mk(ChartBarIcon, 'text-blue-600');
export const AttachmentIcon = mk(PaperClipIcon, 'text-gray-500');
export const IdeaIcon = mk(LightBulbIcon, 'text-amber-500');
export const BriefcaseIcon2 = mk(BriefcaseIcon, 'text-slate-600');
export const ClockIcon2 = mk(ClockIcon, 'text-gray-500');
export const TargetIcon = mk(ViewfinderCircleIcon, 'text-green-600');
export const ThumbUpIcon = mk(HandThumbUpIcon, 'text-green-600');
export const PendingIcon = mk(ClockIcon, 'text-amber-600');
export const BellIconC = mk(BellIcon, 'text-gray-500');
export const StarIconC = mk(StarIcon, 'text-amber-500');

// Neutral UI glyphs (inherit color by default so they blend with their button/text).
export const EditIcon = mk(PencilSquareIcon, 'text-current');
export const CloseIcon = mk(XMarkIcon, 'text-current');
export const BackIcon = mk(ArrowLeftIcon, 'text-current');
export const PlusGlyph = mk(PlusIcon, 'text-current');
export const CheckGlyph = mk(CheckIcon, 'text-current');
export const MenuIcon = mk(Bars3Icon, 'text-current');
export const UploadIcon = mk(ArrowUpTrayIcon, 'text-current');
export const DownloadIcon = mk(ArrowDownTrayIcon, 'text-current');
export const ExternalLinkIcon = mk(ArrowTopRightOnSquareIcon, 'text-current');

// ─── SPANCO pipeline stages & closed statuses ─────────────────────────────────
const STAGE_ICON: Record<string, IconType> = {
  SUSPECT: MagnifyingGlassIcon,
  PROSPECT: ClipboardDocumentListIcon,
  PROPOSAL: MegaphoneOutline,
  NEGOTIATION: ChatBubbleLeftRightIcon,
  CLOSURE: LockClosedIcon,
};

const STATUS_ICON: Record<string, IconType> = {
  ORDER: TrophyIcon,
  WON: TrophyIcon,
  LOST: XCircleIcon,
  DROPPED: NoSymbolIcon,
  ON_HOLD: PauseCircleIcon,
};

// Stage icon inherits its color from the surrounding element by default (it
// usually sits on an already-colored pill/header), override with `color`.
export function StageIcon({ stage, className = 'w-4 h-4', color = 'text-current' }: { stage: string; className?: string; color?: string }) {
  const Icon = STAGE_ICON[stage] || TagIcon;
  return <Icon className={`${color} ${className}`} aria-hidden />;
}

export function StatusIcon({ status, className = 'w-4 h-4', color = 'text-current' }: { status: string; className?: string; color?: string }) {
  const Icon = STATUS_ICON[status] || TagIcon;
  return <Icon className={`${color} ${className}`} aria-hidden />;
}
