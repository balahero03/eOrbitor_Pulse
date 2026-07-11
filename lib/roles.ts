export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;
export const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'] as const;

export function isAdmin(role: string) {
  return ADMIN_ROLES.includes(role as any);
}

export function isManagerOrAbove(role: string) {
  return MANAGER_ROLES.includes(role as any);
}

// Seniority ranking used to gate account management. SUPER_ADMIN sits above
// ADMIN, which sits above every other role. Higher number = more senior.
export function roleRank(role: string): number {
  switch (role) {
    case 'SUPER_ADMIN': return 3;
    case 'ADMIN': return 2;
    default: return 1;
  }
}

// Whether `actorRole` may manage (deactivate / edit / delete) a user with
// `targetRole`. An actor can only act on users STRICTLY below their own rank,
// so: ADMINs cannot touch each other or a SUPER_ADMIN, and a SUPER_ADMIN can
// never be deleted/deactivated by anyone (no role outranks it, and two
// SUPER_ADMINs cannot act on each other either).
export function canManageUser(actorRole: string, targetRole: string): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}
