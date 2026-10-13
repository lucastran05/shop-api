export class NotificationPolicy {
  static isStaff(currentUser) {
    return ['admin', 'manager'].includes(currentUser?.role);
  }

  static canAccessNotification(currentUser, notification) {
    if (!currentUser || !notification) return false;
    if (this.isStaff(currentUser)) return true;

    const isUserIdMatch = notification.user_id === currentUser.id;
    const isOwnerMatch = notification.owner && notification.owner.toLowerCase() === currentUser.email?.toLowerCase();
    const isBroadcast = !notification.user_id && !notification.owner;

    return isUserIdMatch || isOwnerMatch || isBroadcast;
  }

  static resolveTargetRecipient(currentUser, { user_id, owner } = {}) {
    if (this.isStaff(currentUser)) {
      return {
        targetUserId: user_id,
        targetOwner: owner,
      };
    }

    return {
      targetUserId: currentUser?.id,
      targetOwner: currentUser?.email,
    };
  }
}

export default NotificationPolicy;
