export class BillingPolicy {
  static isStaff(currentUser) {
    return ['admin', 'manager'].includes(currentUser?.role);
  }

  static canViewPayment(currentUser, payment) {
    if (!currentUser || !payment) return false;
    if (this.isStaff(currentUser)) return true;
    return payment.user_id === currentUser.id;
  }

  static resolveTargetUserId(currentUser, requestedUserId) {
    if (this.isStaff(currentUser)) {
      return requestedUserId;
    }
    return currentUser?.id;
  }

  static resolveCreationUserId(currentUser, requestedUserId) {
    if (this.isStaff(currentUser)) {
      return requestedUserId || currentUser?.id;
    }
    return currentUser?.id;
  }
}

export default BillingPolicy;
