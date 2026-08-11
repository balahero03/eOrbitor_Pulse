import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { issueEmailVerification, mayExposeVerifyUrl } from '@/lib/emailVerification';
import { sendMailAfterResponse, buildRecoveryEmailChangedEmail, maskEmail } from '@/lib/mail';

// Deliberately separate from the admin-only /api/users/[id] route rather than
// relaxing that route's `isAdmin` guard — this one only ever touches the
// caller's own record (`auth.id`), and only the handful of fields a user may
// safely self-edit. Identity fields (name/role/department/employeeId/...)
// stay admin-managed, matching how the rest of the app treats org data.
const PROFILE_SELECT = {
  id: true, email: true, firstName: true, lastName: true, role: true,
  department: true, assignedTerritory: true, phone: true, employeeId: true,
  jobTitle: true, personalEmail: true, personalEmailVerifiedAt: true, createdAt: true,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = withAuth(async (_req: NextRequest, auth: AuthUser) => {
  const me = await prisma.user.findUnique({ where: { id: auth.id }, select: PROFILE_SELECT });
  if (!me) return NextResponse.json({ message: 'User not found' }, { status: 404 });
  return NextResponse.json(me);
});

export const PATCH = withAuth(async (req: NextRequest, auth: AuthUser) => {
  const body = await req.json().catch(() => ({}));
  const { phone, jobTitle, personalEmail } = body;

  const current = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { firstName: true, personalEmail: true },
  });
  if (!current) return NextResponse.json({ message: 'User not found' }, { status: 404 });

  const updateData: any = {};
  if (phone !== undefined) updateData.phone = phone || null;
  if (jobTitle !== undefined) updateData.jobTitle = jobTitle || null;

  let emailChanged = false;
  if (personalEmail !== undefined) {
    const trimmed = (typeof personalEmail === 'string' ? personalEmail : '').trim().toLowerCase();
    if (trimmed && !EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ message: 'Enter a valid email address' }, { status: 400 });
    }
    if (trimmed !== (current.personalEmail || '')) {
      if (trimmed) {
        const clash = await prisma.user.findFirst({
          where: { personalEmail: trimmed, NOT: { id: auth.id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json({ message: 'That email is already registered to another account' }, { status: 400 });
        }
      }
      // A changed address is unverified until the new link is confirmed,
      // even if the previous one had already been verified.
      updateData.personalEmail = trimmed || null;
      updateData.personalEmailVerifiedAt = null;
      emailChanged = true;

      // Warn the address being replaced — never the new one, whose owner
      // already knows. Someone who has taken over a live session can
      // otherwise redirect password recovery to a mailbox they control in
      // complete silence, which converts temporary access into permanent
      // ownership of the account.
      if (current.personalEmail) {
        sendMailAfterResponse('recovery-email-change alert', {
          to: current.personalEmail,
          subject: 'Your eOrbitor Pulse recovery email was changed',
          html: buildRecoveryEmailChangedEmail({
            firstName: current.firstName,
            newEmailMasked: trimmed ? maskEmail(trimmed) : '(removed)',
          }),
        });
      }
    }
  }

  const updated = await prisma.user.update({ where: { id: auth.id }, data: updateData, select: PROFILE_SELECT });

  if (emailChanged && updated.personalEmail) {
    const { delivery, verifyUrl } = await issueEmailVerification(
      { id: auth.id, firstName: updated.firstName, personalEmail: updated.personalEmail },
      req
    );
    return NextResponse.json({
      ...updated,
      emailSent: delivery.ok,
      mailProblem: delivery.ok ? undefined : delivery.reason,
      // Dev-only escape hatch so the flow is completable without a mail
      // server — see the note on IssueResult.verifyUrl.
      verifyUrl: !delivery.ok && mayExposeVerifyUrl() ? verifyUrl : undefined,
    });
  }

  return NextResponse.json(updated);
});
