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

  // Người dùng thường chỉ sửa hồ sơ; đổi mật khẩu phải qua PUT /me/password (có kiểm tra mật khẩu cũ)
  static sanitizeUpdatePayload(currentUser, payload) {
    if (currentUser?.role === 'admin') return { ...payload };
    const { name, phone, address, avatar } = payload;
    return { name, phone, address, avatar };
  }
}

export default IdentityPolicy;
