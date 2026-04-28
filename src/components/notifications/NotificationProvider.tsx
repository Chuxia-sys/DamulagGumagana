'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export function NotificationProvider() {
  const { data: session, status } = useSession();
  const lastPollTime = useRef<string>(new Date().toISOString());
  const isInitialized = useRef(false);
  const processedIds = useRef<Set<string>>(new Set());

  const showNotification = useCallback((notification: Notification) => {
    // Skip if already processed
    if (processedIds.current.has(notification.id)) {
      return;
    }
    processedIds.current.add(notification.id);

    const icon = getNotificationIcon(notification.type);
    
    // Show toast notification in bottom-right corner
    toast.custom(
      (t) => (
        <div className="flex items-start gap-3 p-4 bg-card border rounded-lg shadow-lg max-w-sm w-full">
          <div className="flex-shrink-0 mt-0.5">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{notification.title}</p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ),
      {
        position: 'bottom-right',
        duration: 8000,
        id: notification.id, // Prevent duplicates
      }
    );
  }, []);

  const pollNotifications = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    try {
      const res = await fetch(
        `/api/notifications/poll?since=${encodeURIComponent(lastPollTime.current)}`
      );
      
      if (!res.ok) return;
      
      const data = await res.json();
      
      // Update last poll time
      if (data.timestamp) {
        lastPollTime.current = data.timestamp;
      }

      // Show new notifications as toasts
      if (data.notifications && data.notifications.length > 0) {
        // Sort by creation time (oldest first) so they appear in order
        const sortedNotifications = [...data.notifications].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        for (const notification of sortedNotifications) {
          showNotification(notification);
        }
      }
    } catch (error) {
      console.error('Error polling notifications:', error);
    }
  }, [status, session?.user?.id, showNotification]);

  useEffect(() => {
    // Only start polling when authenticated
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    // Skip if already initialized for this session
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    // Initial poll after a short delay
    const initialDelay = setTimeout(() => {
      pollNotifications();
    }, 2000);

    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(pollNotifications, 5000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(intervalId);
      isInitialized.current = false;
    };
  }, [status, session?.user?.id, pollNotifications]);

  // This component doesn't render anything
  return null;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'info':
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
}
