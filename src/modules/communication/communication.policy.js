export class CommunicationPolicy {
  static isStaff(currentUser) {
    return ['admin', 'manager'].includes(currentUser?.role);
  }

  static canViewMessage(currentUser, message) {
    if (!currentUser || !message) return false;
    if (this.isStaff(currentUser)) return true;
    return message.owner === currentUser.email || message.sender_id === currentUser.id;
  }

  static canMutateMessage(currentUser, message) {
    if (!currentUser || !message) return false;
    if (this.isStaff(currentUser)) return true;
    return message.sender_id === currentUser.id;
  }

  static canDeleteConversation(currentUser, owner) {
    if (!currentUser) return false;
    if (this.isStaff(currentUser)) return true;
    return currentUser.email === owner;
  }

  static resolveTargetOwner(currentUser, requestedOwner) {
    if (this.isStaff(currentUser)) {
      return requestedOwner;
    }
    return currentUser?.email;
  }
}

export default CommunicationPolicy;
