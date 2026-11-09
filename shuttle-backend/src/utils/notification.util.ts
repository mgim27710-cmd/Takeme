import { User } from '../entities/user.entity';

export function isNotificationEnabled(
  user: User | null | undefined,
  type: 'change_request' | 'chat' | 'notice' | 'escort' | 'shuttle' | 'board'
): boolean {
  if (!user) return true;
  const settings = user.notificationSettings;
  if (!settings) {
    if (type === 'shuttle' && user.notifyShuttleOperation === false) return false;
    if (type === 'board' && user.notifyBoardPost === false) return false;
    return true;
  }

  // Master switch
  if (settings.all === false) return false;

  // Specific switch
  if (settings[type] === false) return false;

  // Compatibility checks
  if (type === 'shuttle' && (settings.notifyShuttleOperation === false || user.notifyShuttleOperation === false)) return false;
  if (type === 'board' && (settings.notifyBoardPost === false || user.notifyBoardPost === false)) return false;

  return true;
}

export function getUserNotificationSettings(user: User): Record<string, boolean> {
  const settings = user.notificationSettings || {};
  const role = user.role;

  if (role === 'HOMEROOM_TEACHER') {
    return {
      all: settings.all ?? true,
      change_request: settings.change_request ?? true,
      chat: settings.chat ?? true,
      notice: settings.notice ?? true,
    };
  } else if (role === 'TEACHER') {
    // 지도교사
    return {
      all: settings.all ?? true,
      change_request: settings.change_request ?? true,
      chat: settings.chat ?? true,
      notice: settings.notice ?? true,
    };
  } else if (role === 'DRIVER') {
    return {
      change_request: settings.change_request ?? true,
      escort: settings.escort ?? true,
      chat: settings.chat ?? true,
    };
  } else {
    // PARENT / ADMIN / etc.
    return {
      all: settings.all ?? true,
      notifyShuttleOperation: settings.notifyShuttleOperation ?? (user.notifyShuttleOperation !== false),
      notifyBoardPost: settings.notifyBoardPost ?? (user.notifyBoardPost !== false),
      change_request: settings.change_request ?? true,
      chat: settings.chat ?? true,
      notice: settings.notice ?? true,
      ...settings,
    };
  }
}

