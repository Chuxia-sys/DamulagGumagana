import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  generateSchedules, 
  type Faculty, 
  type Room, 
  type Section, 
  type Subject,
  type ScheduleAssignment,
  type CurriculumEntry,
} from '@/lib/scheduling-algorithm';
import { v4 as uuidv4 } from 'uuid';
import { sendNotificationToUser } from '@/lib/notification-client';

function parseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admin can generate schedules
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await request.json();
    const { departmentId, clearExisting = true, curriculum, detectedConflicts } = body;

    console.log('=== FEPC SCHEDULE GENERATION v2.0 ===');
    console.log(`Department: ${departmentId || 'All'}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Detected conflicts passed: ${detectedConflicts?.length || 0}`);
    const startTime = Date.now();

    // =========================================================================
    // FETCH DATA
    // =========================================================================
    
    // Fetch sections
    const sectionsRaw = await db.section.findMany({
      where: departmentId ? { departmentId } : { isActive: true },
      include: { department: true },
    });
    
    // Fetch subjects
    const subjectsRaw = await db.subject.findMany({
      where: departmentId ? { departmentId } : { isActive: true },
    });
    
    // Fetch rooms
    const roomsRaw = await db.room.findMany({
      where: { isActive: true },
    });
    
    // Fetch ALL faculty (regardless of department) with preferences
    const facultyRaw = await db.user.findMany({
      where: { 
        role: 'faculty',
      },
      include: { preferences: true },
    });

    console.log(`\n=== DATA LOADED ===`);
    console.log(`Sections: ${sectionsRaw.length}`);
    console.log(`Subjects: ${subjectsRaw.length}`);
    console.log(`Rooms: ${roomsRaw.length}`);
    console.log(`Faculty: ${facultyRaw.length}`);
    
    // Log faculty details for debugging
    console.log(`\n=== FACULTY ANALYSIS ===`);
    for (const f of facultyRaw) {
      const spec = parseJSON(f.specialization, []);
      const prefs = f.preferences;
      const prefDays = prefs ? parseJSON(prefs.preferredDays, []) : [];
      const unavailDays = prefs?.unavailableDays ? parseJSON(prefs.unavailableDays, []) : [];
      
      console.log(`- ${f.name} (${f.email})`);
      console.log(`  Max Units: ${f.maxUnits || 24}`);
      console.log(`  Specializations: ${spec.length > 0 ? spec.join(', ') : 'None (can teach any)'}`);
      console.log(`  Preferred Days: ${prefDays.length > 0 ? prefDays.join(', ') : 'All'}`);
      console.log(`  Unavailable Days: ${unavailDays.length > 0 ? unavailDays.join(', ') : 'None'}`);
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================
    
    const errors: string[] = [];
    if (facultyRaw.length === 0) {
      errors.push('No faculty members found. Please add faculty before generating schedules.');
    }
    if (sectionsRaw.length === 0) {
      errors.push('No sections found. Please add sections before generating schedules.');
    }
    if (subjectsRaw.length === 0) {
      errors.push('No subjects found. Please add subjects before generating schedules.');
    }
    if (roomsRaw.length === 0) {
      errors.push('No rooms found. Please add rooms before generating schedules.');
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: errors,
        canProceed: false,
      }, { status: 400 });
    }

    // =========================================================================
    // PRE-GENERATION CONFLICT CHECK
    // =========================================================================
    
    const preGenerationWarnings: Array<{
      type: string;
      message: string;
      severity: 'warning' | 'info';
      faculty?: string[];
    }> = [];

    // Check for faculty with identical preferred subjects and overlapping times
    const subjectPreferenceMap: Map<string, typeof facultyRaw> = new Map();
    
    for (const f of facultyRaw) {
      const prefSubjects = f.preferences ? parseJSON<string[]>(f.preferences.preferredSubjects, []) : [];
      const prefTimeStart = f.preferences?.preferredTimeStart || '08:00';
      const prefTimeEnd = f.preferences?.preferredTimeEnd || '17:00';
      const prefDays = f.preferences ? parseJSON<string[]>(f.preferences.preferredDays, []) : [];
      
      for (const subjectId of prefSubjects) {
        // Create a key combining subject and time preferences
        const key = `${subjectId}|${prefTimeStart}-${prefTimeEnd}|${prefDays.join(',')}`;
        
        if (!subjectPreferenceMap.has(key)) {
          subjectPreferenceMap.set(key, []);
        }
        subjectPreferenceMap.get(key)!.push(f);
      }
    }

    // Detect conflicts
    for (const [key, facultyList] of subjectPreferenceMap) {
      if (facultyList.length >= 2) {
        const [subjectId] = key.split('|');
        const subject = subjectsRaw.find(s => s.id === subjectId);
        
        preGenerationWarnings.push({
          type: 'subject_preference_conflict',
          message: `${facultyList.length} faculty members (${facultyList.map(f => f.name).join(', ')}) prefer the same subject "${subject?.subjectName || subjectId}" with overlapping time preferences.`,
          severity: 'warning',
          faculty: facultyList.map(f => f.name),
        });
      }
    }

    // Check for specialization gaps
    for (const subject of subjectsRaw) {
      const requiredSpecs = parseJSON<string[]>(subject.requiredSpecialization, []);
      
      if (requiredSpecs.length > 0) {
        const hasEligibleFaculty = facultyRaw.some(f => {
          const fSpecs = parseJSON<string[]>(f.specialization, []);
          return requiredSpecs.some(spec => fSpecs.includes(spec));
        });
        
        if (!hasEligibleFaculty) {
          preGenerationWarnings.push({
            type: 'specialization_gap',
            message: `Subject "${subject.subjectName}" requires specialization in ${requiredSpecs.join(' or ')}, but no eligible faculty found.`,
            severity: 'warning',
          });
        }
      }
    }

    // Check for faculty capacity issues
    for (const f of facultyRaw) {
      const prefSubjects = f.preferences ? parseJSON<string[]>(f.preferences.preferredSubjects, []) : [];
      const prefSubjectsUnits = subjectsRaw
        .filter(s => prefSubjects.includes(s.id))
        .reduce((sum, s) => sum + s.units, 0);
      
      if (prefSubjectsUnits > f.maxUnits) {
        preGenerationWarnings.push({
          type: 'capacity_warning',
          message: `${f.name}'s preferred subjects total ${prefSubjectsUnits} units, exceeding max capacity of ${f.maxUnits} units.`,
          severity: 'info',
          faculty: [f.name],
        });
      }
    }

    console.log(`\n=== PRE-GENERATION WARNINGS ===`);
    console.log(`Found ${preGenerationWarnings.length} potential issues`);
    for (const w of preGenerationWarnings) {
      console.log(`- [${w.severity}] ${w.message}`);
    }

    // =========================================================================
    // TRANSFORM DATA FOR ALGORITHM
    // =========================================================================

    const faculty: Faculty[] = facultyRaw.map(f => ({
      id: f.id,
      name: f.name,
      specialization: parseJSON(f.specialization, []),
      maxUnits: f.maxUnits || 24,
      departmentId: f.departmentId,
      preferences: f.preferences ? {
        preferredDays: parseJSON(f.preferences.preferredDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
        preferredTimeStart: f.preferences.preferredTimeStart || '08:00',
        preferredTimeEnd: f.preferences.preferredTimeEnd || '17:00',
        preferredSubjects: parseJSON(f.preferences.preferredSubjects, []),
        unavailableDays: f.preferences.unavailableDays ? parseJSON(f.preferences.unavailableDays, []) : undefined,
        notes: f.preferences.notes || undefined,
      } : {
        // Default preferences if none exist
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        preferredTimeStart: '08:00',
        preferredTimeEnd: '17:00',
        preferredSubjects: [],
      },
    }));

    const rooms: Room[] = roomsRaw.map(r => ({
      id: r.id,
      roomName: r.roomName,
      capacity: r.capacity,
      equipment: parseJSON(r.equipment, []),
      building: r.building,
    }));

    const sections: Section[] = sectionsRaw.map(s => ({
      id: s.id,
      sectionName: s.sectionName,
      yearLevel: s.yearLevel,
      studentCount: s.studentCount,
      departmentId: s.departmentId,
    }));

    const subjects: Subject[] = subjectsRaw.map(s => ({
      id: s.id,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      units: s.units,
      departmentId: s.departmentId,
      requiredSpecialization: parseJSON(s.requiredSpecialization, []),
      requiredEquipment: [],
    }));

    // Prepare curriculum if provided
    const curriculumEntries: CurriculumEntry[] | undefined = curriculum;

    // =========================================================================
    // CLEAR EXISTING SCHEDULES
    // =========================================================================

    if (clearExisting) {
      console.log('\n=== CLEARING EXISTING SCHEDULES ===');
      const deleteResult = await db.schedule.deleteMany({
        where: departmentId ? { section: { departmentId } } : undefined,
      });
      console.log(`Deleted ${deleteResult.count} existing schedules`);
      
      await db.conflict.deleteMany({ 
        where: { resolved: false } 
      });
    }

    // =========================================================================
    // RUN SCHEDULING ALGORITHM
    // =========================================================================

    console.log('\n=== RUNNING SCHEDULING ALGORITHM ===');
    const result = generateSchedules(faculty, rooms, sections, subjects, curriculumEntries);

    console.log(`\n=== ALGORITHM RESULTS ===`);
    console.log(`Generation time: ${result.stats.generationTimeMs}ms`);
    console.log(`Backtracks: ${result.stats.backtrackCount}`);
    console.log(`Skipped (duplicates): ${result.stats.skippedCount}`);
    console.log(`Assigned: ${result.schedules.length}`);
    console.log(`Unassigned: ${result.unassigned.length}`);
    console.log(`Violations detected: ${result.violations.length}`);
    console.log(`Assignment rate: ${(result.stats.assignmentRate * 100).toFixed(1)}%`);
    console.log(`Preference match rate: ${(result.stats.preferenceMatchRate * 100).toFixed(1)}%`);

    // =========================================================================
    // SAVE SCHEDULES TO DATABASE
    // =========================================================================

    if (result.schedules.length > 0) {
      console.log('\n=== SAVING TO DATABASE ===');
      
      // Batch insert for better performance
      const batchSize = 100;
      let savedCount = 0;
      
      for (let i = 0; i < result.schedules.length; i += batchSize) {
        const batch = result.schedules.slice(i, i + batchSize);
        await db.schedule.createMany({
          data: batch.map(s => ({
            subjectId: s.subjectId,
            facultyId: s.facultyId,
            sectionId: s.sectionId,
            roomId: s.roomId,
            day: s.day,
            startTime: s.startTime,
            endTime: s.endTime,
            status: 'approved',
            semester: '1st Semester',
            academicYear: '2024-2025',
          })),
        });
        savedCount += batch.length;
      }
      console.log(`Saved ${savedCount} schedules to database`);
    }

    // =========================================================================
    // RECORD VIOLATIONS AS CONFLICTS
    // =========================================================================

    if (result.violations.length > 0) {
      console.log(`\n=== RECORDING ${result.violations.length} VIOLATIONS ===`);
      
      for (const violation of result.violations) {
        try {
          await db.conflict.create({
            data: {
              type: violation.type,
              scheduleId1: violation.scheduleIds[0] || '',
              scheduleId2: violation.scheduleIds[1] || null,
              description: violation.description,
              severity: violation.severity,
              resolved: false,
            },
          });
        } catch (e) {
          console.error(`Failed to record violation: ${violation.description}`);
        }
      }
    }

    // =========================================================================
    // SAVE DETECTED CONFLICTS (from pre-generation check)
    // =========================================================================

    let savedConflictsCount = 0;
    const generationId = uuidv4(); // Unique ID to group conflicts from this generation
    
    if (detectedConflicts && detectedConflicts.length > 0) {
      console.log(`\n=== SAVING ${detectedConflicts.length} DETECTED CONFLICTS ===`);
      
      for (const conflict of detectedConflicts) {
        try {
          // Get faculty IDs and names
          const facultyData = conflict.faculty?.map((f: { id?: string; name: string } | string) => 
            typeof f === 'string' ? { id: null, name: f } : { id: f.id || null, name: f.name }
          ) || [];
          
          const facultyNames = facultyData.map((f: { name: string }) => f.name);
          const facultyIds = facultyData
            .map((f: { id: string | null }) => f.id)
            .filter((id: string | null): id is string => id !== null);
          
          // Find affected schedules for this conflict
          let scheduleId1: string | null = null;
          let scheduleId2: string | null = null;
          
          // If it's a subject conflict, try to find related schedules
          if (conflict.type === 'subject_conflict' || conflict.type === 'subject_preference_conflict') {
            // Find schedules for the affected faculty
            const affectedSchedules = result.schedules.filter(s => {
              const facultyName = faculty.find(f => f.id === s.facultyId)?.name;
              return facultyName && facultyNames.includes(facultyName);
            });
            
            if (affectedSchedules.length >= 1) {
              scheduleId1 = affectedSchedules[0].id;
            }
            if (affectedSchedules.length >= 2) {
              scheduleId2 = affectedSchedules[1].id;
            }
          }
          
          // Extract subject ID if present in the conflict details
          let subjectId: string | null = null;
          if (conflict.details?.subjectId) {
            subjectId = conflict.details.subjectId;
          }
          
          await db.conflict.create({
            data: {
              type: conflict.type || 'preference_conflict',
              scheduleId1: scheduleId1,
              scheduleId2: scheduleId2,
              description: conflict.message || conflict.description || '',
              severity: conflict.severity || 'warning',
              resolved: false,
              suggestedResolution: getSuggestedResolution(conflict.type, facultyNames),
              facultyIds: facultyIds.length > 0 ? JSON.stringify(facultyIds) : null,
              subjectId: subjectId,
              generationId: generationId,
            },
          });
          savedConflictsCount++;
        } catch (e) {
          console.error(`Failed to save detected conflict: ${conflict.message || conflict.type}`);
        }
      }
      console.log(`Saved ${savedConflictsCount} detected conflicts to database`);
    }

    // Helper function for suggested resolutions
    function getSuggestedResolution(conflictType: string, facultyNames: string[]): string {
      switch (conflictType) {
        case 'subject_conflict':
        case 'subject_preference_conflict':
          return `Consider discussing with ${facultyNames.join(' and ')} to adjust preferences, or let the algorithm assign based on load balancing.`;
        case 'specialization_gap':
          return 'Add a faculty member with the required specialization or update subject requirements.';
        case 'capacity_warning':
          return 'Reduce preferred subjects or increase faculty max units.';
        case 'preference_overlap':
        case 'time_conflict':
          return 'The scheduling algorithm will resolve this using load balancing.';
        default:
          return 'Review faculty preferences and adjust as needed.';
      }
    }

    // =========================================================================
    // LOG UNASSIGNED ITEMS
    // =========================================================================

    if (result.unassigned.length > 0) {
      console.log(`\n=== UNASSIGNED SUBJECTS (${result.unassigned.length}) ===`);
      for (const item of result.unassigned.slice(0, 10)) {
        console.log(`- ${item.subjectCode} (${item.subjectName}) for ${item.sectionName}: ${item.reason}`);
      }
      if (result.unassigned.length > 10) {
        console.log(`... and ${result.unassigned.length - 10} more`);
      }
    }

    // =========================================================================
    // SEND NOTIFICATIONS TO FACULTY
    // =========================================================================

    console.log('\n=== SENDING NOTIFICATIONS ===');
    const notifiedFaculty = new Set<string>();
    let notificationCount = 0;
    
    for (const schedule of result.schedules) {
      if (!notifiedFaculty.has(schedule.facultyId)) {
        const facultyMember = faculty.find(f => f.id === schedule.facultyId);
        if (facultyMember) {
          const facultySchedules = result.schedules.filter(s => s.facultyId === schedule.facultyId);
          const totalUnits = facultySchedules.reduce((sum, s) => {
            const subj = subjects.find(sub => sub.id === s.subjectId);
            return sum + (subj?.units || 0);
          }, 0);
          
          const notificationTitle = 'New Schedules Generated';
          const notificationMessage = `You have been assigned ${facultySchedules.length} class(es) totaling ${totalUnits} units for 1st Semester 2024-2025. Please review your schedule in the calendar view.`;
          
          // Save to database
          await db.notification.create({
            data: {
              userId: schedule.facultyId,
              title: notificationTitle,
              message: notificationMessage,
              type: 'info',
              actionUrl: 'calendar',
            },
          });
          
          // Send real-time notification
          sendNotificationToUser({
            userId: schedule.facultyId,
            title: notificationTitle,
            message: notificationMessage,
            type: 'info',
          });
          
          notifiedFaculty.add(schedule.facultyId);
          notificationCount++;
        }
      }
    }
    console.log(`Sent ${notificationCount} notifications to faculty`);

    // =========================================================================
    // CREATE AUDIT LOG
    // =========================================================================

    await db.auditLog.create({
      data: {
        action: 'generate_schedules',
        entity: 'schedule',
        details: JSON.stringify({
          version: '2.0',
          generated: result.schedules.length,
          unassigned: result.unassigned.length,
          violations: result.violations.length,
          savedConflicts: savedConflictsCount,
          departmentId,
          generationTimeMs: result.stats.generationTimeMs,
          backtrackCount: result.stats.backtrackCount,
          skippedCount: result.stats.skippedCount,
          preferenceMatchRate: result.stats.preferenceMatchRate,
          assignmentRate: result.stats.assignmentRate,
        }),
      },
    });

    // =========================================================================
    // PREPARE RESPONSE
    // =========================================================================

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`\n=== GENERATION COMPLETE ===`);
    console.log(`Total API time: ${totalTime}ms`);
    console.log(`Schedules generated: ${result.schedules.length}`);
    console.log(`Sections covered: ${new Set(result.schedules.map(s => s.sectionId)).size}/${sections.length}`);
    console.log(`Faculty utilized: ${new Set(result.schedules.map(s => s.facultyId)).size}/${faculty.length}`);

    // Calculate detailed faculty utilization summary
    const facultyUtilization = faculty.map(f => {
      const assigned = result.schedules
        .filter(s => s.facultyId === f.id)
        .reduce((sum, s) => {
          const subj = subjects.find(sub => sub.id === s.subjectId);
          return sum + (subj?.units || 0);
        }, 0);
      
      const scheduleCount = result.schedules.filter(s => s.facultyId === f.id).length;
      
      return {
        id: f.id,
        name: f.name,
        schedules: scheduleCount,
        assignedUnits: assigned,
        maxUnits: f.maxUnits,
        percent: f.maxUnits > 0 ? Math.round((assigned / f.maxUnits) * 100) : 0,
      };
    }).sort((a, b) => b.percent - a.percent);

    // Calculate day distribution
    const dayDistribution: Record<string, number> = {};
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
      dayDistribution[day] = result.schedules.filter(s => s.day === day).length;
    }

    // Calculate time distribution
    const timeSlots: Record<string, number> = {};
    for (const schedule of result.schedules) {
      const hour = schedule.startTime.split(':')[0];
      const timeKey = `${hour}:00`;
      timeSlots[timeKey] = (timeSlots[timeKey] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      generated: result.schedules.length,
      unassigned: result.unassigned,
      violations: result.violations.length,
      savedConflicts: savedConflictsCount,
      generationId: generationId,
      preGenerationWarnings,
      stats: {
        ...result.stats,
        totalTimeMs: totalTime,
        sections: {
          total: sections.length,
          withSchedules: new Set(result.schedules.map(s => s.sectionId)).size,
        },
        faculty: {
          total: faculty.length,
          withLoad: facultyUtilization.filter(f => f.assignedUnits > 0).length,
          utilization: facultyUtilization,
        },
        rooms: {
          total: rooms.length,
          used: new Set(result.schedules.map(s => s.roomId)).size,
        },
        distribution: {
          byDay: dayDistribution,
          byTime: timeSlots,
        },
      },
      message: result.violations.length === 0 
        ? `Successfully generated ${result.schedules.length} conflict-free schedules!`
        : `Generated ${result.schedules.length} schedules with ${result.violations.length} conflicts that need review.`,
      algorithm: {
        type: 'Constraint Satisfaction Problem (CSP) with Backtracking v2.0',
        features: [
          'Most Constrained Variable (MCV) heuristic',
          'Least Constraining Value (LCV) heuristic',
          'Forward checking constraint propagation',
          'Faculty preference optimization',
          'Load balancing',
          'Day distribution scoring',
          'Time quality scoring',
          'Room efficiency scoring',
          'Duplicate subject-section prevention',
          'Flexible time slot generation (30-min granularity)',
          'Pre-generation conflict detection',
          'Conflict persistence and tracking',
        ],
      },
    });

  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate schedules',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
