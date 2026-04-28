import { io, Socket } from 'socket.io-client';

let notificationSocket: Socket | null = null;

/**
 * Get or create a socket connection to the notification service
 * This is used by API routes to send real-time notifications
 */
function getNotificationSocket(): Socket {
  if (!notificationSocket || !notificationSocket.connected) {
    notificationSocket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    notificationSocket.on('connect', () => {
      console.log('[NotificationClient] Connected to notification service');
    });

    notificationSocket.on('disconnect', () => {
      console.log('[NotificationClient] Disconnected from notification service');
    });

    notificationSocket.on('connect_error', (error) => {
      console.error('[NotificationClient] Connection error:', error);
    });
  }

  return notificationSocket;
}

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Send a real-time notification to a specific user
 * @param payload - Notification details including userId, title, message, and type
 * @returns boolean indicating if the notification was sent successfully
 */
export function sendNotificationToUser(payload: NotificationPayload): boolean {
  try {
    const socket = getNotificationSocket();
    
    if (!socket.connected) {
      console.warn('[NotificationClient] Socket not connected, attempting to connect...');
      socket.connect();
      
      // Wait briefly for connection
      setTimeout(() => {
        if (socket.connected) {
          socket.emit('send-notification', {
            ...payload,
            type: payload.type || 'info',
          });
        } else {
          console.error('[NotificationClient] Failed to connect to notification service');
        }
      }, 100);
    } else {
      socket.emit('send-notification', {
        ...payload,
        type: payload.type || 'info',
      });
    }
    
    return true;
  } catch (error) {
    console.error('[NotificationClient] Error sending notification:', error);
    return false;
  }
}

/**
 * Send a notification to multiple users
 * @param userIds - Array of user IDs to notify
 * @param title - Notification title
 * @param message - Notification message
 * @param type - Notification type
 */
export function sendNotificationToUsers(
  userIds: string[],
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  for (const userId of userIds) {
    sendNotificationToUser({ userId, title, message, type });
  }
}

/**
 * Broadcast a notification to all connected users
 * @param title - Notification title
 * @param message - Notification message
 * @param type - Notification type
 */
export function broadcastNotification(
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  try {
    const socket = getNotificationSocket();
    socket.emit('broadcast-notification', { title, message, type });
  } catch (error) {
    console.error('[NotificationClient] Error broadcasting notification:', error);
  }
}

/**
 * Notify a faculty member about schedule changes
 */
export function notifyScheduleChange(
  facultyId: string,
  action: 'created' | 'updated' | 'deleted',
  subjectName: string,
  day: string,
  time: string
): void {
  const actionText = {
    created: 'assigned to',
    updated: 'updated for',
    deleted: 'removed from',
  };

  sendNotificationToUser({
    userId: facultyId,
    title: `Schedule ${action === 'deleted' ? 'Removed' : action.charAt(0).toUpperCase() + action.slice(1)}`,
    message: `You have been ${actionText[action]} ${subjectName} on ${day} (${time})`,
    type: action === 'deleted' ? 'warning' : 'info',
  });
}
