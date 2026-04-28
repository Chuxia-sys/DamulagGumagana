'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Calendar,
  User,
  MapPin,
  BookOpen,
  Users,
  AlertCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatTime12Hour, formatTimeRange } from '@/lib/utils';
import { DAYS } from '@/types';

type ScheduleResponse = {
  id: string;
  scheduleId: string;
  facultyId: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason: string | null;
  respondedAt: string | null;
  createdAt: string;
  schedule: {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subject: {
      subjectCode: string;
      subjectName: string;
    } | null;
    section: {
      sectionName: string;
    } | null;
    room: {
      roomName: string;
    } | null;
  };
  faculty: {
    id: string;
    name: string;
    email: string;
    department: {
      name: string;
    } | null;
  };
};

export function ScheduleResponsesView() {
  const [responses, setResponses] = useState<ScheduleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedResponse, setSelectedResponse] = useState<ScheduleResponse | null>(null);

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schedule-responses');
      const data = await res.json();
      if (Array.isArray(data)) {
        setResponses(data);
      } else {
        setResponses([]);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      toast.error('Failed to fetch schedule responses');
      setResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredResponses = responses.filter((response) => {
    const matchesSearch =
      response.faculty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.schedule.subject?.subjectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.schedule.subject?.subjectCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || response.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const stats = {
    total: responses.length,
    pending: responses.filter((r) => r.status === 'pending').length,
    accepted: responses.filter((r) => r.status === 'accepted').length,
    rejected: responses.filter((r) => r.status === 'rejected').length,
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
            <ClipboardCheck className="h-8 w-8 text-primary" />
            Schedule Responses
          </h1>
          <p className="text-muted-foreground">
            View faculty responses to schedule assignments
          </p>
        </div>
        <Button variant="outline" onClick={fetchResponses} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
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
                <p className="text-2xl font-bold text-emerald-500">{stats.accepted}</p>
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
                <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by faculty or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Responses List */}
      <Card>
        <CardHeader>
          <CardTitle>Response List</CardTitle>
          <CardDescription>
            {filteredResponses.length} response{filteredResponses.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No responses found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Faculty responses will appear here'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <AnimatePresence>
                <div className="space-y-4">
                  {filteredResponses.map((response, index) => (
                    <motion.div
                      key={response.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {index > 0 && <Separator className="mb-4" />}
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedResponse(response)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            {getStatusIcon(response.status)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{response.schedule.subject?.subjectName || 'Unknown Subject'}</p>
                              {getStatusBadge(response.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {response.faculty.name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {response.schedule.day}
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {formatTimeRange(response.schedule.startTime, response.schedule.endTime)}
                              </span>
                            </div>
                            {response.status === 'rejected' && response.reason && (
                              <div className="flex items-start gap-1 text-sm text-red-500 mt-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span className="line-clamp-1">{response.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{response.faculty.department?.name || 'No Department'}</p>
                          {response.respondedAt && (
                            <p className="text-xs">
                              Responded: {new Date(response.respondedAt).toLocaleDateString()}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedResponse && getStatusIcon(selectedResponse.status)}
              Response Details
            </DialogTitle>
            <DialogDescription>
              Schedule response information
            </DialogDescription>
          </DialogHeader>
          {selectedResponse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faculty</p>
                  <p className="font-medium">{selectedResponse.faculty.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedResponse.faculty.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedResponse.faculty.department?.name || 'N/A'}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">
                  {selectedResponse.schedule.subject?.subjectName} ({selectedResponse.schedule.subject?.subjectCode})
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Day</p>
                  <p className="font-medium">{selectedResponse.schedule.day}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {formatTime12Hour(selectedResponse.schedule.startTime)} - {formatTime12Hour(selectedResponse.schedule.endTime)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{selectedResponse.schedule.room?.roomName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-medium">{selectedResponse.schedule.section?.sectionName || 'N/A'}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(selectedResponse.status)}</div>
              </div>
              {selectedResponse.status === 'rejected' && selectedResponse.reason && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Rejection Reason
                  </p>
                  <p className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
                    {selectedResponse.reason}
                  </p>
                </div>
              )}
              {selectedResponse.respondedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Responded At</p>
                  <p className="font-medium">{new Date(selectedResponse.respondedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
