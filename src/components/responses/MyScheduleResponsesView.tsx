'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  MapPin,
  BookOpen,
  Users,
  RefreshCw,
  AlertCircle,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatTime12Hour, formatTimeRange } from '@/lib/utils';

type Schedule = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: {
    subjectCode: string;
    subjectName: string;
    units: number;
  } | null;
  section: {
    sectionName: string;
    yearLevel: number;
  } | null;
  room: {
    roomName: string;
    building: string;
  } | null;
};

type ScheduleResponse = {
  id: string;
  scheduleId: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason: string | null;
  respondedAt: string | null;
  schedule: Schedule;
};

export function MyScheduleResponsesView() {
  const [pendingSchedules, setPendingSchedules] = useState<Schedule[]>([]);
  const [myResponses, setMyResponses] = useState<ScheduleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'responded'>('pending');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, responsesRes] = await Promise.all([
        fetch('/api/schedule-responses/pending'),
        fetch('/api/schedule-responses'),
      ]);

      const pendingData = await pendingRes.json();
      const responsesData = await responsesRes.json();

      setPendingSchedules(Array.isArray(pendingData) ? pendingData : []);
      setMyResponses(Array.isArray(responsesData) ? responsesData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch schedule data');
      setPendingSchedules([]);
      setMyResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (scheduleId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/schedule-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          status: 'accepted',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Schedule accepted successfully!');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to accept schedule');
      }
    } catch (error) {
      console.error('Error accepting schedule:', error);
      toast.error('Failed to accept schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSchedule) return;
    
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/schedule-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule.id,
          status: 'rejected',
          reason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Schedule rejected. The admin will be notified.');
        setShowRejectDialog(false);
        setSelectedSchedule(null);
        setRejectionReason('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to reject schedule');
      }
    } catch (error) {
      console.error('Error rejecting schedule:', error);
      toast.error('Failed to reject schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="h-8 w-8 text-primary" />
            My Schedule Responses
          </h1>
          <p className="text-muted-foreground">
            Review and respond to your schedule assignments
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Response</p>
                <p className="text-2xl font-bold text-amber-500">{pendingSchedules.length}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {myResponses.filter((r) => r.status === 'accepted').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-500">
                  {myResponses.filter((r) => r.status === 'rejected').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pending')}
          className="relative"
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending
          {pendingSchedules.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
              {pendingSchedules.length}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === 'responded' ? 'default' : 'outline'}
          onClick={() => setActiveTab('responded')}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Responded
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending Schedules</CardTitle>
            <CardDescription>
              Schedules waiting for your response. Please review and accept or reject them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-emerald-500/10 p-4 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="font-medium">All schedules responded!</p>
                <p className="text-sm text-muted-foreground">
                  You have no pending schedule responses
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <AnimatePresence>
                  <div className="space-y-4">
                    {pendingSchedules.map((schedule, index) => (
                      <motion.div
                        key={schedule.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-lg">
                                {schedule.subject?.subjectName || 'Unknown Subject'}
                              </p>
                              <Badge variant="outline">{schedule.subject?.subjectCode}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {schedule.day}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTimeRange(schedule.startTime, schedule.endTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {schedule.room?.roomName || 'TBA'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {schedule.section?.sectionName || 'TBA'}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">{schedule.subject?.units || 0} units</span>
                              {' • '}
                              {schedule.room?.building || 'Building TBA'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              className="bg-emerald-500 hover:bg-emerald-600"
                              onClick={() => handleAccept(schedule.id)}
                              disabled={submitting}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                setSelectedSchedule(schedule);
                                setShowRejectDialog(true);
                              }}
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Responded Schedules</CardTitle>
            <CardDescription>
              Your previous responses to schedule assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : myResponses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">No responses yet</p>
                <p className="text-sm text-muted-foreground">
                  Your schedule responses will appear here
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <AnimatePresence>
                  <div className="space-y-4">
                    {myResponses.map((response, index) => (
                      <motion.div
                        key={response.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">
                                {response.schedule.subject?.subjectName || 'Unknown Subject'}
                              </p>
                              {getStatusBadge(response.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {response.schedule.day}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTimeRange(response.schedule.startTime, response.schedule.endTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {response.schedule.room?.roomName || 'TBA'}
                              </span>
                            </div>
                            {response.status === 'rejected' && response.reason && (
                              <div className="flex items-start gap-2 text-sm text-red-500 mt-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>Reason: {response.reason}</span>
                              </div>
                            )}
                            {response.respondedAt && (
                              <p className="text-xs text-muted-foreground">
                                Responded on {new Date(response.respondedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              Reject Schedule
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this schedule. This will be sent to the admin for review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSchedule && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedSchedule.subject?.subjectName}</p>
                <p className="text-muted-foreground">
                  {selectedSchedule.day} • {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Reason for rejection *</label>
              <Textarea
                placeholder="Please explain why you cannot accept this schedule..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || !rejectionReason.trim()}
            >
              {submitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
