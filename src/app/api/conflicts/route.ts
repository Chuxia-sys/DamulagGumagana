import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// Time utility functions
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);
  return start1 < end2 && end1 > start2;
}

// GET /api/conflicts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved');
    const autoDetect = searchParams.get('autoDetect') !== 'false'; // Default to true

    // Role-based filtering
    const isFaculty = session.user.role === 'faculty';
    const isDeptHead = session.user.role === 'department_head';
    const isAdmin = session.user.role === 'admin';

    // Build schedule filter
    const scheduleWhere: { facultyId?: string } = {};
    
    // Faculty can only see their own conflicts
    if (isFaculty) {
      scheduleWhere.facultyId = session.user.id;
    }

    // Fetch schedules with role-based filtering
    const schedules = await db.schedule.findMany({
      where: Object.keys(scheduleWhere).length > 0 ? scheduleWhere : undefined,
      include: { 
        subject: true, 
        faculty: true, 
        section: { include: { department: true } }, 
        room: true 
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    // For department heads, filter schedules by department
    let filteredSchedules = schedules;
    if (isDeptHead && !isAdmin) {
      filteredSchedules = schedules.filter(s => 
        s.section?.departmentId === session.user.departmentId
      );
    }

    const detectedConflicts: Array<{
      type: string;
      scheduleId1: string;
      scheduleId2: string | null;
      description: string;
      severity: string;
    }> = [];

    if (autoDetect) {
      console.log(`Checking ${filteredSchedules.length} schedules for conflicts...`);

      // Group schedules by day for more efficient checking
      const schedulesByDay = new Map<string, typeof filteredSchedules>();
      for (const schedule of filteredSchedules) {
        const daySchedules = schedulesByDay.get(schedule.day) || [];
        daySchedules.push(schedule);
        schedulesByDay.set(schedule.day, daySchedules);
      }

      // Check each day separately
      for (const [day, daySchedules] of schedulesByDay) {
        // Sort by start time for efficient comparison
        daySchedules.sort((a, b) => 
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );

        for (let i = 0; i < daySchedules.length; i++) {
          const s1 = daySchedules[i];
          
          for (let j = i + 1; j < daySchedules.length; j++) {
            const s2 = daySchedules[j];

            // Early exit: if s2 starts after or when s1 ends, no more overlaps possible
            if (timeToMinutes(s2.startTime) >= timeToMinutes(s1.endTime)) {
              break;
            }

            // Check for time overlap
            if (!timesOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
              continue;
            }

            // Faculty double booking
            if (s1.facultyId === s2.facultyId) {
              detectedConflicts.push({
                type: 'faculty_double_booking',
                scheduleId1: s1.id,
                scheduleId2: s2.id,
                description: `Faculty "${s1.faculty?.name}" is double-booked on ${s1.day}:\n  - ${s1.subject?.subjectCode} (${s1.startTime}-${s1.endTime}) in ${s1.room?.roomName}\n  - ${s2.subject?.subjectCode} (${s2.startTime}-${s2.endTime}) in ${s2.room?.roomName}`,
                severity: 'critical',
              });
            }

            // Room double booking
            if (s1.roomId === s2.roomId) {
              detectedConflicts.push({
                type: 'room_double_booking',
                scheduleId1: s1.id,
                scheduleId2: s2.id,
                description: `Room "${s1.room?.roomName}" is double-booked on ${s1.day}:\n  - ${s1.subject?.subjectCode} with ${s1.faculty?.name} (${s1.startTime}-${s1.endTime})\n  - ${s2.subject?.subjectCode} with ${s2.faculty?.name} (${s2.startTime}-${s2.endTime})`,
                severity: 'critical',
              });
            }

            // Section overlap (same section has two classes at same time)
            if (s1.sectionId === s2.sectionId) {
              detectedConflicts.push({
                type: 'section_overlap',
                scheduleId1: s1.id,
                scheduleId2: s2.id,
                description: `Section "${s1.section?.sectionName}" has overlapping classes on ${s1.day}:\n  - ${s1.subject?.subjectCode} with ${s1.faculty?.name} (${s1.startTime}-${s1.endTime})\n  - ${s2.subject?.subjectCode} with ${s2.faculty?.name} (${s2.startTime}-${s2.endTime})`,
                severity: 'critical',
              });
            }
          }
        }
      }

      // Check for capacity violations
      for (const schedule of filteredSchedules) {
        const room = schedule.room;
        const section = schedule.section;
        
        if (room && section && room.capacity < section.studentCount) {
          // Check if this capacity violation already exists
          const existingViolation = detectedConflicts.find(c => 
            c.type === 'capacity_exceeded' && c.scheduleId1 === schedule.id
          );
          
          if (!existingViolation) {
            detectedConflicts.push({
              type: 'capacity_exceeded',
              scheduleId1: schedule.id,
              scheduleId2: null,
              description: `Room "${room.roomName}" (capacity: ${room.capacity}) is too small for section "${section.sectionName}" (${section.studentCount} students)`,
              severity: 'warning',
            });
          }
        }
      }

      console.log(`Detected ${detectedConflicts.length} conflicts`);
    }

    // Create new conflict records (avoid duplicates)
    let newConflictCount = 0;
    for (const conflict of detectedConflicts) {
      const existing = await db.conflict.findFirst({
        where: {
          type: conflict.type,
          scheduleId1: conflict.scheduleId1,
          scheduleId2: conflict.scheduleId2,
          resolved: false,
        },
      });

      if (!existing) {
        await db.conflict.create({
          data: {
            type: conflict.type,
            scheduleId1: conflict.scheduleId1,
            scheduleId2: conflict.scheduleId2,
            description: conflict.description,
            severity: conflict.severity,
          },
        });
        newConflictCount++;
      }
    }

    if (newConflictCount > 0) {
      console.log(`Created ${newConflictCount} new conflict records`);
    }

    // Fetch all conflicts with role-based filtering
    const conflicts = await db.conflict.findMany({
      where: resolved !== null ? { resolved: resolved === 'true' } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with schedule details and apply role-based filtering
    const enrichedConflicts = await Promise.all(
      conflicts.map(async (conflict) => {
        let schedule1 = null;
        let schedule2 = null;
        let faculty = null;
        
        if (conflict.scheduleId1) {
          schedule1 = await db.schedule.findUnique({
            where: { id: conflict.scheduleId1 },
            include: { subject: true, faculty: true, section: { include: { department: true } }, room: true },
          });
        }

        if (conflict.scheduleId2) {
          schedule2 = await db.schedule.findUnique({
            where: { id: conflict.scheduleId2 },
            include: { subject: true, faculty: true, section: { include: { department: true } }, room: true },
          });
        }

        // For pre-generation conflicts, fetch faculty data
        if (conflict.facultyIds) {
          const facultyIds = JSON.parse(conflict.facultyIds);
          if (facultyIds.length > 0) {
            faculty = await db.user.findMany({
              where: { id: { in: facultyIds } },
              select: { id: true, name: true, email: true },
            });
          }
        }

        return {
          ...conflict,
          schedule1,
          schedule2,
          faculty,
          isPreGeneration: !conflict.scheduleId1,
        };
      })
    );

    // Filter conflicts for non-admin users
    let filteredConflicts = enrichedConflicts;
    
    if (isFaculty) {
      // Faculty can only see their own conflicts
      filteredConflicts = enrichedConflicts.filter(c => 
        c.schedule1?.facultyId === session.user.id || 
        c.schedule2?.facultyId === session.user.id ||
        (c.faculty && c.faculty.some((f: { id: string }) => f.id === session.user.id))
      );
    } else if (isDeptHead) {
      // Department heads can only see conflicts from their department
      filteredConflicts = enrichedConflicts.filter(c => 
        c.schedule1?.section?.departmentId === session.user.departmentId ||
        c.schedule2?.section?.departmentId === session.user.departmentId
      );
    }

    // Group conflicts by type for summary
    const conflictSummary = {
      faculty_double_booking: filteredConflicts.filter(c => c.type === 'faculty_double_booking' && !c.resolved).length,
      room_double_booking: filteredConflicts.filter(c => c.type === 'room_double_booking' && !c.resolved).length,
      section_overlap: filteredConflicts.filter(c => c.type === 'section_overlap' && !c.resolved).length,
      capacity_exceeded: filteredConflicts.filter(c => c.type === 'capacity_exceeded' && !c.resolved).length,
      subject_preference_conflict: filteredConflicts.filter(c => c.type === 'subject_preference_conflict' && !c.resolved).length,
      specialization_gap: filteredConflicts.filter(c => c.type === 'specialization_gap' && !c.resolved).length,
      capacity_warning: filteredConflicts.filter(c => c.type === 'capacity_warning' && !c.resolved).length,
      time_conflict: filteredConflicts.filter(c => c.type === 'time_conflict' && !c.resolved).length,
    };

    return NextResponse.json({
      conflicts: filteredConflicts,
      total: filteredConflicts.length,
      unresolved: filteredConflicts.filter(c => !c.resolved).length,
      summary: conflictSummary,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    return NextResponse.json({
      conflicts: [],
      total: 0,
      unresolved: 0,
      summary: {
        faculty_double_booking: 0,
        room_double_booking: 0,
        section_overlap: 0,
        capacity_exceeded: 0,
        subject_preference_conflict: 0,
        specialization_gap: 0,
        capacity_warning: 0,
        time_conflict: 0,
      },
      lastChecked: new Date().toISOString(),
    });
  }
}
