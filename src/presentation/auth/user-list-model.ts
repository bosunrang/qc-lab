export function userListModel(users: unknown, currentUserId: unknown) {
  return (Array.isArray(users) ? users : []).map((user: Record<string, any>) => ({
    ...user, id: String(user.id || ''), name: String(user.name || user.username || ''), username: String(user.username || ''),
    initials: String(user.initials || ''), role: String(user.role || 'viewer'), active: user.active !== false,
    current: String(user.id || '') === String(currentUserId || ''),
  }));
}
