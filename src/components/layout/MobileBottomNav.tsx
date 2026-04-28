'use client';

import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useAppStore, type ViewMode } from '@/store';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Building2,
  BookOpen,
  DoorOpen,
  GraduationCap,
  Settings,
  Bell,
  AlertTriangle,
  CalendarDays,
  UserCog,
  FileText,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

// Primary navigation items for mobile bottom nav
const primaryNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, roles: ['admin', 'department_head', 'faculty'] },
  { id: 'calendar', label: 'Calendar', icon: Calendar, roles: ['admin', 'department_head', 'faculty'] },
  { id: 'schedules', label: 'Schedules', icon: CalendarDays, roles: ['admin', 'department_head'] },
  { id: 'faculty', label: 'Faculty', icon: Users, roles: ['admin', 'department_head'] },
  { id: 'subjects', label: 'Subjects', icon: BookOpen, roles: ['admin', 'department_head'] },
  { id: 'rooms', label: 'Rooms', icon: DoorOpen, roles: ['admin', 'department_head'] },
  { id: 'sections', label: 'Sections', icon: GraduationCap, roles: ['admin', 'department_head'] },
  { id: 'departments', label: 'Depts', icon: Building2, roles: ['admin'] },
  { id: 'users', label: 'Users', icon: UserCog, roles: ['admin'] },
  { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, roles: ['admin', 'department_head'] },
  { id: 'reports', label: 'Reports', icon: FileText, roles: ['admin', 'department_head'] },
  { id: 'preferences', label: 'Prefs', icon: Settings, roles: ['faculty'] },
  { id: 'notifications', label: 'Alerts', icon: Bell, roles: ['admin', 'department_head', 'faculty'] },
  { id: 'profile', label: 'Profile', icon: User, roles: ['admin', 'department_head', 'faculty'] },
  { id: 'settings', label: 'Settings', icon: Shield, roles: ['admin'] },
];

export function MobileBottomNav() {
  const { data: session } = useSession();
  const { viewMode, setViewMode } = useAppStore();

  const userRole = session?.user?.role || '';
  const filteredNavItems = primaryNavItems.filter(item => item.roles.includes(userRole));

  const handleNavClick = (id: ViewMode) => {
    setViewMode(id);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/80 safe-area-inset-bottom">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center justify-around px-2 py-2 gap-1">
          {filteredNavItems.slice(0, 5).map((item) => {
            const isActive = viewMode === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[56px] h-14 px-2 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 mb-1 transition-transform duration-200',
                  isActive && 'scale-110'
                )} />
                <span className={cn(
                  'text-[10px] font-medium',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -bottom-0.5 h-1 w-8 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
          
          {/* More button - shows remaining items in a dropdown */}
          {filteredNavItems.length > 5 && (
            <MoreNavItems 
              items={filteredNavItems.slice(5)} 
              currentView={viewMode}
              onNavClick={handleNavClick}
            />
          )}
        </div>
        <ScrollBar orientation="horizontal" className="h-0" />
      </ScrollArea>
    </nav>
  );
}

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MoreHorizontal } from 'lucide-react';

function MoreNavItems({ 
  items, 
  currentView, 
  onNavClick 
}: { 
  items: NavItem[]; 
  currentView: ViewMode;
  onNavClick: (id: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleItemClick = (id: ViewMode) => {
    onNavClick(id);
    setOpen(false);
  };

  const hasActiveItem = items.some(item => item.id === currentView);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            'flex flex-col items-center justify-center min-w-[56px] h-14 px-2 rounded-xl transition-all duration-200',
            hasActiveItem
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          <MoreHorizontal className={cn(
            'h-5 w-5 mb-1 transition-transform duration-200',
            hasActiveItem && 'scale-110'
          )} />
          <span className={cn(
            'text-[10px] font-medium',
            hasActiveItem && 'font-semibold'
          )}>
            More
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">More Options</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-4 gap-4 pb-6">
          {items.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-6 w-6 mb-2" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
