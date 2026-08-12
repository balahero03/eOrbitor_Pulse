'use client';

import Link from 'next/link';
import { AnnouncementIcon } from '@/components/icons';
import { ClipboardDocumentListIcon, ClockIcon } from '@heroicons/react/24/outline';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

// Same flat white-card-with-icon-chip StatCard used on the other dashboards —
// see the note in AdminDashboard.tsx.
function StatCard({ label, value, icon: Icon, tint, color }: {
  label: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>; tint: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </span>
      </div>
    </div>
  );
}

function TaskRow({ t }: { t: any }) {
  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
  return (
    <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
        {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
        {t.dueDate && (
          <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {isOverdue ? 'Overdue · ' : 'Due '}
            {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
          {t.priority}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {t.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

export default function SupportDashboard({ data }: { data: any }) {
  const { stats, tasksToday = [], upcomingTasks = [], announcements = [] } = data;

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <AnnouncementIcon className="w-5 h-5" /> Announcements
          </h2>
          <div className="space-y-3">
            {announcements.map((a: any) => (
              <div key={a.id} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <p className="text-sm font-semibold text-indigo-800">{a.title}</p>
                <p className="text-xs text-indigo-700 mt-1">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Open Tasks" value={stats?.openTasks ?? 0} icon={ClipboardDocumentListIcon} tint="bg-gray-100" color="text-gray-600" />
        <StatCard
          label="Overdue Tasks" value={stats?.overdueTasks ?? 0}
          icon={ClockIcon}
          tint={stats?.overdueTasks > 0 ? 'bg-red-50' : 'bg-gray-100'}
          color={stats?.overdueTasks > 0 ? 'text-red-600' : 'text-gray-600'}
        />
      </div>

      {/* Tasks due today */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Due Today</h2>
          <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {tasksToday.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No tasks due today</p>
        ) : (
          <div className="space-y-2">
            {tasksToday.map((t: any) => <TaskRow key={t.id} t={t} />)}
          </div>
        )}
      </div>

      {/* Upcoming tasks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Upcoming Tasks</h2>
          <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No upcoming tasks</p>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((t: any) => <TaskRow key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
