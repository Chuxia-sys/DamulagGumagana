'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  Loader2,
  Building2,
  Calendar,
  Bell,
  Shield,
  Database,
  Globe,
  Mail,
  Clock,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store';

interface SystemSettings {
  institution_name: string;
  institution_code: string;
  max_faculty_units: string;
  min_faculty_units: string;
  academic_year: string;
  semester: string;
  auto_generate_enabled: boolean;
  conflict_detection_enabled: boolean;
  email_notifications: boolean;
  schedule_reminders: boolean;
  maintenance_mode: boolean;
}

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];
const ACADEMIC_YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

export function SettingsView() {
  const { data: session } = useSession();
  const { setViewMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seededStatus, setSeededStatus] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    institution_name: 'Far Eastern Polytechnic College',
    institution_code: 'FEPC',
    max_faculty_units: '24',
    min_faculty_units: '12',
    academic_year: '2024-2025',
    semester: '1st Semester',
    auto_generate_enabled: true,
    conflict_detection_enabled: true,
    email_notifications: true,
    schedule_reminders: true,
    maintenance_mode: false,
  });

  useEffect(() => {
    fetchSettings();
    checkSeedStatus();
  }, []);

  // Role-based access control - redirect non-admin users
  useEffect(() => {
    if (session && session.user?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      setViewMode('dashboard');
    }
  }, [session, setViewMode]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          ...data,
          // Convert string booleans to actual booleans
          auto_generate_enabled: data.auto_generate_enabled === 'true',
          conflict_detection_enabled: data.conflict_detection_enabled === 'true',
          email_notifications: data.email_notifications === 'true',
          schedule_reminders: data.schedule_reminders === 'true',
          maintenance_mode: data.maintenance_mode === 'true',
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSeedStatus = async () => {
    try {
      const res = await fetch('/api/seed');
      if (res.ok) {
        const data = await res.json();
        setSeededStatus(data.seeded);
      }
    } catch (error) {
      console.error('Error checking seed status:', error);
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success('Database seeded successfully! Demo data has been added.');
        setSeededStatus(true);
      } else {
        toast.error(data.error || 'Failed to seed database');
      }
    } catch {
      toast.error('Failed to seed database');
    } finally {
      setSeeding(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          // Convert booleans to strings for API
          auto_generate_enabled: String(settings.auto_generate_enabled),
          conflict_detection_enabled: String(settings.conflict_detection_enabled),
          email_notifications: String(settings.email_notifications),
          schedule_reminders: String(settings.schedule_reminders),
          maintenance_mode: String(settings.maintenance_mode),
        }),
      });
      
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SystemSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Check admin access
  if (session && session.user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You need administrator privileges to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Settings className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide preferences and options</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">
            <Building2 className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="system">
            <Shield className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Institution Settings</CardTitle>
              <CardDescription>Basic institution information and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="institution_name">Institution Name</Label>
                  <Input
                    id="institution_name"
                    value={settings.institution_name}
                    onChange={(e) => updateSetting('institution_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution_code">Institution Code</Label>
                  <Input
                    id="institution_code"
                    value={settings.institution_code}
                    onChange={(e) => updateSetting('institution_code', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Select
                    value={settings.academic_year}
                    onValueChange={(value) => updateSetting('academic_year', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACADEMIC_YEARS.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={settings.semester}
                    onValueChange={(value) => updateSetting('semester', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map((sem) => (
                        <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Settings */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
              <CardDescription>Configure schedule generation and management settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="max_faculty_units">Maximum Faculty Units</Label>
                  <Input
                    id="max_faculty_units"
                    type="number"
                    value={settings.max_faculty_units}
                    onChange={(e) => updateSetting('max_faculty_units', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum teaching units allowed per faculty
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_faculty_units">Minimum Faculty Units</Label>
                  <Input
                    id="min_faculty_units"
                    type="number"
                    value={settings.min_faculty_units}
                    onChange={(e) => updateSetting('min_faculty_units', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum teaching units required per faculty
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Schedule Generation</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate schedules based on faculty preferences
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_generate_enabled}
                    onCheckedChange={(checked) => updateSetting('auto_generate_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Conflict Detection</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically detect scheduling conflicts
                    </p>
                  </div>
                  <Switch
                    checked={settings.conflict_detection_enabled}
                    onCheckedChange={(checked) => updateSetting('conflict_detection_enabled', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure system notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <Label>Email Notifications</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for schedule changes
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={(checked) => updateSetting('email_notifications', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <Label>Schedule Reminders</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send reminders before scheduled classes
                    </p>
                  </div>
                  <Switch
                    checked={settings.schedule_reminders}
                    onCheckedChange={(checked) => updateSetting('schedule_reminders', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>Advanced system settings and maintenance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      <Label className="text-destructive">Maintenance Mode</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enable to temporarily disable user access
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">System Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Version</p>
                    <p className="font-medium">2.0.0</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Database</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">PostgreSQL</p>
                      <Badge variant="outline" className="text-xs">Connected</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Last Backup</p>
                    <p className="font-medium">Never</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Environment</p>
                    <Badge variant="secondary">Development</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Database Seed Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Demo Data</h4>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {seededStatus ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <Label>Database Seed Status</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {seededStatus 
                        ? 'Demo data has been loaded (faculty, subjects, rooms, sections)'
                        : 'Load demo data to test the scheduling system with sample faculty, subjects, rooms, and sections'}
                    </p>
                  </div>
                  <Button 
                    onClick={handleSeedDatabase} 
                    disabled={seeding || seededStatus === true}
                    variant={seededStatus ? 'outline' : 'default'}
                  >
                    {seeding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Seeding...
                      </>
                    ) : seededStatus ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Seeded
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Seed Database
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Database className="mr-2 h-4 w-4" />
                  Backup Database
                </Button>
                <Button variant="outline" size="sm">
                  <Globe className="mr-2 h-4 w-4" />
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
