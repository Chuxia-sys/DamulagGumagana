'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  Search,
  Sun,
  Moon,
  Settings,
  LogOut,
  User,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useAppStore } from '@/store';
import { useState, useEffect } from 'react';
import type { Notification } from '@/types';

export function Header() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { setViewMode } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user image separately (not stored in JWT to prevent token size issues)
  useEffect(() => {
    const fetchUserImage = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`/api/users/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setUserImage(data.image);
        }
      } catch (error) {
        console.error('Error fetching user image:', error);
      }
    };
    
    fetchUserImage();
  }, [session?.user?.id]);

  // Fetch notifications function
  const fetchNotifications = async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${session.user.id}`);
      const data = await res.json();
      // Ensure we always set an array
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  // Fetch notifications on mount and when session changes
  useEffect(() => {
    if (session?.user?.id) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        fetchNotifications();
      }, 0);
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => {
        clearTimeout(timeoutId);
        clearInterval(interval);
      };
    }
  }, [session?.user?.id]);

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, userId: session?.user?.id }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Delete single notification
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Get notification type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Calculate unread count (with safety check)
  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.read).length : 0;

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      admin: { label: 'Admin', variant: 'default' },
      department_head: { label: 'Dept Head', variant: 'secondary' },
      faculty: { label: 'Faculty', variant: 'outline' },
    };
    return badges[role] || { label: role, variant: 'outline' };
  };

  const roleBadge = getRoleBadge(session?.user?.role || '');

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.reload();
  };

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return notificationDate.toLocaleDateString();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b bg-card/80 backdrop-blur-sm px-4 lg:px-6">
      {/* Logo for mobile - only shows on mobile since sidebar is hidden */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <Image 
          src="/logo.png" 
          alt="FEPC Logo" 
          width={32} 
          height={32}
          className="rounded-lg"
        />
        <span className="font-bold text-sm">FEPC</span>
      </div>

      {/* Search - hidden on mobile */}
      <div className="hidden md:block w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search schedules, faculty, rooms..."
            className="pl-10 bg-background"
          />
        </div>
      </div>

      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}

        {/* Notifications Dropdown */}
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary"
                  onClick={handleMarkAllRead}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Mark All as Read
                </Button>
              )}
            </div>

            {/* Notification List */}
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-3 hover:bg-muted/50 relative group cursor-pointer ${
                      !n.read ? 'bg-muted/30' : ''
                    }`}
                    onClick={() => {
                      setNotificationsOpen(false);
                      setViewMode('notifications');
                    }}
                  >
                    {/* Type indicator dot with unread ring */}
                    <div className="relative mt-2 shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${getTypeColor(n.type)}`}
                      />
                      {!n.read && (
                        <div className={`absolute inset-0 w-2 h-2 rounded-full ${getTypeColor(n.type)} animate-ping opacity-50`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pl-1">
                      {n.title && (
                        <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                      )}
                      <p className="text-sm leading-tight line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteNotification(n.id, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* View All Link */}
            {notifications.length > 5 && (
              <>
                <DropdownMenuSeparator className="m-0" />
                <DropdownMenuItem
                  className="justify-center text-primary cursor-pointer"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setViewMode('notifications');
                  }}
                >
                  View all {notifications.length} notifications
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={userImage || ''} alt={session?.user?.name || ''} />
                <AvatarFallback>
                  {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                <div className="pt-2">
                  <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setViewMode('profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            {session?.user?.role === 'admin' && (
              <DropdownMenuItem onClick={() => setViewMode('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
