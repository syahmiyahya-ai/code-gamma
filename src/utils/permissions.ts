
export type UserRole = 'Administrator' | 'Doctor' | 'Manager' | 'Admin' | 'Staff';

export const hasPermission = (role: UserRole | undefined, permission: string): boolean => {
  if (!role) return false;

  // Map old roles to new roles for backward compatibility during transition
  const normalizedRole = role === 'Admin' ? 'Administrator' : (role === 'Staff' ? 'Doctor' : role);

  switch (permission) {
    case 'manage_roster':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'approve_swaps':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'approve_leaves':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'manage_users':
      return normalizedRole === 'Administrator';
    case 'post_announcements':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'upload_documents':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'manage_owed_days':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    case 'view_admin_dashboard':
      return normalizedRole === 'Administrator' || normalizedRole === 'Manager';
    default:
      return false;
  }
};

export const isAdministrator = (role: UserRole | undefined) => hasPermission(role, 'manage_users');
export const isManager = (role: UserRole | undefined) => role === 'Manager';
export const isDoctor = (role: UserRole | undefined) => role === 'Doctor' || role === 'Staff';
export const canManageRoster = (role: UserRole | undefined) => hasPermission(role, 'manage_roster');
