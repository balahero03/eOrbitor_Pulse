'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PhoneIcon,
  EnvelopeIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  ClipboardDocumentCheckIcon,
  ArrowRightIcon,
  ClockIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export interface PendingActivityItem {
  id: string;
  kind: 'FOLLOW_UP' | 'TASK';
  type: string;
  title: string;
  subtitle?: string;
  scheduledDate?: string | null;
  userName?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  priority?: string;
  href?: string;
}

interface PendingActivitiesPanelProps {
  activities?: PendingActivityItem[];
  totalCount?: number;
  className?: string;
}

function getActivityTypeMeta(kind: string, type: string) {
  if (kind === 'TASK') {
    return {
      label: 'Task',
      icon: ClipboardDocumentCheckIcon,
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
    };
  }

  switch (type) {
    case 'CALL':
      return {
        label: 'Call',
        icon: PhoneIcon,
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      };
    case 'EMAIL':
      return {
        label: 'Email',
        icon: EnvelopeIcon,
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
      };
    case 'MEETING':
      return {
        label: 'Meeting',
        icon: UsersIcon,
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
      };
    case 'WHATSAPP':
      return {
        label: 'WhatsApp',
        icon: ChatBubbleLeftRightIcon,
        badge: 'bg-green-50 text-green-700 border-green-200',
        iconBg: 'bg-green-50 text-green-600 border-green-200',
      };
    case 'SITE_VISIT':
      return {
        label: 'Site Visit',
        icon: MapPinIcon,
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      };
    default:
      return {
        label: type || 'Follow-up',
        icon: CalendarDaysIcon,
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      };
  }
}

function getDateMeta(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const isPast = d.getTime() < now.getTime();

  // Check if same calendar day
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const formatted = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isPast && !isToday) {
    return {
      text: `Overdue · ${formatted}`,
      badge: 'bg-red-50 text-red-700 border-red-200',
      isOverdue: true,
    };
  }

  if (isToday) {
    return {
      text: `Today · ${formatted.split(',')[1]?.trim() || formatted}`,
      badge: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      isToday: true,
    };
  }

  return {
    text: formatted,
    badge: 'bg-gray-50 text-gray-600 border-gray-200',
    isUpcoming: true,
  };
}

export default function PendingActivitiesPanel({
  activities = [],
  totalCount,
  className = '',
}: PendingActivitiesPanelProps) {
  const [filter, setFilter] = useState<'ALL' | 'FOLLOW_UP' | 'TASK'>('ALL');

  const filtered = activities.filter((a) => {
    if (filter === 'ALL') return true;
    return a.kind === filter;
  });

  const displayCount = totalCount ?? activities.length;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Pending Activities</h2>
            {displayCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {displayCount}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Scheduled follow-ups and open tasks awaiting completion
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs font-medium">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'ALL' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('FOLLOW_UP')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'FOLLOW_UP' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Follow-ups
            </button>
            <button
              onClick={() => setFilter('TASK')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'TASK' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Tasks
            </button>
          </div>

          <Link
            href="/followups"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors ml-1"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Activities List */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-lg bg-gray-50/50 border border-dashed border-gray-200">
          <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
          <p className="text-sm font-medium text-gray-700">No pending activities</p>
          <p className="text-xs text-gray-400 mt-0.5">All scheduled follow-ups and open tasks are completed.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.slice(0, 6).map((item) => {
            const meta = getActivityTypeMeta(item.kind, item.type);
            const dateMeta = getDateMeta(item.scheduledDate);
            const Icon = meta.icon;
            const targetHref = item.href || (item.leadId ? `/leads/${item.leadId}` : '/followups');

            return (
              <Link
                key={`${item.kind}-${item.id}`}
                href={targetHref}
                className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                {/* Type icon chip */}
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${meta.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {item.title}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    {item.priority && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                        {item.priority}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {item.subtitle || 'Scheduled action pending'}
                    {item.userName && ` · Assigned to ${item.userName}`}
                  </p>
                </div>

                {/* Date and Action */}
                <div className="flex items-center gap-2 flex-shrink-0 text-right">
                  {dateMeta && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md border font-medium whitespace-nowrap ${dateMeta.badge}`}
                    >
                      {dateMeta.text}
                    </span>
                  )}
                  <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
