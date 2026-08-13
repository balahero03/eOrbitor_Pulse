'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import {
  CheckCircleIcon, ExclamationTriangleIcon, EnvelopeIcon,
  ShieldCheckIcon, UserCircleIcon, ArrowPathIcon, ClipboardIcon, KeyIcon,
} from '@heroicons/react/24/outline';
import { InlineLoader } from '@/components/BrandedLoader';

interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  assignedTerritory: string | null;
  phone: string | null;
  employeeId: string | null;
  jobTitle: string | null;
  personalEmail: string | null;
  personalEmailVerifiedAt: string | null;
  createdAt: string;
}

// Same role badge colours as the sidebar user menu in the dashboard shell.
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  BACKEND_TEAM: { label: 'Backend Team', color: 'bg-blue-100 text-blue-700' },
  ON_FIELD_TEAM: { label: 'On Field Team', color: 'bg-green-100 text-green-700' },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-gray-900 mt-1 break-words">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  // Set when SMTP is unreachable, in development only — lets the flow be
  // completed without a mail server instead of dead-ending.
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [mailBroken, setMailBroken] = useState(false);

  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const applyProfile = useCallback((data: ProfileData) => {
    setProfile(data);
    setPhone(data.phone || '');
    setJobTitle(data.jobTitle || '');
    setPersonalEmail(data.personalEmail || '');
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load profile');
        return r.json();
      })
      .then(applyProfile)
      .catch(() => toast.error('Failed to load your profile'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seamless verification: while an address is awaiting confirmation, poll
  // quietly so clicking the link in another tab (or on a phone) flips this
  // page to "Verified" on its own. Without this the user has to guess that a
  // manual refresh is needed, which is exactly the rough edge to avoid.
  const isPending = !!profile?.personalEmail && !profile?.personalEmailVerifiedAt;
  const wasPending = useRef(false);

  useEffect(() => {
    if (!isPending) { wasPending.current = false; return; }
    wasPending.current = true;

    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${getToken()}` } });
        if (!res.ok) return;
        const data: ProfileData = await res.json();
        if (data.personalEmailVerifiedAt) {
          setProfile(data);
          setFallbackUrl('');
          setMailBroken(false);
          toast.success('Email verified — your account recovery is now set up.');
        }
      } catch {
        /* transient network blip; the next tick retries */
      }
    }, 4000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalEmail.trim()) {
      toast.error('A recovery email is required.');
      return;
    }

    setSaving(true);
    setFallbackUrl('');
    setMailBroken(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ phone, jobTitle, personalEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to save profile');
        return;
      }
      applyProfile(data);

      if (data.personalEmailVerifiedAt) {
        toast.success('Profile updated.');
      } else if (data.emailSent) {
        toast.success('Verification link sent — check your inbox.');
      } else if (data.emailSent === false) {
        setMailBroken(true);
        if (data.verifyUrl) setFallbackUrl(data.verifyUrl);
        toast.warning("Saved, but the verification email couldn't be sent.");
      } else {
        toast.success('Profile updated.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setFallbackUrl('');
    setMailBroken(false);
    try {
      const res = await fetch('/api/profile/send-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to send verification email');
        return;
      }
      if (data.emailSent) {
        toast.success('Verification link sent — check your inbox.');
      } else {
        setMailBroken(true);
        if (data.verifyUrl) setFallbackUrl(data.verifyUrl);
        toast.warning("The verification email couldn't be sent.");
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send verification email');
    } finally {
      setResending(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Could not change your password');
        return;
      }
      // The server revoked every token including this one, so staying on the
      // page would only produce a cascade of 401s. Clear it and go to login.
      toast.success('Password changed. Please sign in again.');
      localStorage.removeItem('token');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      console.error(err);
      toast.error('Could not change your password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <InlineLoader message="Loading profile…" />
    );
  }
  if (!profile) return null;

  const roleInfo = ROLE_LABELS[profile.role] || { label: profile.role, color: 'bg-gray-100 text-gray-600' };
  const isVerified = !!profile.personalEmailVerifiedAt;
  const initials = `${profile.firstName.charAt(0)}${(profile.lastName || '').charAt(0)}`;
  const emailDirty = personalEmail.trim().toLowerCase() !== (profile.personalEmail || '').toLowerCase();

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5 max-w-4xl">
      {/* Identity header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {profile.firstName} {profile.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleInfo.color}`}>{roleInfo.label}</span>
              {profile.jobTitle && <span className="text-xs text-gray-500">{profile.jobTitle}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Account recovery status — the one thing that actually needs action */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${isVerified ? 'bg-white border-gray-200' : 'bg-white border-amber-200'
        }`}>
        <div className={`px-5 sm:px-6 py-4 border-b flex items-center gap-3 ${isVerified ? 'bg-green-50/60 border-green-100' : 'bg-amber-50/60 border-amber-100'
          }`}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isVerified ? 'bg-green-100' : 'bg-amber-100'
            }`}>
            <ShieldCheckIcon className={`w-5 h-5 ${isVerified ? 'text-green-600' : 'text-amber-600'}`} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Account Recovery</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {isVerified
                ? 'You can reset your own password if you get locked out.'
                : 'Verify an email so you can reset your own password if you get locked out.'}
            </p>
          </div>
          <span className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${isVerified ? 'bg-green-100 text-green-700'
              : profile.personalEmail ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-700'
            }`}>
            {isVerified ? <><CheckCircleIcon className="w-3.5 h-3.5" /> Verified</>
              : profile.personalEmail ? <><EnvelopeIcon className="w-3.5 h-3.5" /> Awaiting confirmation</>
                : <><ExclamationTriangleIcon className="w-3.5 h-3.5" /> Not set up</>}
          </span>
        </div>

        <div className="p-3.5 sm:p-6">
          {isVerified ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 break-all">{profile.personalEmail}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verified on {new Date(profile.personalEmailVerifiedAt!).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ) : profile.personalEmail ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <ArrowPathIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0 animate-spin" style={{ animationDuration: '2.5s' }} />
                <p className="text-sm text-gray-700">
                  Waiting for you to confirm <span className="font-semibold break-all">{profile.personalEmail}</span>.
                  This page updates by itself the moment you click the link — no need to refresh.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                {resending
                  ? <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  : <EnvelopeIcon className="w-3.5 h-3.5" />}
                {resending ? 'Sending…' : 'Resend verification link'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              No recovery email yet. Add one below — without it, only an administrator can reset your password.
            </p>
          )}

          {/* Mail server down: explain plainly, and in dev offer the link directly */}
          {mailBroken && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3.5">
              <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                The mail server is unreachable, so no email was sent.
              </p>
              {fallbackUrl ? (
                <>
                  <p className="text-xs text-red-700 mt-2">
                    Development fallback — open this link to finish verifying:
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={fallbackUrl}
                      className="flex-1 min-w-0 text-xs text-blue-700 underline break-all bg-white rounded px-2 py-1.5 border border-red-200"
                    >
                      {fallbackUrl}
                    </a>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(fallbackUrl); toast.success('Link copied'); }}
                      className="flex-shrink-0 p-1.5 rounded border border-red-200 bg-white text-gray-500 hover:text-gray-800 transition-colors"
                      title="Copy link"
                    >
                      <ClipboardIcon className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-red-700 mt-1.5">
                  Please ask your administrator to configure the SMTP settings.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editable details */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <UserCircleIcon className="w-5 h-5 text-blue-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Your Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">You can update these yourself</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Recovery Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              A mailbox you can actually open — this is where password reset links go.
              {emailDirty && personalEmail.trim() && (
                <span className="text-amber-600 font-medium"> Changing this will require verifying the new address.</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Account Manager"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <KeyIcon className="w-5 h-5 text-gray-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
            <p className="text-xs text-gray-500 mt-0.5">You'll be signed out on all devices afterwards</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
              <p className="text-xs text-gray-400 mt-1.5">At least 8 characters.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500" />
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex justify-end">
          <button type="submit" disabled={changingPassword || !currentPassword || !newPassword}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2">
            {changingPassword && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {changingPassword ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </form>

      {/* Admin-managed, read-only */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Account</h2>
          <p className="text-xs text-gray-500 mt-0.5">Managed by your administrator</p>
        </div>
        <div className="p-3.5 sm:p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            <Field label="Login Email" value={profile.email} />
            <Field label="Employee ID" value={profile.employeeId || '—'} />
            <Field label="Department" value={profile.department || '—'} />
            <Field label="Territory" value={profile.assignedTerritory || '—'} />
            <Field
              label="Member Since"
              value={new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            />
          </dl>
          <p className="text-xs text-gray-400 mt-5 pt-4 border-t border-gray-100">
            Your login email is what you sign in with — it isn't necessarily a real mailbox, which is why the recovery
            email above is kept separate. To change anything in this section, contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
