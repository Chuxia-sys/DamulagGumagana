'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, MoreHorizontal, Pencil, Trash2, CalendarDays, Clock, User, MapPin, BookOpen,
  Users
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import type { Schedule, User, Section, Room, Subject, DayOfWeek } from '@/types';
import { DAYS, TIME_OPTIONS } from '@/types';
import { formatTimeRange } from '@/lib/utils';

export function SchedulesView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schedulesRes, usersRes, sectionsRes, roomsRes, subjectsRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/users?role=faculty'),
        fetch('/api/sections'),
        fetch('/api/rooms'),
        fetch('/api/subjects'),
      ]);

      const schedulesData = await schedulesRes.json();
      const usersData = await usersRes.json();
      const sectionsData = await sectionsRes.json();
      const roomsData = await roomsRes.json();
      const subjectsData = await subjectsRes.json();

      // Check for API errors
      if (usersData.error) {
        console.error('Faculty API error:', usersData.error);
        toast.error(`Failed to load faculty: ${usersData.error}`);
      }
      
      // Ensure we always set arrays (APIs might return error objects)
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      setFaculty(Array.isArray(usersData) ? usersData : []);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      
      // Show warning if no faculty available
      if (!Array.isArray(usersData) || usersData.length === 0) {
        console.warn('No faculty members found. Please add faculty users first.');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      // Set empty arrays on error
      setSchedules([]);
      setFaculty([]);
      setSections([]);
      setRooms([]);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedSchedule(null);
    setFormData({
      subjectId: '',
      facultyId: '',
      sectionId: '',
      roomId: '',
      day: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      subjectId: schedule.subjectId,
      facultyId: schedule.facultyId,
      sectionId: schedule.sectionId,
      roomId: schedule.roomId,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setDeleteDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.subjectId) errors.subjectId = 'Subject is required';
    if (!formData.facultyId) errors.facultyId = 'Faculty is required';
    if (!formData.sectionId) errors.sectionId = 'Section is required';
    if (!formData.roomId) errors.roomId = 'Room is required';
    if (!formData.day) errors.day = 'Day is required';
    if (!formData.startTime) errors.startTime = 'Start time is required';
    if (!formData.endTime) errors.endTime = 'End time is required';
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      errors.endTime = 'End time must be after start time';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const url = selectedSchedule ? `/api/schedules/${selectedSchedule.id}` : '/api/schedules';
      const method = selectedSchedule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          modifiedBy: 'current-user',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.conflicts && data.conflicts.length > 0) {
          toast.warning(`Schedule ${selectedSchedule ? 'updated' : 'created'} with ${data.conflicts.length} conflict(s)`);
        } else {
          toast.success(selectedSchedule ? 'Schedule updated' : 'Schedule created');
        }
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('Operation failed');
    }
  };

  const confirmDelete = async () => {
    if (!selectedSchedule) return;

    try {
      const res = await fetch(`/api/schedules/${selectedSchedule.id}?modifiedBy=current-user`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Schedule deleted');
        setDeleteDialogOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; class: string }> = {
      approved: { variant: 'default', class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
      generated: { variant: 'secondary', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      modified: { variant: 'outline', class: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
      conflict: { variant: 'destructive', class: 'bg-red-500/10 text-red-600 border-red-500/20' },
    };
    const style = styles[status] || styles.generated;
    return <Badge variant={style.variant} className={style.class}>{status}</Badge>;
  };

  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => {
        const subject = row.original.subject;
        return (
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{subject?.subjectCode}</p>
              <p className="text-xs text-muted-foreground">{subject?.subjectName}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'faculty',
      header: 'Faculty',
      cell: ({ row }) => {
        const faculty = row.original.faculty;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={faculty?.image || ''} alt={faculty?.name || ''} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {faculty?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{faculty?.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'section',
      header: 'Section',
      cell: ({ row }) => {
        const section = row.original.section;
        return (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{section?.sectionName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'room',
      header: 'Room',
      cell: ({ row }) => {
        const room = row.original.room;
        return (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{room?.roomName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'day',
      header: 'Day & Time',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{row.original.day}</p>
            <p className="text-xs text-muted-foreground">
              {formatTimeRange(row.original.startTime, row.original.endTime)}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(schedule)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <CalendarDays className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Schedules</h1>
          <p className="text-muted-foreground">Create and manage class schedules</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-sm text-muted-foreground">Total Schedules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">
              {schedules.filter(s => s.status === 'approved').length}
            </div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {schedules.filter(s => s.status === 'generated').length}
            </div>
            <p className="text-sm text-muted-foreground">Generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {schedules.filter(s => s.status === 'conflict').length}
            </div>
            <p className="text-sm text-muted-foreground">With Conflicts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={schedules}
            searchKey="day"
            searchPlaceholder="Search by day..."
            mobileCardRender={(schedule) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{schedule.subject?.subjectCode}</p>
                      <p className="text-xs text-muted-foreground">{schedule.subject?.subjectName}</p>
                    </div>
                  </div>
                  {getStatusBadge(schedule.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={schedule.faculty?.image || ''} alt={schedule.faculty?.name || ''} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {schedule.faculty?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{schedule.faculty?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{schedule.section?.sectionName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{schedule.room?.roomName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{schedule.day}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm font-medium">
                    {formatTimeRange(schedule.startTime, schedule.endTime)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(schedule)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSchedule ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
            <DialogDescription>
              {selectedSchedule ? 'Update schedule details' : 'Fill in the details to create a new schedule'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={formData.subjectId as string || ''}
                  onValueChange={(value) => setFormData({ ...formData, subjectId: value })}
                >
                  <SelectTrigger className={formErrors.subjectId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.subjectCode} - {subject.subjectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.subjectId && (
                  <p className="text-xs text-destructive">{formErrors.subjectId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Faculty</Label>
                <Select
                  value={formData.facultyId as string || ''}
                  onValueChange={(value) => setFormData({ ...formData, facultyId: value })}
                  disabled={faculty.length === 0}
                >
                  <SelectTrigger className={formErrors.facultyId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={faculty.length === 0 ? "No faculty available" : "Select faculty"} />
                  </SelectTrigger>
                  <SelectContent>
                    {faculty.length === 0 ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No faculty members found.
                        <br />
                        Please add faculty users first.
                      </div>
                    ) : (
                      faculty.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formErrors.facultyId && (
                  <p className="text-xs text-destructive">{formErrors.facultyId}</p>
                )}
                {faculty.length === 0 && (
                  <p className="text-xs text-amber-500">
                    No faculty available. Go to Users to add faculty members.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={formData.sectionId as string || ''}
                  onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                >
                  <SelectTrigger className={formErrors.sectionId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>{section.sectionName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.sectionId && (
                  <p className="text-xs text-destructive">{formErrors.sectionId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Room</Label>
                <Select
                  value={formData.roomId as string || ''}
                  onValueChange={(value) => setFormData({ ...formData, roomId: value })}
                >
                  <SelectTrigger className={formErrors.roomId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.roomName} ({room.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.roomId && (
                  <p className="text-xs text-destructive">{formErrors.roomId}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select
                  value={formData.day as string || 'Monday'}
                  onValueChange={(value) => setFormData({ ...formData, day: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select
                  value={formData.startTime as string || '08:00'}
                  onValueChange={(value) => setFormData({ ...formData, startTime: value })}
                >
                  <SelectTrigger className={formErrors.startTime ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.startTime && (
                  <p className="text-xs text-destructive">{formErrors.startTime}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select
                  value={formData.endTime as string || '10:00'}
                  onValueChange={(value) => setFormData({ ...formData, endTime: value })}
                >
                  <SelectTrigger className={formErrors.endTime ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select end time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.endTime && (
                  <p className="text-xs text-destructive">{formErrors.endTime}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSubmit} className="w-full sm:w-auto">
              {selectedSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
