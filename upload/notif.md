# Notification System Documentation

This document explains how to implement a complete notification system for your application's topbar, including the bell icon with badge, dropdown menu, and full notification page.

---

## Table of Contents

1. [Database Schema (Prisma)](#1-database-schema-prisma)
2. [TypeScript Types](#2-typescript-types)
3. [API Routes](#3-api-routes)
4. [Frontend Implementation](#4-frontend-implementation)
   - [Notification Bell in Topbar](#41-notification-bell-in-topbar)
   - [Notification Dropdown](#42-notification-dropdown)
   - [Full Notification Page](#43-full-notification-page)
5. [Usage Examples](#5-usage-examples)
6. [Styling (Tailwind CSS)](#6-styling-tailwind-css)

---

## 1. Database Schema (Prisma)

Add this to your `prisma/schema.prisma`:

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String   // The user who receives this notification
  message    String   // Notification content
  type       String   @default("info") // info | warning | success | error
  read       Boolean  @default(false)  // Whether user has read it
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id])

  @@index([userId, read]) // For efficient querying of unread notifications
}
```

**Run migration:**
```bash
bun run db:push
```

---

## 2. TypeScript Types

Add to your `types/index.ts`:

```typescript
export type NotificationType = 'info' | 'warning' | 'success' | 'error';

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date | string;
}
```

---

## 3. API Routes

Create `src/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 most recent
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const notification = await db.notification.create({
      data: {
        userId: body.userId,
        message: body.message,
        type: body.type || 'info',
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PUT - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mark all notifications as read for a user
    if (body.markAllRead && body.userId) {
      await db.notification.updateMany({
        where: { userId: body.userId, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    // Mark single notification as read
    const notification = await db.notification.update({
      where: { id: body.id },
      data: { read: true },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

// DELETE - Remove a notification
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    await db.notification.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
```

---

## 4. Frontend Implementation

### 4.1 Notification Bell in Topbar

Add this to your topbar/header component:

```tsx
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// In your component:
const [notifications, setNotifications] = useState<Notification[]>([]);

// Fetch notifications function
const fetchNotifications = useCallback(async () => {
  if (!session?.user?.id) return;
  try {
    const res = await fetch(`/api/notifications?userId=${session.user.id}`);
    const data = await res.json();
    setNotifications(data);
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}, [session?.user?.id]);

// Mark all as read function
const handleMarkNotificationsRead = async () => {
  try {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true, userId: session?.user?.id }),
    });
    fetchNotifications();
  } catch {
    console.error('Failed to mark notifications as read');
  }
};

// Delete single notification
const handleDeleteNotification = async (id: string) => {
  try {
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  } catch {
    console.error('Failed to delete notification');
  }
};

// Calculate unread count
const unreadCount = notifications.filter(n => !n.read).length;

// JSX for the notification bell
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
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
          onClick={handleMarkNotificationsRead}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Mark All as Read
        </Button>
      )}
    </div>
    
    {/* Notification List */}
    {notifications.length === 0 ? (
      <div className="p-4 text-center text-muted-foreground">No notifications</div>
    ) : (
      <div className="max-h-[260px] overflow-y-auto">
        {notifications.slice(0, 4).map(n => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-3 hover:bg-muted/50 relative group ${
              !n.read ? 'bg-muted/30' : ''
            }`}
          >
            {/* Unread indicator */}
            {!n.read && (
              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
            )}
            
            {/* Type indicator dot */}
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
              n.type === 'info' ? 'bg-blue-500' :
              n.type === 'warning' ? 'bg-yellow-500' :
              n.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-tight">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
            
            {/* Delete button (visible on hover) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNotification(n.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    )}
    
    {/* View All Link */}
    {notifications.length > 4 && (
      <>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          className="justify-center text-primary cursor-pointer"
          onClick={() => setViewMode('notifications')} // Navigate to full page
        >
          View all {notifications.length} notifications
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.2 Full Notification Page

Create a full notifications page component:

```tsx
const NotificationsContent = () => {
  const unreadCount = notifications.filter(n => !n.read).length;
  const [markReadConfirmOpen, setMarkReadConfirmOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{unreadCount} unread notifications</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => setMarkReadConfirmOpen(true)}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Empty State */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Notifications</h3>
            <p className="text-muted-foreground">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        /* Notification List */
        <div className="space-y-2">
          {notifications.map(notification => (
            <Card 
              key={notification.id} 
              className={`${notification.read ? 'opacity-60' : ''} group relative overflow-hidden`}
            >
              <CardContent className="flex items-start gap-4 pt-6">
                {/* Type indicator */}
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                  notification.type === 'info' ? 'bg-blue-500' :
                  notification.type === 'warning' ? 'bg-yellow-500' :
                  notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm lg:text-base">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!notification.read && <Badge>New</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteNotification(notification.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark All Read Confirmation Dialog */}
      <AlertDialog open={markReadConfirmOpen} onOpenChange={setMarkReadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark All as Read</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark all notifications as read?
              This will clear all unread notification badges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkNotificationsRead}>
              Mark All as Read
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
```

---

## 5. Usage Examples

### Creating Notifications from Other API Routes

```typescript
// Example: In your schedule generation API
import { db } from '@/lib/db';

// After completing an action, create a notification
await db.notification.create({
  data: {
    userId: facultyId,
    message: 'New schedules have been generated and assigned to you. Please review your schedule.',
    type: 'info',
  },
});

// Multiple users - create notification for each
const notifiedUsers = new Set<string>();
for (const schedule of generatedSchedules) {
  if (!notifiedUsers.has(schedule.facultyId)) {
    await db.notification.create({
      data: {
        userId: schedule.facultyId,
        message: 'You have been assigned a new class schedule.',
        type: 'info',
      },
    });
    notifiedUsers.add(schedule.facultyId);
  }
}
```

### Creating Notifications via API Call

```typescript
// From any frontend component
const createNotification = async (userId: string, message: string, type: NotificationType = 'info') => {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message, type }),
  });
};

// Usage
await createNotification(user.id, 'Your schedule has been approved!', 'success');
await createNotification(user.id, 'Warning: You are approaching your maximum unit load.', 'warning');
await createNotification(user.id, 'Error: Schedule conflict detected.', 'error');
```

---

## 6. Styling (Tailwind CSS)

### Custom Scrollbar for Notification List

Add to your global CSS (`globals.css`):

```css
/* Hide scrollbar for notification dropdown */
.hide-scrollbar-mobile {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.hide-scrollbar-mobile::-webkit-scrollbar {
  width: 4px;
}

.hide-scrollbar-mobile::-webkit-scrollbar-track {
  background: transparent;
}

.hide-scrollbar-mobile::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.hide-scrollbar-mobile:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}
```

### Notification Type Colors

| Type    | Color Class       | Usage                                    |
|---------|-------------------|------------------------------------------|
| `info`  | `bg-blue-500`     | General information, announcements       |
| `success` | `bg-green-500`  | Successful actions, confirmations        |
| `warning` | `bg-yellow-500` | Warnings, approaching limits            |
| `error`   | `bg-red-500`    | Errors, critical issues, conflicts      |

---

## Quick Implementation Checklist

- [ ] Add `Notification` model to Prisma schema
- [ ] Run `bun run db:push` to create the table
- [ ] Add `Notification` interface to your types
- [ ] Create the `/api/notifications` route
- [ ] Add notification bell to your topbar
- [ ] Create the notification dropdown component
- [ ] Create the full notifications page
- [ ] Add notification creation to relevant actions (scheduling, conflicts, etc.)
- [ ] Style with Tailwind CSS classes

---

## Required Dependencies

Make sure you have these packages installed:

```bash
bun add lucide-react  # For icons (Bell, Trash2, CheckCircle, etc.)
```

### Required shadcn/ui Components

```bash
# Add these components if not already installed
bunx shadcn@latest add button
bunx shadcn@latest add dropdown-menu
bunx shadcn@latest add alert-dialog
bunx shadcn@latest add card
bunx shadcn@latest add badge
```

---

## File Structure Summary

```
src/
├── app/
│   ├── api/
│   │   └── notifications/
│   │       └── route.ts          # API endpoints
│   └── page.tsx                  # Main page with notification bell
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── dropdown-menu.tsx
│       ├── alert-dialog.tsx
│       ├── card.tsx
│       └── badge.tsx
├── types/
│   └── index.ts                  # Notification interface
└── prisma/
    └── schema.prisma             # Notification model
```

---

This documentation provides everything you need to implement a complete notification system in your application. The system includes:

- ✅ Database model with indexes for performance
- ✅ Full CRUD API routes
- ✅ Notification bell with unread badge
- ✅ Dropdown preview (4 most recent)
- ✅ Full notification page
- ✅ Mark all as read functionality
- ✅ Delete individual notifications
- ✅ Type-based color coding
- ✅ Responsive design
- ✅ Hover-to-reveal delete button
