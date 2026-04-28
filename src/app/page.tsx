'use client';

import { useSession } from 'next-auth/react';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/components/auth/LoginPage';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { CalendarView } from '@/components/calendar/CalendarView';
import { FacultyView } from '@/components/tables/FacultyView';
import { SubjectsView } from '@/components/tables/SubjectsView';
import { RoomsView } from '@/components/tables/RoomsView';
import { SectionsView } from '@/components/tables/SectionsView';
import { DepartmentsView } from '@/components/tables/DepartmentsView';
import { SchedulesView } from '@/components/tables/SchedulesView';
import { UsersView } from '@/components/tables/UsersView';
import { ConflictsView } from '@/components/tables/ConflictView';
import { NotificationsView } from '@/components/tables/NotificationsView';
import { ProfileView } from '@/components/tables/ProfileView';
import { PreferencesView } from '@/components/tables/PreferencesView';
import { ReportsView } from '@/components/tables/ReportsView';
import { SettingsView } from '@/components/tables/SettingsView';
import { ScheduleResponsesView } from '@/components/responses/ScheduleResponsesView';
import { MyScheduleResponsesView } from '@/components/responses/MyScheduleResponsesView';
import { useAppStore, type ViewMode } from '@/store';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

// Define which roles can access which views
const viewPermissions: Record<ViewMode, string[]> = {
  dashboard: ['admin', 'department_head', 'faculty'],
  calendar: ['admin', 'department_head', 'faculty'],
  schedules: ['admin', 'department_head'],
  faculty: ['admin', 'department_head'],
  subjects: ['admin', 'department_head'],
  rooms: ['admin', 'department_head'],
  sections: ['admin', 'department_head'],
  departments: ['admin'],
  users: ['admin'],
  conflicts: ['admin', 'department_head'],
  notifications: ['admin', 'department_head', 'faculty'],
  profile: ['admin', 'department_head', 'faculty'],
  preferences: ['faculty'],
  reports: ['admin', 'department_head'],
  settings: ['admin'],
  'schedule-responses': ['admin'],
  'my-responses': ['faculty'],
};

export default function Home() {
  const { status, data: session } = useSession();
  const { viewMode, setViewMode } = useAppStore();

  // Redirect unauthorized users to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const allowedRoles = viewPermissions[viewMode];
      if (allowedRoles && !allowedRoles.includes(session.user.role)) {
        setViewMode('dashboard');
      }
    }
  }, [status, session, viewMode, setViewMode]);

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  // Render the appropriate view based on viewMode
  const renderView = () => {
    switch (viewMode) {
      case 'dashboard':
        return <DashboardView />;
      case 'calendar':
        return <CalendarView />;
      case 'schedules':
        return <SchedulesView />;
      case 'faculty':
        return <FacultyView />;
      case 'subjects':
        return <SubjectsView />;
      case 'rooms':
        return <RoomsView />;
      case 'sections':
        return <SectionsView />;
      case 'departments':
        return <DepartmentsView />;
      case 'users':
        return <UsersView />;
      case 'conflicts':
        return <ConflictsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'profile':
        return <ProfileView />;
      case 'preferences':
        return <PreferencesView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      case 'schedule-responses':
        return <ScheduleResponsesView />;
      case 'my-responses':
        return <MyScheduleResponsesView />;
      default:
        return <DashboardView />;
    }
  };

  return <AppShell>{renderView()}</AppShell>;
}
