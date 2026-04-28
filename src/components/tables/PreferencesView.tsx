'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Clock,
  Calendar,
  BookOpen,
  Save,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Subject, FacultyPreference } from '@/types';
import { DAYS, SPECIALIZATION_OPTIONS, TIME_OPTIONS } from '@/types';
import { formatTime12Hour, formatTimeRange } from '@/lib/utils';

export function PreferencesView() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [preferences, setPreferences] = useState<FacultyPreference | null>(null);
  const [formData, setFormData] = useState({
    preferredDays: [] as string[],
    preferredTimeStart: '08:00',
    preferredTimeEnd: '17:00',
    preferredSubjects: [] as string[],
    unavailableDays: [] as string[],
    notes: '',
  });

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session?.user?.id]);

  const fetchData = async () => {
    try {
      const [subjectsRes, userRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch(`/api/users/${session?.user?.id}`),
      ]);

      const subjectsData = await subjectsRes.json();
      const userData = await userRes.json();

      setSubjects(subjectsData);

      if (userData.preferences) {
        setPreferences(userData.preferences);
        setFormData({
          preferredDays: userData.preferences.preferredDays || [],
          preferredTimeStart: userData.preferences.preferredTimeStart || '08:00',
          preferredTimeEnd: userData.preferences.preferredTimeEnd || '17:00',
          preferredSubjects: userData.preferences.preferredSubjects || [],
          unavailableDays: userData.preferences.unavailableDays || [],
          notes: userData.preferences.notes || '',
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: session?.user?.id,
          ...formData,
        }),
      });

      if (res.ok) {
        toast.success('Preferences saved successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save preferences');
      }
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter(d => d !== day)
        : [...prev.preferredDays, day],
    }));
  };

  const toggleSubject = (subjectId: string) => {
    setFormData(prev => ({
      ...prev,
      preferredSubjects: prev.preferredSubjects.includes(subjectId)
        ? prev.preferredSubjects.filter(s => s !== subjectId)
        : [...prev.preferredSubjects, subjectId],
    }));
  };

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
          <h1 className="text-3xl font-bold tracking-tight">My Preferences</h1>
          <p className="text-muted-foreground">
            Set your scheduling preferences for better schedule allocation
          </p>
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
              Save Preferences
            </>
          )}
        </Button>
      </div>

      {/* Current Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Preference Status</p>
              <p className="text-sm text-muted-foreground">
                {preferences
                  ? 'Your preferences are saved and will be considered during schedule generation.'
                  : 'Set your preferences to get schedules that match your availability.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Preferred Days */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Preferred Teaching Days
            </CardTitle>
            <CardDescription>
              Select the days you prefer to teach
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.preferredDays.includes(day)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => toggleDay(day)}
                >
                  <span className="text-sm font-medium">{day.slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Selected: {formData.preferredDays.length} day(s)
            </p>
          </CardContent>
        </Card>

        {/* Preferred Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Preferred Time Range
            </CardTitle>
            <CardDescription>
              Set your preferred teaching hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select
                  value={formData.preferredTimeStart}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, preferredTimeStart: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select
                  value={formData.preferredTimeEnd}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, preferredTimeEnd: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formatTimeRange(formData.preferredTimeStart, formData.preferredTimeEnd)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preferred Subjects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Preferred Subjects
          </CardTitle>
          <CardDescription>
            Select subjects you prefer to teach (based on your specializations)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    formData.preferredSubjects.includes(subject.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => toggleSubject(subject.id)}
                >
                  <Checkbox
                    checked={formData.preferredSubjects.includes(subject.id)}
                    onCheckedChange={() => toggleSubject(subject.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{subject.subjectCode}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {subject.subjectName}
                    </p>
                  </div>
                  <Badge variant="outline">{subject.units} units</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            Selected: {formData.preferredSubjects.length} subject(s)
          </p>
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
          <CardDescription>
            Add any special notes or requests for the scheduler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[100px] p-3 rounded-lg border bg-background resize-none"
            placeholder="E.g., I prefer morning classes due to research work in the afternoon..."
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* Specializations */}
      <Card>
        <CardHeader>
          <CardTitle>Your Specializations</CardTitle>
          <CardDescription>
            Subjects you are qualified to teach (contact admin to update)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.slice(0, 8).map((spec) => (
              <Badge key={spec} variant="secondary">
                {spec}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
