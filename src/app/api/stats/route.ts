import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const facultyId = searchParams.get('facultyId');

    // Determine if filtering by faculty (for faculty role)
    const isFaculty = session?.user?.role === 'faculty';
    const filterFacultyId = isFaculty ? session.user.id : facultyId;

    // Get all relevant data
    const [users, schedules, conflicts, rooms, sections, subjects] = await Promise.all([
      db.user.findMany({
        where: {
          role: 'faculty',
          ...(departmentId && { departmentId }),
          ...(filterFacultyId && { id: filterFacultyId }),
        },
        include: { department: true },
      }),
      db.schedule.findMany({
        where: {
          ...(departmentId ? { section: { departmentId } } : {}),
          ...(filterFacultyId && { facultyId: filterFacultyId }),
        },
        include: { subject: true, faculty: true, room: true, section: true },
      }),
      db.conflict.findMany({ where: { resolved: false } }),
      db.room.findMany(),
      db.section.findMany({
        where: departmentId ? { departmentId } : undefined,
      }),
      db.subject.findMany({
        where: departmentId ? { departmentId } : undefined,
      }),
    ]);

    // Calculate stats
    const totalFaculty = users.length;
    const totalSchedules = schedules.length;
    const totalConflicts = conflicts.length;

    // Faculty utilization
    const facultyLoads: Record<string, number> = {};
    users.forEach(u => { facultyLoads[u.id] = 0; });
    schedules.forEach(s => {
      if (s.subject) {
        facultyLoads[s.facultyId] = (facultyLoads[s.facultyId] || 0) + s.subject.units;
      }
    });

    const totalCapacity = users.reduce((sum, u) => sum + (u.maxUnits || 24), 0);
    const totalLoad = Object.values(facultyLoads).reduce((sum, load) => sum + load, 0);
    const facultyUtilizationAvg = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;

    // Individual faculty utilization
    const facultyUtilization = users.map(u => {
      const assigned = facultyLoads[u.id] || 0;
      const max = u.maxUnits || 24;
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        assigned,
        max,
        percent: max > 0 ? Math.round((assigned / max) * 100) : 0,
      };
    }).sort((a, b) => b.percent - a.percent);

    // Room occupancy
    const roomSchedules: Record<string, number> = {};
    rooms.forEach(r => { roomSchedules[r.id] = 0; });
    schedules.forEach(s => {
      roomSchedules[s.roomId] = (roomSchedules[s.roomId] || 0) + 1;
    });

    const maxRoomSchedules = 6 * 13; // 6 days (Mon-Sat) * 13 time slots
    const avgRoomUsage = rooms.length > 0 ? Object.values(roomSchedules).reduce((sum, count) => sum + count, 0) / rooms.length : 0;
    const roomOccupancy = Math.round((avgRoomUsage / maxRoomSchedules) * 100) || 0;

    // Overloaded/underloaded faculty
    const overloadedFaculty = users.filter(u => (facultyLoads[u.id] || 0) > (u.maxUnits || 24)).length;
    const underloadedFaculty = users.filter(u => (facultyLoads[u.id] || 0) < 12).length;

    // Schedules by day
    const dayCounts: Record<string, number> = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0,
    };
    schedules.forEach(s => {
      dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
    });
    const schedulesByDay = Object.entries(dayCounts).map(([day, count]) => ({ day, count }));

    // Schedules by status
    const statusCounts: Record<string, number> = {};
    schedules.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });
    const schedulesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Faculty by department
    const deptCounts: Record<string, number> = {};
    users.forEach(u => {
      const deptName = u.department?.name || 'Unassigned';
      deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
    });
    const facultyByDepartment = Object.entries(deptCounts).map(([department, count]) => ({ department, count }));

    // Room utilization details - fixed property name
    const roomUtilization = rooms.slice(0, 10).map(r => ({
      room: r.roomName,
      utilization: Math.round(((roomSchedules[r.id] || 0) / maxRoomSchedules) * 100),
    }));

    return NextResponse.json({
      totalFaculty,
      totalSchedules,
      totalConflicts,
      facultyUtilizationAvg,
      facultyUtilization,
      roomOccupancy,
      overloadedFaculty,
      underloadedFaculty,
      schedulesByDay,
      schedulesByStatus,
      facultyByDepartment,
      roomUtilization,
      totalRooms: rooms.length,
      totalSections: sections.length,
      totalSubjects: subjects.length,
      isFacultyView: isFaculty,
      currentFacultyId: filterFacultyId || null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return default stats structure for easier frontend handling
    return NextResponse.json({
      totalFaculty: 0,
      totalSchedules: 0,
      totalConflicts: 0,
      facultyUtilizationAvg: 0,
      facultyUtilization: [],
      roomOccupancy: 0,
      overloadedFaculty: 0,
      underloadedFaculty: 0,
      schedulesByDay: [],
      schedulesByStatus: [],
      facultyByDepartment: [],
      roomUtilization: [],
      totalRooms: 0,
      totalSections: 0,
      totalSubjects: 0,
      isFacultyView: false,
      currentFacultyId: null,
    });
  }
}
