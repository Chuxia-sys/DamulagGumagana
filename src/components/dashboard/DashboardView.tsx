'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { StatsCard } from './StatsCard';
import { SchedulesChart } from './SchedulesChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  Calendar,
  AlertTriangle,
  User,
  Building2,
  BookOpen,
  DoorOpen,
  Zap,
  Activity,
  TrendingUp,
  Clock,
  ArrowRight,
  BookOpenCheck,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { DashboardStats, User as UserType, Schedule, Conflict } from '@/types';
import { cn } from '@/lib/utils';

type FacultyInfo = {
  id: string;
  name: string;
  email: string;
  department?: string | null;
};

type PreGenerationWarning = {
  type: string;
  message: string;
  severity: 'warning' | 'info';
  faculty?: FacultyInfo[];
};

export function DashboardView() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<Schedule[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [preGenerationWarnings, setPreGenerationWarnings] = useState<PreGenerationWarning[]>([]);

  const isFaculty = session?.user?.role === 'faculty';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, schedulesRes, conflictsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/schedules'),
        fetch('/api/conflicts'),
      ]);

      const statsData = await statsRes.json();
      const schedulesData = await schedulesRes.json();
      const conflictsData = await conflictsRes.json();

      setStats(statsData);
      // Ensure we always set arrays (APIs might return error objects)
      setRecentSchedules(Array.isArray(schedulesData) ? schedulesData.slice(0, 5) : []);
      setConflicts(Array.isArray(conflictsData?.conflicts) ? conflictsData.conflicts.slice(0, 5) : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      // Set default values on error
      setStats(null);
      setRecentSchedules([]);
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedules = () => {
    // Show confirmation dialog first
    setShowConfirmDialog(true);
  };

  const confirmGeneration = async () => {
    setShowConfirmDialog(false);
    // Then check for potential conflicts
    try {
      const checkRes = await fetch('/api/preferences/check-conflicts');
      const checkData = await checkRes.json();
      
      const warnings = checkData.conflicts?.filter((c: { severity: string }) => c.severity === 'warning') || [];
      
      if (warnings.length > 0) {
        // Show warning dialog before proceeding
        setPreGenerationWarnings(warnings);
        setShowWarningDialog(true);
        return;
      }
      
      // No warnings, proceed directly
      await executeGeneration();
    } catch {
      // If check fails, proceed anyway
      await executeGeneration();
    }
  };

  const executeGeneration = async () => {
    setShowWarningDialog(false);
    setGenerating(true);
    try {
      // Pass detected conflicts to the generate API so they can be saved
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clearExisting: true,
          detectedConflicts: preGenerationWarnings,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Show success message with conflict info
        if (data.savedConflicts && data.savedConflicts > 0) {
          toast.success(
            `Generated ${data.generated} schedules. ${data.savedConflicts} conflict(s) recorded for review.`,
            { duration: 6000 }
          );
        } else if (data.preGenerationWarnings && data.preGenerationWarnings.length > 0) {
          toast.info(
            `Generated ${data.generated} schedules. ${data.preGenerationWarnings.length} preference conflicts were detected but did not block generation.`,
            { duration: 6000 }
          );
        } else {
          toast.success(data.message);
        }
        fetchDashboardData();
      } else {
        toast.error(data.error || 'Failed to generate schedules');
        if (data.details) {
          console.error('Generation details:', data.details);
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate schedules');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = session?.user?.role === 'admin';
  const isDeptHead = session?.user?.role === 'department_head';

  // Faculty-specific dashboard
  if (isFaculty) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Welcome back, {session?.user?.name}
            </p>
          </div>
        </motion.div>

        {/* Faculty Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="My Schedules"
            value={stats?.totalSchedules || 0}
            description="Assigned classes"
            icon={Calendar}
            variant="success"
          />
          <StatsCard
            title="Teaching Load"
            value={`${stats?.facultyUtilizationAvg || 0}%`}
            description="Of max capacity"
            icon={TrendingUp}
          />
          <StatsCard
            title="Subjects"
            value={new Set(recentSchedules.map(s => s.subjectId)).size}
            description="Different subjects"
            icon={BookOpen}
          />
          <StatsCard
            title="Days Active"
            value={new Set(recentSchedules.map(s => s.day)).size}
            description="Teaching days per week"
            icon={Calendar}
          />
        </div>

        {/* My Schedule Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SchedulesChart
            data={stats?.schedulesByDay || []}
            title="My Schedule by Day"
            description="Distribution of your classes across the week"
            type="bar"
          />
          <SchedulesChart
            data={stats?.schedulesByStatus?.map(s => ({ name: s.status, value: s.count })) || []}
            title="Schedule Status"
            description="Current status of your schedules"
            type="pie"
          />
        </div>

        {/* My Upcoming Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Class Schedule
            </CardTitle>
            <CardDescription>Your upcoming classes for the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              {recentSchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium">No schedules assigned</p>
                  <p className="text-sm text-muted-foreground">
                    You have not been assigned any classes yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSchedules.map((schedule, index) => (
                    <div key={schedule.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <BookOpenCheck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{schedule.subject?.subjectName}</p>
                            <p className="text-sm text-muted-foreground">
                              {schedule.section?.sectionName} • {schedule.room?.roomName}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{schedule.day}</p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.startTime} - {schedule.endTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* My Teaching Load */}
        <Card>
          <CardHeader>
            <CardTitle>My Teaching Load</CardTitle>
            <CardDescription>Your current teaching load vs maximum capacity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">My Utilization</span>
                <span className="font-medium">{stats?.facultyUtilizationAvg || 0}%</span>
              </div>
              <Progress value={stats?.facultyUtilizationAvg || 0} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Current: {stats?.facultyUtilization?.[0]?.assigned || 0} units</span>
                <span>Max: {stats?.facultyUtilization?.[0]?.max || 24} units</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Dept Head Dashboard (original view)
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome back, {session?.user?.name}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleGenerateSchedules} disabled={generating} size="lg" className="w-full sm:w-auto">
            <Zap className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : 'Generate Schedules'}
          </Button>
        )}
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Total Faculty"
          value={stats?.totalFaculty || 0}
          description="Active faculty members"
          icon={Users}
          trend={{ value: 12, label: 'vs last semester', positive: true }}
        />
        <StatsCard
          title="Total Schedules"
          value={stats?.totalSchedules || 0}
          description="Generated schedules"
          icon={Calendar}
          variant="success"
        />
        <StatsCard
          title="Active Conflicts"
          value={stats?.totalConflicts || 0}
          description={stats?.totalConflicts === 0 ? 'No conflicts detected' : 'Requires attention'}
          icon={AlertTriangle}
          variant={stats?.totalConflicts && stats.totalConflicts > 0 ? 'danger' : 'success'}
        />
        <StatsCard
          title="Faculty Utilization"
          value={`${stats?.facultyUtilizationAvg || 0}%`}
          description="Average load percentage"
          icon={TrendingUp}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Departments"
          value={stats?.facultyByDepartment?.length || 0}
          icon={Building2}
        />
        <StatsCard
          title="Subjects"
          value={stats?.totalSubjects || 0}
          icon={BookOpen}
        />
        <StatsCard
          title="Rooms"
          value={stats?.totalRooms || 0}
          icon={DoorOpen}
        />
        <StatsCard
          title="Sections"
          value={stats?.totalSections || 0}
          icon={Users}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SchedulesChart
          data={stats?.schedulesByDay || []}
          title="Schedules by Day"
          description="Distribution of classes across the week"
          type="bar"
        />
        <SchedulesChart
          data={stats?.schedulesByStatus?.map(s => ({ name: s.status, value: s.count })) || []}
          title="Schedules by Status"
          description="Current schedule status breakdown"
          type="pie"
        />
      </div>

      {/* Recent Activity & Conflicts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Schedules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Schedules
            </CardTitle>
            <CardDescription>Latest schedule assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {recentSchedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No schedules generated yet
                </p>
              ) : (
                <div className="space-y-4">
                  {recentSchedules.map((schedule, index) => (
                    <div key={schedule.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{schedule.subject?.subjectName}</p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.faculty?.name} • {schedule.room?.roomName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{schedule.day}</p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.startTime} - {schedule.endTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conflicts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Conflicts
            </CardTitle>
            <CardDescription>Scheduling conflicts that need resolution</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {conflicts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-3 mb-4">
                    <Activity className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="font-medium">No Conflicts</p>
                  <p className="text-sm text-muted-foreground">
                    All schedules are conflict-free
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.map((conflict, index) => (
                    <div key={conflict.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-1.5 ${
                          conflict.severity === 'critical' 
                            ? 'bg-red-500/10 text-red-500' 
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {conflict.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {conflict.description}
                          </p>
                        </div>
                        <Badge variant={conflict.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {conflict.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Faculty Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty Load Distribution</CardTitle>
          <CardDescription>Current teaching load vs maximum capacity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Utilization</span>
              <span className="font-medium">{stats?.facultyUtilizationAvg || 0}%</span>
            </div>
            <Progress value={stats?.facultyUtilizationAvg || 0} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Underloaded: {stats?.underloadedFaculty || 0}</span>
              <span>Optimal</span>
              <span>Overloaded: {stats?.overloadedFaculty || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Generate Schedules
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                <p>
                  This will generate a new schedule for all sections, faculty, and subjects in the system.
                </p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">What happens when you proceed:</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Existing schedules will be cleared</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>New schedules will be assigned based on faculty preferences</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Conflicts will be detected and recorded</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Faculty will be notified of their new assignments</span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  The system will check for preference conflicts before generation.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmGeneration}
              className="bg-primary hover:bg-primary/90"
            >
              <Zap className="h-4 w-4 mr-2" />
              Start Generation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pre-generation Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Schedule Generation Warnings
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                <p>
                  The following potential conflicts were detected. The system can still generate schedules, 
                  but some faculty preferences may not be fully satisfied.
                </p>
                <ScrollArea className="max-h-[300px] rounded-md border p-3">
                  <AnimatePresence>
                    {preGenerationWarnings.map((warning, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'p-3 rounded-lg mb-2 last:mb-0',
                          warning.severity === 'warning' 
                            ? 'bg-amber-500/10 border border-amber-500/20' 
                            : 'bg-blue-500/10 border border-blue-500/20'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {warning.severity === 'warning' ? (
                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          ) : (
                            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{warning.type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-muted-foreground">{warning.message}</p>
                            {warning.faculty && warning.faculty.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Affected: {warning.faculty.map(f => typeof f === 'string' ? f : f.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </ScrollArea>
                <p className="text-sm text-muted-foreground">
                  The scheduling algorithm will use load balancing and specialization matching 
                  to resolve these conflicts automatically.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeGeneration}
              className="bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Proceed with Generation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
