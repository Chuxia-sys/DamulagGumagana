'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DAYS, TIME_SLOTS } from '@/types';
import { useAppStore } from '@/store';
import { Calendar as CalendarIcon, Filter, Printer, Download, User, MapPin, Users, Clock, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTime12Hour, formatTimeRange } from '@/lib/utils';
import type { Schedule, User, Section, Room } from '@/types';

export function CalendarView() {
  const { data: session } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const { calendarFilters, setCalendarFilters } = useAppStore();

  const isFaculty = session?.user?.role === 'faculty';

  // Force faculty filter to their own ID immediately on mount
  // This overrides any persisted localStorage value
  useEffect(() => {
    if (isFaculty && session?.user?.id) {
      // Force set to their own ID, clearing any persisted value
      setCalendarFilters({ faculty: session.user.id });
    }
  }, [isFaculty, session?.user?.id, setCalendarFilters]);

  useEffect(() => {
    // Only fetch data after session is loaded
    if (session?.user) {
      fetchData();
    }
  }, [session?.user]);

  const fetchData = async () => {
    try {
      const [schedulesRes, usersRes, sectionsRes, roomsRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/users?role=faculty'),
        fetch('/api/sections'),
        fetch('/api/rooms'),
      ]);

      const schedulesData = await schedulesRes.json();
      const usersData = await usersRes.json();
      const sectionsData = await sectionsRes.json();
      const roomsData = await roomsRes.json();

      // Ensure we always set arrays
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      setFaculty(Array.isArray(usersData) ? usersData : []);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      // Set empty arrays on error
      setSchedules([]);
      setFaculty([]);
      setSections([]);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    // Faculty users can ONLY see their own schedules - enforce this at filter level
    // This is a security measure that overrides any stored filter value
    const effectiveFacultyFilter = isFaculty ? session?.user?.id : calendarFilters.faculty;
    
    return schedules.filter(s => {
      if (calendarFilters.section !== 'all' && s.sectionId !== calendarFilters.section) return false;
      if (effectiveFacultyFilter !== 'all' && effectiveFacultyFilter && s.facultyId !== effectiveFacultyFilter) return false;
      if (calendarFilters.day !== 'all' && s.day !== calendarFilters.day) return false;
      if (calendarFilters.room !== 'all' && s.roomId !== calendarFilters.room) return false;
      return true;
    });
  }, [schedules, calendarFilters, isFaculty, session?.user?.id]);

  const getScheduleForSlot = (day: string, time: string) => {
    return filteredSchedules.find(s => {
      return s.day === day && time >= s.startTime && time < s.endTime;
    });
  };

  const handlePrint = () => {
    const printContent = document.getElementById('calendar-print-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the calendar');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>FEPC Schedule Calendar</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .schedule-item { padding: 4px; margin: 2px 0; border-radius: 4px; }
            .approved { background-color: #d1fae5; }
            .generated { background-color: #dbeafe; }
            .modified { background-color: #fef3c7; }
            .conflict { background-color: #fee2e2; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>FEPC Schedule Calendar</h1>
          <p style="text-align: center;">Generated on ${new Date().toLocaleDateString()}</p>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExport = () => {
    const headers = ['Day', 'Start Time', 'End Time', 'Subject', 'Subject Code', 'Faculty', 'Section', 'Room', 'Status'];
    const rows = filteredSchedules.map(s => [
      s.day,
      s.startTime,
      s.endTime,
      s.subject?.subjectName || '',
      s.subject?.subjectCode || '',
      s.faculty?.name || '',
      s.section?.sectionName || '',
      s.room?.roomName || '',
      s.status
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fepc-schedule-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'generated': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'modified': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'conflict': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <CalendarIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isFaculty ? 'My Schedule Calendar' : 'Schedule Calendar'}
          </h1>
          <p className="text-muted-foreground">
            {isFaculty ? 'View your class schedules' : 'View and manage class schedules'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Section</label>
              <Select
                value={calendarFilters.section}
                onValueChange={(value) => setCalendarFilters({ section: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.sectionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Hide faculty filter for faculty users - they can only see their own */}
            {!isFaculty && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Faculty</label>
                <Select
                  value={calendarFilters.faculty}
                  onValueChange={(value) => setCalendarFilters({ faculty: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Faculty</SelectItem>
                    {faculty.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Day</label>
              <Select
                value={calendarFilters.day}
                onValueChange={(value) => setCalendarFilters({ day: value as typeof calendarFilters.day })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Room</label>
              <Select
                value={calendarFilters.room}
                onValueChange={(value) => setCalendarFilters({ room: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Rooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.roomName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto" id="calendar-print-content">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium w-20">Time</th>
                  {DAYS.map((day) => (
                    <th key={day} className="p-3 text-left text-sm font-medium min-w-[130px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, index) => (
                  <tr key={slot.startTime} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="p-2 text-xs text-muted-foreground font-medium border-r whitespace-nowrap">
                      {formatTime12Hour(slot.startTime)}
                    </td>
                    {DAYS.map((day) => {
                      const schedule = getScheduleForSlot(day, slot.startTime);
                      if (!schedule) {
                        return (
                          <td key={`${day}-${slot.startTime}`} className="p-1 border-r">
                            <div className="h-12" />
                          </td>
                        );
                      }
                      const isStart = schedule.startTime === slot.startTime;
                      const rowSpan = TIME_SLOTS.filter(
                        t => t.startTime >= schedule.startTime && t.startTime < schedule.endTime
                      ).length;

                      if (!isStart) return null;

                      return (
                        <td
                          key={`${day}-${slot.startTime}`}
                          rowSpan={rowSpan}
                          className="p-1 border-r"
                        >
                          <div className={`h-full rounded-lg p-2 border ${getStatusColor(schedule.status)} space-y-1`}>
                            <p className="font-semibold text-xs truncate">{schedule.subject?.subjectCode}</p>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0 opacity-70" />
                              <p className="text-[10px] truncate">{formatTimeRange(schedule.startTime, schedule.endTime)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0 opacity-70" />
                              <p className="text-[10px] truncate">{schedule.faculty?.name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                              <p className="text-[10px] truncate">{schedule.room?.roomName}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 shrink-0 opacity-70" />
                              <p className="text-[10px] truncate">{schedule.section?.sectionName}</p>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">Status:</span>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Approved</Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Generated</Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Modified</Badge>
              <Badge variant="outline" className="bg-red-500/10 text-red-600">Conflict</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
