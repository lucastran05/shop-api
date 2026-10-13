export class IdentityPolicy {
  static canViewUser(currentUser, targetUserId) {
    if (!currentUser) return false;
    const isPrivileged = ['admin', 'manager'].includes(currentUser.role);
    const isOwner = currentUser.id === targetUserId;
    return isPrivileged || isOwner;
  }

  static canUpdateUser(currentUser, targetUserId) {
    if (!currentUser) return false;
    const isAdmin = currentUser.role === 'admin';
    const isOwner = currentUser.id === targetUserId;
    return isAdmin || isOwner;
  }

  static sanitizeUpdatePayload(currentUser, payload) {
    const sanitized = { ...payload };
    const isAdmin = currentUser?.role === 'admin';
    if (!isAdmin) {
      delete sanitized.role;
      delete sanitized.active;
    }
    return sanitized;
  }
}

export default IdentityPolicy;
