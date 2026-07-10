export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;
export const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'] as const;

export function isAdmin(role: string) {
  return ADMIN_ROLES.includes(role as any);
}

export function isManagerOrAbove(role: string) {
  return MANAGER_ROLES.includes(role as any);
}
