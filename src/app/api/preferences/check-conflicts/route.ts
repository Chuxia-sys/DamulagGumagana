import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function parseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Check for potential conflicts between faculty preferences
 * This helps identify issues BEFORE schedule generation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    // Fetch all faculty with their preferences
    const faculty = await db.user.findMany({
      where: {
        role: 'faculty',
        ...(departmentId && { departmentId }),
      },
      include: {
        preferences: true,
        department: true,
      },
    });

    const subjects = await db.subject.findMany({
      where: departmentId ? { departmentId } : { isActive: true },
    });

    const conflicts: Array<{
      type: 'preference_overlap' | 'subject_conflict' | 'time_conflict';
      severity: 'warning' | 'info';
      faculty: Array<{
        id: string;
        name: string;
        email: string;
        department?: string | null;
      }>;
      description: string;
      details: Record<string, unknown>;
      suggestedResolution: string;
    }> = [];

    // Group faculty by their preferences
    const preferenceGroups: Map<string, typeof faculty> = new Map();

    for (const f of faculty) {
      const prefs = f.preferences;
      if (!prefs) continue;

      // Create a key based on preferred days and times
      const prefDays = parseJSON<string[]>(prefs.preferredDays, []).sort().join(',');
      const prefTime = `${prefs.preferredTimeStart}-${prefs.preferredTimeEnd}`;
      const prefSubjects = parseJSON<string[]>(prefs.preferredSubjects, []).sort().join(',');

      // Group by similar preferences
      const key = `${prefDays}|${prefTime}`;

      if (!preferenceGroups.has(key)) {
        preferenceGroups.set(key, []);
      }
      preferenceGroups.get(key)!.push(f);
    }

    // Check for faculty with identical/similar preferences
    for (const [key, group] of preferenceGroups) {
      if (group.length < 2) continue;

      const [days, time] = key.split('|');
      const [timeStart, timeEnd] = time.split('-');

      // Check if they also have overlapping subject preferences
      const subjectPreferences: Map<string, typeof faculty> = new Map();

      for (const f of group) {
        const prefSubjects = parseJSON<string[]>(f.preferences?.preferredSubjects || '[]', []);
        for (const subjectId of prefSubjects) {
          if (!subjectPreferences.has(subjectId)) {
            subjectPreferences.set(subjectId, []);
          }
          subjectPreferences.get(subjectId)!.push(f);
        }
      }

      // Check for subject overlap
      for (const [subjectId, subjectGroup] of subjectPreferences) {
        if (subjectGroup.length >= 2) {
          const subject = subjects.find(s => s.id === subjectId);
          conflicts.push({
            type: 'subject_conflict',
            severity: 'warning',
            faculty: subjectGroup.map(f => ({
              id: f.id,
              name: f.name,
              email: f.email,
              department: f.department?.name,
            })),
            description: `${subjectGroup.length} faculty members (${subjectGroup.map(f => f.name).join(', ')}) have the same preferred subject "${subject?.subjectName || subjectId}" with overlapping time preferences.`,
            details: {
              subjectId,
              subjectName: subject?.subjectName,
              subjectCode: subject?.subjectCode,
              preferredDays: days.split(','),
              preferredTime: time,
            },
            suggestedResolution: `Consider: 1) Discuss with faculty to adjust preferences, 2) Assign based on specialization fit, 3) Alternate semesters for the subject.`,
          });
        }
      }

      // If no subject overlap but same time preferences
      if (subjectPreferences.size === 0) {
        conflicts.push({
          type: 'time_conflict',
          severity: 'info',
          faculty: group.map(f => ({
            id: f.id,
            name: f.name,
            email: f.email,
            department: f.department?.name,
          })),
          description: `${group.length} faculty members (${group.map(f => f.name).join(', ')}) have identical preferred time slots (${timeStart} - ${timeEnd} on ${days}). This may cause competition for scheduling.`,
          details: {
            preferredDays: days.split(','),
            preferredTimeStart: timeStart,
            preferredTimeEnd: timeEnd,
          },
          suggestedResolution: `This is informational. The algorithm will assign based on load balancing and specialization. No action required unless specific issues arise.`,
        });
      }
    }

    // Check for specialization gaps
    const specializationCoverage: Map<string, typeof faculty> = new Map();

    for (const f of faculty) {
      const specs = parseJSON<string[]>(f.specialization, []);
      for (const spec of specs) {
        if (!specializationCoverage.has(spec)) {
          specializationCoverage.set(spec, []);
        }
        specializationCoverage.get(spec)!.push(f);
      }
    }

    // Check if any subject has no eligible faculty
    const uncoveredSubjects: typeof subjects = [];

    for (const subject of subjects) {
      const requiredSpecs = parseJSON<string[]>(subject.requiredSpecialization, []);

      if (requiredSpecs.length === 0) continue; // No specialization required

      const hasEligibleFaculty = faculty.some(f => {
        const fSpecs = parseJSON<string[]>(f.specialization, []);
        return requiredSpecs.some(spec => fSpecs.includes(spec));
      });

      if (!hasEligibleFaculty) {
        uncoveredSubjects.push(subject);
      }
    }

    for (const subject of uncoveredSubjects) {
      conflicts.push({
        type: 'preference_overlap',
        severity: 'warning',
        faculty: [],
        description: `Subject "${subject.subjectName}" requires specialization in ${parseJSON<string[]>(subject.requiredSpecialization, []).join(' or ')}, but no faculty member has this specialization.`,
        details: {
          subjectId: subject.id,
          subjectName: subject.subjectName,
          requiredSpecialization: parseJSON<string[]>(subject.requiredSpecialization, []),
        },
        suggestedResolution: `Add a faculty member with specialization in ${parseJSON<string[]>(subject.requiredSpecialization, []).join(' or ')} or update the subject requirements.`,
      });
    }

    // Check for faculty overload potential
    const overloadWarnings: typeof conflicts = [];

    for (const f of faculty) {
      const prefSubjects = parseJSON<string[]>(f.preferences?.preferredSubjects || '[]', []);
      const prefSubjectsUnits = subjects
        .filter(s => prefSubjects.includes(s.id))
        .reduce((sum, s) => sum + s.units, 0);

      if (prefSubjectsUnits > f.maxUnits) {
        overloadWarnings.push({
          type: 'preference_overlap',
          severity: 'warning',
          faculty: [{
            id: f.id,
            name: f.name,
            email: f.email,
            department: f.department?.name,
          }],
          description: `${f.name} prefers ${prefSubjects.length} subjects totaling ${prefSubjectsUnits} units, exceeding their max capacity of ${f.maxUnits} units.`,
          details: {
            maxUnits: f.maxUnits,
            preferredUnits: prefSubjectsUnits,
            preferredSubjectsCount: prefSubjects.length,
          },
          suggestedResolution: `Reduce preferred subjects or increase max units for ${f.name}.`,
        });
      }
    }

    // Summary statistics
    const summary = {
      totalFaculty: faculty.length,
      totalSubjects: subjects.length,
      conflictsFound: conflicts.length,
      warningCount: conflicts.filter(c => c.severity === 'warning').length,
      infoCount: conflicts.filter(c => c.severity === 'info').length,
      uncoveredSubjectsCount: uncoveredSubjects.length,
      overloadWarningsCount: overloadWarnings.length,
      canGenerate: conflicts.filter(c => c.severity === 'warning' && c.type !== 'time_conflict').length === 0,
    };

    return NextResponse.json({
      summary,
      conflicts: [...conflicts, ...overloadWarnings],
      faculty: faculty.map(f => ({
        id: f.id,
        name: f.name,
        email: f.email,
        department: f.department?.name,
        maxUnits: f.maxUnits,
        specialization: parseJSON<string[]>(f.specialization, []),
        preferences: f.preferences ? {
          preferredDays: parseJSON<string[]>(f.preferences.preferredDays, []),
          preferredTimeStart: f.preferences.preferredTimeStart,
          preferredTimeEnd: f.preferences.preferredTimeEnd,
          preferredSubjects: parseJSON<string[]>(f.preferences.preferredSubjects, []),
          unavailableDays: f.preferences.unavailableDays ? parseJSON<string[]>(f.preferences.unavailableDays, []) : [],
        } : null,
      })),
    });

  } catch (error) {
    console.error('Error checking preference conflicts:', error);
    return NextResponse.json({
      summary: {
        totalFaculty: 0,
        totalSubjects: 0,
        conflictsFound: 0,
        warningCount: 0,
        infoCount: 0,
        canGenerate: true,
      },
      conflicts: [],
      faculty: [],
      error: error instanceof Error ? error.message : 'Failed to check conflicts',
    }, { status: 500 });
  }
}
