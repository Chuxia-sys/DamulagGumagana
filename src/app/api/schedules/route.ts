import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyScheduleChange } from '@/lib/notification-client';

// GET /api/schedules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const facultyId = searchParams.get('facultyId');
    const sectionId = searchParams.get('sectionId');
    const roomId = searchParams.get('roomId');
    const day = searchParams.get('day');

    // Role-based filtering
    const isFaculty = session.user.role === 'faculty';
    const isDeptHead = session.user.role === 'department_head';
    const isAdmin = session.user.role === 'admin';

    // Faculty can ONLY see their own schedules - ignore any facultyId param
    // This is a security measure to ensure faculty can't see other faculty's schedules
    const filterFacultyId = isFaculty ? session.user.id : facultyId;

    // Department heads can only see schedules from their department
    let filterDepartmentId = departmentId;
    if (isDeptHead && !isAdmin) {
      filterDepartmentId = session.user.departmentId || departmentId;
    }

    const schedules = await db.schedule.findMany({
      where: {
        ...(filterDepartmentId && { section: { departmentId: filterDepartmentId } }),
        ...(filterFacultyId && { facultyId: filterFacultyId }),
        ...(sectionId && { sectionId }),
        ...(roomId && { roomId }),
        ...(day && { day }),
      },
      include: {
        subject: { include: { department: true } },
        faculty: { include: { department: true } },
        section: { include: { department: true } },
        room: true,
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/schedules
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and department_head can create schedules
    const isAdmin = session.user.role === 'admin';
    const isDeptHead = session.user.role === 'department_head';
    
    if (!isAdmin && !isDeptHead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { subjectId, facultyId, sectionId, roomId, day, startTime, endTime } = body;

    if (!subjectId || !facultyId || !sectionId || !roomId || !day || !startTime || !endTime) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: 'Invalid time format. Use HH:MM format.' }, { status: 400 });
    }

    if (startTime >= endTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Department head check - can only create schedules for their department
    if (isDeptHead && !isAdmin) {
      const section = await db.section.findUnique({ where: { id: sectionId } });
      if (section && section.departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'You can only create schedules for your department' }, { status: 403 });
      }
    }

    // Check for conflicts
    const conflicts = await checkConflicts(facultyId, roomId, sectionId, day, startTime, endTime);

    // Create schedule
    const schedule = await db.schedule.create({
      data: {
        subjectId,
        facultyId,
        sectionId,
        roomId,
        day,
        startTime,
        endTime,
        status: conflicts.length > 0 ? 'conflict' : 'approved',
      },
      include: {
        subject: true,
        faculty: true,
        section: true,
        room: true,
      },
    });

    // Create schedule log
    await db.scheduleLog.create({
      data: {
        scheduleId: schedule.id,
        modifiedBy: session.user.id,
        oldValue: '{}',
        newValue: JSON.stringify(schedule),
        action: 'created',
      },
    });

    // Create conflict records
    for (const conflict of conflicts) {
      await db.conflict.create({
        data: {
          type: conflict.type,
          scheduleId1: schedule.id,
          scheduleId2: conflict.conflictingScheduleId,
          description: conflict.description,
          severity: 'warning',
        },
      });
    }

    // Notify faculty via database notification
    await db.notification.create({
      data: {
        userId: facultyId,
        title: 'New Schedule Assignment',
        message: `You have been assigned to ${schedule.subject?.subjectName} on ${day} (${startTime} - ${endTime})`,
        type: conflicts.length > 0 ? 'warning' : 'info',
        actionUrl: 'calendar',
      },
    });

    // Send real-time notification to faculty
    notifyScheduleChange(
      facultyId,
      'created',
      schedule.subject?.subjectName || 'Unknown Subject',
      day,
      `${startTime} - ${endTime}`
    );

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'create',
        entity: 'schedule',
        entityId: schedule.id,
        details: JSON.stringify({ subjectId, facultyId, sectionId, roomId, day, startTime, endTime }),
      },
    });

    return NextResponse.json({
      ...schedule,
      conflicts,
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

// Helper function to check for conflicts
async function checkConflicts(
  facultyId: string,
  roomId: string,
  sectionId: string,
  day: string,
  startTime: string,
  endTime: string,
  excludeScheduleId?: string
) {
  const conflicts: Array<{
    type: string;
    conflictingScheduleId: string | null;
    description: string;
  }> = [];

  // Time overlap helper
  const timesOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    return s1 < e2 && e1 > s2;
  };

  // Check faculty double booking
  const facultySchedules = await db.schedule.findMany({
    where: {
      facultyId,
      day,
      ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
    },
  });

  for (const s of facultySchedules) {
    if (timesOverlap(startTime, endTime, s.startTime, s.endTime)) {
      conflicts.push({
        type: 'faculty_double_booking',
        conflictingScheduleId: s.id,
        description: `Faculty is already scheduled for another class at this time`,
      });
    }
  }

  // Check room double booking
  const roomSchedules = await db.schedule.findMany({
    where: {
      roomId,
      day,
      ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
    },
  });

  for (const s of roomSchedules) {
    if (timesOverlap(startTime, endTime, s.startTime, s.endTime)) {
      conflicts.push({
        type: 'room_double_booking',
        conflictingScheduleId: s.id,
        description: `Room is already booked at this time`,
      });
    }
  }

  // Check section overlap
  const sectionSchedules = await db.schedule.findMany({
    where: {
      sectionId,
      day,
      ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
    },
  });

  for (const s of sectionSchedules) {
    if (timesOverlap(startTime, endTime, s.startTime, s.endTime)) {
      conflicts.push({
        type: 'section_overlap',
        conflictingScheduleId: s.id,
        description: `Section already has a class at this time`,
      });
    }
  }

  return conflicts;
}
