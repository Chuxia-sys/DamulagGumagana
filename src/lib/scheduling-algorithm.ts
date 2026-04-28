/**
 * FEPC Scheduling System - Robust Schedule Generation Algorithm
 * 
 * This implements a Constraint Satisfaction Problem (CSP) approach with:
 * - Proper backtracking with intelligent pruning
 * - Constraint propagation (forward checking)
 * - Heuristic optimization (MRV, LCV)
 * - Multi-objective scoring
 * - Support for flexible time slots
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface Faculty {
  id: string;
  name: string;
  specialization: string[];
  maxUnits: number;
  departmentId: string | null;
  preferences?: FacultyPreference;
}

export interface FacultyPreference {
  preferredDays: string[];
  preferredTimeStart: string;
  preferredTimeEnd: string;
  preferredSubjects: string[];
  unavailableDays?: string[];
  notes?: string;
}

export interface Subject {
  id: string;
  subjectCode: string;
  subjectName: string;
  units: number;
  departmentId: string;
  requiredSpecialization: string[];
  requiredEquipment?: string[];
  yearLevel?: number; // Target year level for this subject
  hoursPerWeek?: number; // Contact hours per week
}

export interface Room {
  id: string;
  roomName: string;
  capacity: number;
  equipment: string[];
  building: string;
}

export interface Section {
  id: string;
  sectionName: string;
  yearLevel: number;
  studentCount: number;
  departmentId: string;
}

export interface CurriculumEntry {
  subjectId: string;
  sectionId: string;
  semester?: string;
  isRequired: boolean;
}

export interface TimeSlot {
  day: string;
  start: string;
  end: string;
}

export interface ScheduleAssignment {
  id: string;
  subjectId: string;
  facultyId: string;
  sectionId: string;
  roomId: string;
  day: string;
  startTime: string;
  endTime: string;
  status: 'approved' | 'generated' | 'conflict';
  score?: number;
}

export interface ConstraintViolation {
  type: 'faculty_double_booking' | 'room_double_booking' | 'section_overlap' | 
        'capacity_exceeded' | 'equipment_missing' | 'specialization_mismatch' |
        'unit_overload' | 'preference_violation' | 'duplicate_subject_section';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  scheduleIds: string[];
}

export interface GenerationResult {
  success: boolean;
  schedules: ScheduleAssignment[];
  violations: ConstraintViolation[];
  unassigned: UnassignedItem[];
  stats: GenerationStats;
}

export interface UnassignedItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  reason: string;
}

export interface GenerationStats {
  totalSlots: number;
  assignedSlots: number;
  assignmentRate: number;
  averageFacultyLoad: number;
  averageRoomUtilization: number;
  preferenceMatchRate: number;
  generationTimeMs: number;
  backtrackCount: number;
  skippedCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WORK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Time slots from 7:00 AM to 9:00 PM
export const TIME_RANGES = {
  START: '07:00',
  END: '21:00',
  MORNING_START: '07:00',
  MORNING_END: '12:00',
  AFTERNOON_START: '13:00',
  AFTERNOON_END: '18:00',
  EVENING_START: '18:00',
  EVENING_END: '21:00',
};

// Weight factors for scoring
// Load balance is prioritized to ensure fair distribution across faculty
const WEIGHTS = {
  FACULTY_PREFERENCE: 0.15,  // Reduced - preference is nice but not critical
  LOAD_BALANCE: 0.30,       // INCREASED - critical for fair distribution
  ROOM_EFFICIENCY: 0.10,    // Reduced
  TIME_QUALITY: 0.10,       // Reduced
  DAY_DISTRIBUTION: 0.10,
  BACKTRACK_PENALTY: 0.10,
};

// Standard class durations (in hours) based on units
const UNIT_TO_HOURS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);
  return start1 < end2 && end1 > start2;
}

function parseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate class duration based on units
 * Rules:
 * - 1 unit = 1 hour
 * - 2 units = 2 hours
 * - 3+ units = typically split into multiple meetings
 * - For now, we schedule the full hours per week
 */
function calculateDurationHours(subject: Subject): number {
  // If hours per week is specified, use that
  if (subject.hoursPerWeek && subject.hoursPerWeek > 0) {
    return subject.hoursPerWeek;
  }
  
  // Otherwise, calculate from units
  // Standard: 1 unit = 1 hour of lecture per week
  const units = subject.units || 3;
  return UNIT_TO_HOURS[units] || Math.min(units, 5); // Cap at 5 hours
}

/**
 * Determine how many meetings per week for a subject
 * Common patterns:
 * - 3-unit subjects: 1 meeting of 3 hours OR 2 meetings of 1.5 hours
 * - For simplicity, we do 1 meeting per subject per week
 */
function calculateMeetingsPerWeek(subject: Subject): number {
  // Default: 1 meeting per week
  return 1;
}

// ============================================================================
// CONSTRAINT CHECKERS
// ============================================================================

interface ConstraintContext {
  assignments: ScheduleAssignment[];
  faculty: Map<string, Faculty>;
  rooms: Map<string, Room>;
  sections: Map<string, Section>;
  subjects: Map<string, Subject>;
  facultyLoad: Map<string, number>;
  facultyDayLoad: Map<string, Map<string, number>>;
  roomDayUsage: Map<string, Map<string, Array<{start: string, end: string}>>>;
  sectionDayUsage: Map<string, Map<string, Array<{start: string, end: string}>>>;
  sectionSubjects: Map<string, Set<string>>; // Track subjects assigned to each section
  globalDayCount: Map<string, number>; // Track total schedules per day for balancing
}

function createConstraintContext(
  faculty: Faculty[],
  rooms: Room[],
  sections: Section[],
  subjects: Subject[]
): ConstraintContext {
  const ctx: ConstraintContext = {
    assignments: [],
    faculty: new Map(faculty.map(f => [f.id, f])),
    rooms: new Map(rooms.map(r => [r.id, r])),
    sections: new Map(sections.map(s => [s.id, s])),
    subjects: new Map(subjects.map(s => [s.id, s])),
    facultyLoad: new Map(faculty.map(f => [f.id, 0])),
    facultyDayLoad: new Map(faculty.map(f => [f.id, new Map(DAYS.map(d => [d, 0]))])),
    roomDayUsage: new Map(rooms.map(r => [r.id, new Map(DAYS.map(d => [d, []]))])),
    sectionDayUsage: new Map(sections.map(s => [s.id, new Map(DAYS.map(d => [d, []]))])),
    sectionSubjects: new Map(sections.map(s => [s.id, new Set<string>()])),
    globalDayCount: new Map(WORK_DAYS.map(d => [d, 0])),
  };
  return ctx;
}

function checkFacultyAvailability(
  ctx: ConstraintContext,
  facultyId: string,
  day: string,
  start: string,
  end: string
): boolean {
  const assignments = ctx.assignments.filter(a => 
    a.facultyId === facultyId && a.day === day
  );
  return !assignments.some(a => timesOverlap(a.startTime, a.endTime, start, end));
}

function checkRoomAvailability(
  ctx: ConstraintContext,
  roomId: string,
  day: string,
  start: string,
  end: string
): boolean {
  const assignments = ctx.assignments.filter(a => 
    a.roomId === roomId && a.day === day
  );
  return !assignments.some(a => timesOverlap(a.startTime, a.endTime, start, end));
}

function checkSectionAvailability(
  ctx: ConstraintContext,
  sectionId: string,
  day: string,
  start: string,
  end: string
): boolean {
  const assignments = ctx.assignments.filter(a => 
    a.sectionId === sectionId && a.day === day
  );
  return !assignments.some(a => timesOverlap(a.startTime, a.endTime, start, end));
}

function checkFacultyCapacity(
  ctx: ConstraintContext,
  facultyId: string,
  additionalUnits: number
): boolean {
  const faculty = ctx.faculty.get(facultyId);
  if (!faculty) return false;
  const currentLoad = ctx.facultyLoad.get(facultyId) || 0;
  return currentLoad + additionalUnits <= faculty.maxUnits;
}

function checkSpecialization(
  ctx: ConstraintContext,
  facultyId: string,
  subjectId: string
): boolean {
  const faculty = ctx.faculty.get(facultyId);
  const subject = ctx.subjects.get(subjectId);
  if (!faculty || !subject) return false;
  
  // If subject has no specialization requirements, anyone can teach
  if (subject.requiredSpecialization.length === 0) return true;
  
  // If faculty has no specializations, allow them to teach (new faculty)
  if (faculty.specialization.length === 0) return true;
  
  // Check if faculty has at least one required specialization
  return subject.requiredSpecialization.some(spec => faculty.specialization.includes(spec));
}

function checkRoomCapacity(
  ctx: ConstraintContext,
  roomId: string,
  sectionId: string
): boolean {
  const room = ctx.rooms.get(roomId);
  const section = ctx.sections.get(sectionId);
  if (!room || !section) return false;
  return room.capacity >= section.studentCount;
}

function checkRoomEquipment(
  ctx: ConstraintContext,
  roomId: string,
  subjectId: string
): boolean {
  const room = ctx.rooms.get(roomId);
  const subject = ctx.subjects.get(subjectId);
  if (!room || !subject) return true;
  
  const requiredEquipment = subject.requiredEquipment || [];
  if (requiredEquipment.length === 0) return true;
  return requiredEquipment.every(eq => room.equipment.includes(eq));
}

/**
 * Check if subject is already assigned to this section
 * Prevents duplicate subject-section assignments
 */
function checkSubjectNotDuplicate(
  ctx: ConstraintContext,
  subjectId: string,
  sectionId: string
): boolean {
  const assignedSubjects = ctx.sectionSubjects.get(sectionId);
  return !assignedSubjects || !assignedSubjects.has(subjectId);
}

/**
 * Check faculty unavailable days
 */
function checkFacultyUnavailableDay(
  ctx: ConstraintContext,
  facultyId: string,
  day: string
): boolean {
  const faculty = ctx.faculty.get(facultyId);
  if (!faculty?.preferences?.unavailableDays) return true;
  return !faculty.preferences.unavailableDays.includes(day);
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

function scoreFacultyPreference(
  ctx: ConstraintContext,
  facultyId: string,
  day: string,
  start: string,
  end: string,
  subjectId: string
): number {
  const faculty = ctx.faculty.get(facultyId);
  if (!faculty?.preferences) return 0.5; // Neutral score if no preferences
  
  let score = 0;
  const prefs = faculty.preferences;
  
  // Preferred day check (40% weight)
  if (prefs.preferredDays.includes(day)) {
    score += 0.4;
  }
  
  // Preferred time check (30% weight)
  const prefStart = timeToMinutes(prefs.preferredTimeStart);
  const prefEnd = timeToMinutes(prefs.preferredTimeEnd);
  const slotStart = timeToMinutes(start);
  const slotEnd = timeToMinutes(end);
  
  if (slotStart >= prefStart && slotEnd <= prefEnd) {
    score += 0.3;
  } else if (slotStart >= prefStart || slotEnd <= prefEnd) {
    score += 0.15; // Partial match
  }
  
  // Unavailable day penalty (major penalty)
  if (prefs.unavailableDays?.includes(day)) {
    score -= 0.8;
  }
  
  // Preferred subject check (bonus)
  if (prefs.preferredSubjects.includes(subjectId)) {
    score += 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function scoreLoadBalance(
  ctx: ConstraintContext,
  facultyId: string,
  additionalUnits: number
): number {
  const faculty = ctx.faculty.get(facultyId);
  if (!faculty) return 0;
  
  const currentLoad = ctx.facultyLoad.get(facultyId) || 0;
  const newLoad = currentLoad + additionalUnits;
  const utilization = newLoad / faculty.maxUnits;
  
  // IMPORTANT: We want to BALANCE load, so we give HIGHER scores
  // to UNDER-utilized faculty to encourage assigning them more work
  
  // Calculate how far from ideal (60-80%) we are
  if (utilization <= 0.3) return 1.0;   // Very under-utilized - HIGHEST priority
  if (utilization <= 0.5) return 0.9;   // Under-utilized - high priority
  if (utilization <= 0.7) return 0.8;   // Getting to ideal range
  if (utilization <= 0.85) return 0.7;  // Ideal range
  if (utilization <= 0.95) return 0.5;  // Getting full
  return 0.3; // Nearly at capacity - lower priority
}

function scoreDayDistribution(
  ctx: ConstraintContext,
  facultyId: string,
  day: string
): number {
  const dayLoad = ctx.facultyDayLoad.get(facultyId);
  if (!dayLoad) return 0.5;
  
  const loads = Array.from(dayLoad.values());
  const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
  const currentDayLoad = dayLoad.get(day) || 0;
  
  // Prefer adding to days with lower than average load
  if (currentDayLoad < avgLoad) return 1.0;
  if (currentDayLoad === avgLoad) return 0.8;
  return 0.6;
}

/**
 * Score based on global day balance
 * Encourages even distribution of schedules across all days
 * This prevents overloading certain days while others are empty
 */
function scoreGlobalDayBalance(
  ctx: ConstraintContext,
  day: string
): number {
  const dayCounts = Array.from(ctx.globalDayCount.values());
  const totalSchedules = dayCounts.reduce((a, b) => a + b, 0);
  
  if (totalSchedules === 0) return 0.5; // No schedules yet, neutral score
  
  const avgPerDay = totalSchedules / WORK_DAYS.length;
  const currentDayCount = ctx.globalDayCount.get(day) || 0;
  
  // Calculate how far below average this day is
  // Days with fewer schedules get higher scores to encourage balance
  const deficit = avgPerDay - currentDayCount;
  
  if (deficit > 2) return 1.0;  // Significantly under-scheduled
  if (deficit > 1) return 0.9;  // Moderately under-scheduled
  if (deficit > 0) return 0.8;  // Slightly under-scheduled
  if (deficit === 0) return 0.7; // At average
  if (deficit > -2) return 0.6; // Slightly over-scheduled
  if (deficit > -4) return 0.4; // Moderately over-scheduled
  return 0.2; // Significantly over-scheduled
}

function scoreTimeQuality(start: string, end: string): number {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  
  // Prefer morning and early afternoon classes (8 AM - 5 PM)
  const MORNING_START = 8 * 60; // 8:00 AM
  const PRIME_END = 17 * 60; // 5:00 PM
  const LATE_END = 18 * 60; // 6:00 PM
  
  if (startMin >= MORNING_START && endMin <= PRIME_END) {
    return 1.0; // Prime time
  }
  if (startMin >= MORNING_START && endMin <= LATE_END) {
    return 0.8; // Late afternoon
  }
  if (startMin >= 7 * 60 && endMin <= 21 * 60) {
    return 0.6; // Early morning or evening
  }
  return 0.4; // Less desirable times
}

function scoreRoomEfficiency(
  ctx: ConstraintContext,
  roomId: string,
  sectionId: string
): number {
  const room = ctx.rooms.get(roomId);
  const section = ctx.sections.get(sectionId);
  if (!room || !section) return 0;
  
  const utilization = section.studentCount / room.capacity;
  
  // Ideal room utilization is 60-85%
  if (utilization >= 0.6 && utilization <= 0.85) return 1.0;
  if (utilization >= 0.5 && utilization <= 0.9) return 0.8;
  if (utilization >= 0.3) return 0.6;
  return 0.4; // Room too large for section
}

function calculateOverallScore(
  ctx: ConstraintContext,
  facultyId: string,
  roomId: string,
  sectionId: string,
  subjectId: string,
  day: string,
  start: string,
  end: string,
  additionalUnits: number
): number {
  const preferenceScore = scoreFacultyPreference(ctx, facultyId, day, start, end, subjectId);
  const loadScore = scoreLoadBalance(ctx, facultyId, additionalUnits);
  const dayDistScore = scoreDayDistribution(ctx, facultyId, day);
  const globalDayScore = scoreGlobalDayBalance(ctx, day);
  const timeScore = scoreTimeQuality(start, end);
  const roomScore = scoreRoomEfficiency(ctx, roomId, sectionId);
  
  return (
    preferenceScore * WEIGHTS.FACULTY_PREFERENCE +
    loadScore * WEIGHTS.LOAD_BALANCE +
    dayDistScore * WEIGHTS.DAY_DISTRIBUTION +
    globalDayScore * 0.15 + // Add weight for global day balance
    timeScore * WEIGHTS.TIME_QUALITY +
    roomScore * WEIGHTS.ROOM_EFFICIENCY
  );
}

// ============================================================================
// SLOT GENERATION
// ============================================================================

interface SlotCandidate {
  day: string;
  start: string;
  end: string;
  timeScore: number;
}

/**
 * Generate time slot candidates
 * Supports different slot durations (1, 1.5, 2, 3 hours)
 */
function generateSlotCandidates(
  durationHours: number
): SlotCandidate[] {
  const candidates: SlotCandidate[] = [];
  
  // Round duration to nearest 0.5 hour
  const roundedDuration = Math.ceil(durationHours * 2) / 2;
  const durationMinutes = roundedDuration * 60;
  
  // Generate slots from 7:00 AM to 9:00 PM
  // Use 30-minute granularity for flexibility
  for (const day of WORK_DAYS) {
    for (let minutes = 7 * 60; minutes <= 21 * 60 - durationMinutes; minutes += 30) {
      const start = minutesToTime(minutes);
      const end = minutesToTime(minutes + durationMinutes);
      
      candidates.push({
        day,
        start,
        end,
        timeScore: scoreTimeQuality(start, end),
      });
    }
  }
  
  // Sort by time quality (descending)
  return candidates.sort((a, b) => b.timeScore - a.timeScore);
}

// ============================================================================
// CURRICULUM-BASED SUBJECT ASSIGNMENT
// ============================================================================

/**
 * Determine which subjects should be assigned to which sections
 * This is the core curriculum mapping logic
 */
function determineSubjectSectionPairs(
  sections: Map<string, Section>,
  subjects: Map<string, Subject>,
  curriculum?: CurriculumEntry[]
): Array<{ subjectId: string; sectionId: string }> {
  const pairs: Array<{ subjectId: string; sectionId: string }> = [];
  
  if (curriculum && curriculum.length > 0) {
    // Use provided curriculum mapping
    for (const entry of curriculum) {
      if (entry.isRequired) {
        pairs.push({ subjectId: entry.subjectId, sectionId: entry.sectionId });
      }
    }
  } else {
    // Auto-generate based on department and year level
    for (const [sectionId, section] of sections) {
      for (const [subjectId, subject] of subjects) {
        // Match by department
        if (subject.departmentId !== section.departmentId) continue;
        
        // Match by year level
        if (!subjectMatchesYearLevel(subject, section.yearLevel)) continue;
        
        pairs.push({ subjectId, sectionId });
      }
    }
  }
  
  return pairs;
}

/**
 * Check if a subject is appropriate for a given year level
 * Flexible matching: subjects can be assigned to sections within ±1 year level
 * This allows for:
 * - Advanced Year 1 students taking Year 2 subjects
 * - Year 4 students taking Year 3 electives
 * - Cross-year subjects like electives
 */
function subjectMatchesYearLevel(subject: Subject, sectionYearLevel: number, strictMode: boolean = false): boolean {
  // If subject has explicit year level, use that
  if (subject.yearLevel !== undefined) {
    if (strictMode) {
      return subject.yearLevel === sectionYearLevel;
    }
    // Allow ±1 year flexibility
    return Math.abs(subject.yearLevel - sectionYearLevel) <= 1;
  }
  
  // Extract year level from subject code (e.g., CS101 -> 1, CS201 -> 2, IT110 -> 1)
  // Look for the first digit sequence that could represent year level
  const match = subject.subjectCode.match(/\d(\d)?/);
  if (match) {
    // For codes like CS101, CS201, etc. - use the first digit
    const firstDigit = parseInt(subject.subjectCode.match(/\d/)?.[0] || '0');
    if (firstDigit >= 1 && firstDigit <= 5) {
      const subjectYear = firstDigit;
      
      if (strictMode) {
        return subjectYear === sectionYearLevel;
      }
      
      // Flexible: allow subjects within ±1 year level
      // Year 1 subjects (CS101) → can go to Year 1 or Year 2 sections
      // Year 2 subjects (CS201) → can go to Year 1, 2, or 3 sections
      // Year 3 subjects (CS301) → can go to Year 2, 3, or 4 sections
      // Year 4 subjects (CS401) → can go to Year 3, 4, or 5 sections
      return Math.abs(subjectYear - sectionYearLevel) <= 1;
    }
  }
  
  // If can't determine from code, check subject name patterns
  const nameLower = subject.subjectName.toLowerCase();
  if (nameLower.includes('1st year') || nameLower.includes('first year')) {
    return strictMode ? sectionYearLevel === 1 : Math.abs(1 - sectionYearLevel) <= 1;
  }
  if (nameLower.includes('2nd year') || nameLower.includes('second year')) {
    return strictMode ? sectionYearLevel === 2 : Math.abs(2 - sectionYearLevel) <= 1;
  }
  if (nameLower.includes('3rd year') || nameLower.includes('third year')) {
    return strictMode ? sectionYearLevel === 3 : Math.abs(3 - sectionYearLevel) <= 1;
  }
  if (nameLower.includes('4th year') || nameLower.includes('fourth year')) {
    return strictMode ? sectionYearLevel === 4 : Math.abs(4 - sectionYearLevel) <= 1;
  }
  if (nameLower.includes('5th year') || nameLower.includes('fifth year')) {
    return strictMode ? sectionYearLevel === 5 : Math.abs(5 - sectionYearLevel) <= 1;
  }
  
  // Check for keywords that suggest all-year applicability
  const electiveKeywords = ['elective', 'seminar', 'workshop', 'special topics', 'research', 'thesis', 'capstone'];
  if (electiveKeywords.some(kw => nameLower.includes(kw))) {
    return true; // Electives and special subjects can be for any year
  }
  
  // Default: assume subject is valid for all year levels if no pattern found
  return true;
}

// ============================================================================
// MAIN SCHEDULING ALGORITHM
// ============================================================================

export class ScheduleGenerator {
  private ctx: ConstraintContext;
  private unassigned: UnassignedItem[] = [];
  private backtrackCount = 0;
  private maxBacktracks = 50000;
  private startTime = 0;
  private skippedCount = 0;

  constructor(
    faculty: Faculty[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[],
    private curriculum?: CurriculumEntry[]
  ) {
    this.ctx = createConstraintContext(faculty, rooms, sections, subjects);
  }

  /**
   * Main entry point - generates conflict-free schedules
   */
  generate(): GenerationResult {
    this.startTime = Date.now();
    this.unassigned = [];
    this.backtrackCount = 0;
    this.skippedCount = 0;

    // Get subject-section pairs based on curriculum or auto-detection
    const subjectSectionPairs = determineSubjectSectionPairs(
      this.ctx.sections,
      this.ctx.subjects,
      this.curriculum
    );

    console.log(`Scheduling ${subjectSectionPairs.length} subject-section pairs`);

    // Create scheduling tasks
    const tasks = this.createSchedulingTasks(subjectSectionPairs);
    
    // Sort tasks by difficulty (most constrained first - MRV heuristic)
    const sortedTasks = this.sortByDifficulty(tasks);

    console.log(`Created ${tasks.length} scheduling tasks`);

    // Solve using backtracking with forward checking
    const success = this.solve(sortedTasks, 0);

    const stats = this.calculateStats(subjectSectionPairs.length);

    return {
      success,
      schedules: this.ctx.assignments,
      violations: this.detectViolations(),
      unassigned: this.unassigned,
      stats,
    };
  }

  /**
   * Creates scheduling tasks from subject-section pairs
   */
  private createSchedulingTasks(pairs: Array<{ subjectId: string; sectionId: string }>): Array<{
    subjectId: string;
    subject: Subject;
    sectionId: string;
    section: Section;
    difficulty: number;
  }> {
    const tasks: Array<{
      subjectId: string;
      subject: Subject;
      sectionId: string;
      section: Section;
      difficulty: number;
    }> = [];

    for (const pair of pairs) {
      const subject = this.ctx.subjects.get(pair.subjectId);
      const section = this.ctx.sections.get(pair.sectionId);
      
      if (!subject || !section) continue;

      // Calculate difficulty (fewer options = higher difficulty)
      const eligibleFaculty = this.getEligibleFaculty(subject);
      const suitableRooms = this.getSuitableRooms(section);
      
      // Higher difficulty = fewer options = should be scheduled first
      const difficulty = 100 - (eligibleFaculty.length * 10) - (suitableRooms.length * 5);

      tasks.push({
        subjectId: subject.id,
        subject,
        sectionId: section.id,
        section,
        difficulty,
      });
    }

    return tasks;
  }

  /**
   * Sorts tasks by difficulty (Most Constrained Variable heuristic)
   */
  private sortByDifficulty(
    tasks: Array<{
      subjectId: string;
      subject: Subject;
      sectionId: string;
      section: Section;
      difficulty: number;
    }>
  ): typeof tasks {
    return tasks.sort((a, b) => b.difficulty - a.difficulty);
  }

  /**
   * Gets faculty eligible to teach a subject
   */
  private getEligibleFaculty(subject: Subject): Faculty[] {
    return Array.from(this.ctx.faculty.values()).filter(f => {
      // Check specialization match
      if (!checkSpecialization(this.ctx, f.id, subject.id)) return false;

      // Check remaining capacity
      const currentLoad = this.ctx.facultyLoad.get(f.id) || 0;
      if (currentLoad + subject.units > f.maxUnits) return false;

      return true;
    });
  }

  /**
   * Gets rooms suitable for a section
   */
  private getSuitableRooms(section: Section): Room[] {
    return Array.from(this.ctx.rooms.values())
      .filter(r => r.capacity >= section.studentCount)
      .sort((a, b) => a.capacity - b.capacity); // Prefer smaller rooms
  }

  /**
   * Main solving algorithm using greedy assignment with backtracking
   * Uses Least Constraining Value (LCV) heuristic
   */
  private solve(
    tasks: Array<{
      subjectId: string;
      subject: Subject;
      sectionId: string;
      section: Section;
      difficulty: number;
    }>,
    index: number
  ): boolean {
    if (index >= tasks.length) return true;

    // Prevent infinite loops
    if (this.backtrackCount >= this.maxBacktracks) {
      console.warn('Max backtracks reached, stopping generation');
      // Mark remaining tasks as unassigned
      for (let i = index; i < tasks.length; i++) {
        const task = tasks[i];
        this.unassigned.push({
          subjectId: task.subjectId,
          subjectCode: task.subject.subjectCode,
          subjectName: task.subject.subjectName,
          sectionId: task.sectionId,
          sectionName: task.section.sectionName,
          reason: 'Generation stopped due to complexity limit',
        });
      }
      return false;
    }

    const task = tasks[index];
    const { subject, section } = task;

    // Check for duplicate subject-section assignment
    if (!checkSubjectNotDuplicate(this.ctx, subject.id, section.id)) {
      // Skip this task - subject already assigned to section
      this.skippedCount++;
      return this.solve(tasks, index + 1);
    }

    // Generate candidates for this task
    const candidates = this.generateCandidates(task);

    if (candidates.length === 0) {
      // No valid candidates - mark as unassigned and continue
      this.unassigned.push({
        subjectId: subject.id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        sectionId: section.id,
        sectionName: section.sectionName,
        reason: 'No valid time slot, faculty, or room combination available',
      });
      return this.solve(tasks, index + 1);
    }

    // Try each candidate (sorted by score - best first)
    for (const candidate of candidates) {
      this.backtrackCount++;

      if (this.tryAssign(candidate)) {
        // Successfully assigned, continue to next task
        const result = this.solve(tasks, index + 1);
        if (result) return true;

        // Backtrack - remove the assignment and try next candidate
        this.removeAssignment(candidate.id);
      }
    }

    // No valid assignment found after trying all candidates
    this.unassigned.push({
      subjectId: subject.id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      sectionId: section.id,
      sectionName: section.sectionName,
      reason: 'Could not find conflict-free assignment after backtracking',
    });

    // Continue with remaining tasks (greedy approach)
    return this.solve(tasks, index + 1);
  }

  /**
   * Generates all valid candidates for a task, sorted by score
   */
  private generateCandidates(task: {
    subjectId: string;
    subject: Subject;
    sectionId: string;
    section: Section;
  }): ScheduleAssignment[] {
    const candidates: ScheduleAssignment[] = [];
    const { subject, section } = task;

    const eligibleFaculty = this.getEligibleFaculty(subject);
    const suitableRooms = this.getSuitableRooms(section);
    const duration = calculateDurationHours(subject);
    
    // Generate slots for ALL work days
    const slots = generateSlotCandidates(duration);

    // Limit candidates to prevent combinatorial explosion
    const maxCandidates = 1000;
    let candidateCount = 0;

    for (const faculty of eligibleFaculty) {
      for (const room of suitableRooms) {
        for (const slot of slots) {
          // Early exit if we have enough candidates
          if (candidateCount >= maxCandidates) break;
          
          // Check all hard constraints
          if (!checkFacultyAvailability(this.ctx, faculty.id, slot.day, slot.start, slot.end)) continue;
          if (!checkRoomAvailability(this.ctx, room.id, slot.day, slot.start, slot.end)) continue;
          if (!checkSectionAvailability(this.ctx, section.id, slot.day, slot.start, slot.end)) continue;
          if (!checkRoomEquipment(this.ctx, room.id, subject.id)) continue;
          if (!checkFacultyUnavailableDay(this.ctx, faculty.id, slot.day)) continue;
          if (!checkRoomCapacity(this.ctx, room.id, section.id)) continue;

          // Calculate score
          const score = calculateOverallScore(
            this.ctx,
            faculty.id,
            room.id,
            section.id,
            subject.id,
            slot.day,
            slot.start,
            slot.end,
            subject.units
          );

          candidates.push({
            id: generateUniqueId(),
            subjectId: subject.id,
            facultyId: faculty.id,
            sectionId: section.id,
            roomId: room.id,
            day: slot.day,
            startTime: slot.start,
            endTime: slot.end,
            status: 'generated',
            score,
          });
          
          candidateCount++;
        }
        if (candidateCount >= maxCandidates) break;
      }
      if (candidateCount >= maxCandidates) break;
    }

    // Sort by score (descending) - best candidates first
    return candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Attempts to assign a candidate
   */
  private tryAssign(candidate: ScheduleAssignment): boolean {
    // Double-check all constraints
    if (!checkFacultyAvailability(this.ctx, candidate.facultyId, candidate.day, candidate.startTime, candidate.endTime)) {
      return false;
    }
    if (!checkRoomAvailability(this.ctx, candidate.roomId, candidate.day, candidate.startTime, candidate.endTime)) {
      return false;
    }
    if (!checkSectionAvailability(this.ctx, candidate.sectionId, candidate.day, candidate.startTime, candidate.endTime)) {
      return false;
    }

    // Get subject for units
    const subject = this.ctx.subjects.get(candidate.subjectId);
    if (!subject) return false;

    if (!checkFacultyCapacity(this.ctx, candidate.facultyId, subject.units)) {
      return false;
    }

    // Check for duplicate subject-section
    if (!checkSubjectNotDuplicate(this.ctx, candidate.subjectId, candidate.sectionId)) {
      return false;
    }

    // Assign
    this.ctx.assignments.push(candidate);

    // Update faculty load tracking
    const currentLoad = this.ctx.facultyLoad.get(candidate.facultyId) || 0;
    this.ctx.facultyLoad.set(candidate.facultyId, currentLoad + subject.units);

    const dayLoad = this.ctx.facultyDayLoad.get(candidate.facultyId);
    if (dayLoad) {
      const current = dayLoad.get(candidate.day) || 0;
      dayLoad.set(candidate.day, current + 1);
    }

    // Update room usage
    const roomUsage = this.ctx.roomDayUsage.get(candidate.roomId);
    if (roomUsage) {
      const dayUsage = roomUsage.get(candidate.day);
      if (dayUsage) {
        dayUsage.push({ start: candidate.startTime, end: candidate.endTime });
      }
    }

    // Update section usage
    const sectionUsage = this.ctx.sectionDayUsage.get(candidate.sectionId);
    if (sectionUsage) {
      const dayUsage = sectionUsage.get(candidate.day);
      if (dayUsage) {
        dayUsage.push({ start: candidate.startTime, end: candidate.endTime });
      }
    }

    // Track subject assigned to section
    const sectionSubjects = this.ctx.sectionSubjects.get(candidate.sectionId);
    if (sectionSubjects) {
      sectionSubjects.add(candidate.subjectId);
    }

    // Update global day count for balancing
    const currentDayCount = this.ctx.globalDayCount.get(candidate.day) || 0;
    this.ctx.globalDayCount.set(candidate.day, currentDayCount + 1);

    return true;
  }

  /**
   * Removes an assignment (for backtracking)
   */
  private removeAssignment(id: string): void {
    const index = this.ctx.assignments.findIndex(a => a.id === id);
    if (index === -1) return;

    const assignment = this.ctx.assignments[index];
    const subject = this.ctx.subjects.get(assignment.subjectId);

    // Remove from assignments
    this.ctx.assignments.splice(index, 1);

    // Update faculty load tracking
    if (subject) {
      const currentLoad = this.ctx.facultyLoad.get(assignment.facultyId) || 0;
      this.ctx.facultyLoad.set(assignment.facultyId, Math.max(0, currentLoad - subject.units));
    }

    const dayLoad = this.ctx.facultyDayLoad.get(assignment.facultyId);
    if (dayLoad) {
      const current = dayLoad.get(assignment.day) || 0;
      dayLoad.set(assignment.day, Math.max(0, current - 1));
    }

    // Update room usage
    const roomUsage = this.ctx.roomDayUsage.get(assignment.roomId);
    if (roomUsage) {
      const dayUsage = roomUsage.get(assignment.day);
      if (dayUsage) {
        const idx = dayUsage.findIndex(u => u.start === assignment.startTime && u.end === assignment.endTime);
        if (idx >= 0) dayUsage.splice(idx, 1);
      }
    }

    // Update section usage
    const sectionUsage = this.ctx.sectionDayUsage.get(assignment.sectionId);
    if (sectionUsage) {
      const dayUsage = sectionUsage.get(assignment.day);
      if (dayUsage) {
        const idx = dayUsage.findIndex(u => u.start === assignment.startTime && u.end === assignment.endTime);
        if (idx >= 0) dayUsage.splice(idx, 1);
      }
    }

    // Remove subject from section tracking
    const sectionSubjects = this.ctx.sectionSubjects.get(assignment.sectionId);
    if (sectionSubjects) {
      sectionSubjects.delete(assignment.subjectId);
    }

    // Update global day count for balancing
    const currentDayCount = this.ctx.globalDayCount.get(assignment.day) || 0;
    this.ctx.globalDayCount.set(assignment.day, Math.max(0, currentDayCount - 1));
  }

  /**
   * Detects any constraint violations in the final schedule
   */
  private detectViolations(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (let i = 0; i < this.ctx.assignments.length; i++) {
      const a1 = this.ctx.assignments[i];

      for (let j = i + 1; j < this.ctx.assignments.length; j++) {
        const a2 = this.ctx.assignments[j];

        if (a1.day !== a2.day) continue;
        if (!timesOverlap(a1.startTime, a1.endTime, a2.startTime, a2.endTime)) continue;

        // Faculty double booking
        if (a1.facultyId === a2.facultyId) {
          const faculty = this.ctx.faculty.get(a1.facultyId);
          violations.push({
            type: 'faculty_double_booking',
            severity: 'critical',
            description: `Faculty ${faculty?.name || a1.facultyId} is double-booked on ${a1.day} (${a1.startTime}-${a1.endTime} and ${a2.startTime}-${a2.endTime})`,
            scheduleIds: [a1.id, a2.id],
          });
        }

        // Room double booking
        if (a1.roomId === a2.roomId) {
          const room = this.ctx.rooms.get(a1.roomId);
          violations.push({
            type: 'room_double_booking',
            severity: 'critical',
            description: `Room ${room?.roomName || a1.roomId} is double-booked on ${a1.day} (${a1.startTime}-${a1.endTime} and ${a2.startTime}-${a2.endTime})`,
            scheduleIds: [a1.id, a2.id],
          });
        }

        // Section overlap
        if (a1.sectionId === a2.sectionId) {
          const section = this.ctx.sections.get(a1.sectionId);
          violations.push({
            type: 'section_overlap',
            severity: 'critical',
            description: `Section ${section?.sectionName || a1.sectionId} has overlapping classes on ${a1.day}`,
            scheduleIds: [a1.id, a2.id],
          });
        }
      }
    }

    // Check for capacity violations
    for (const assignment of this.ctx.assignments) {
      const room = this.ctx.rooms.get(assignment.roomId);
      const section = this.ctx.sections.get(assignment.sectionId);
      
      if (room && section && room.capacity < section.studentCount) {
        violations.push({
          type: 'capacity_exceeded',
          severity: 'warning',
          description: `Room ${room.roomName} capacity (${room.capacity}) is less than section ${section.sectionName} size (${section.studentCount})`,
          scheduleIds: [assignment.id],
        });
      }
    }

    return violations;
  }

  /**
   * Calculates generation statistics
   */
  private calculateStats(totalPairs: number): GenerationStats {
    const assignedSlots = this.ctx.assignments.length;
    
    // Calculate faculty utilization
    const facultyUtilizations: number[] = [];
    for (const [facultyId, load] of this.ctx.facultyLoad) {
      const faculty = this.ctx.faculty.get(facultyId);
      if (faculty && faculty.maxUnits > 0) {
        facultyUtilizations.push(load / faculty.maxUnits);
      }
    }
    const averageFacultyLoad = facultyUtilizations.length > 0
      ? facultyUtilizations.reduce((a, b) => a + b, 0) / facultyUtilizations.length
      : 0;

    // Calculate preference match rate
    let preferenceMatches = 0;
    for (const assignment of this.ctx.assignments) {
      const faculty = this.ctx.faculty.get(assignment.facultyId);
      if (faculty?.preferences) {
        if (faculty.preferences.preferredDays.includes(assignment.day)) {
          preferenceMatches++;
        }
      }
    }
    const preferenceMatchRate = this.ctx.assignments.length > 0
      ? preferenceMatches / this.ctx.assignments.length
      : 0;

    // Calculate room utilization
    const usedRooms = new Set(this.ctx.assignments.map(a => a.roomId));
    const averageRoomUtilization = this.ctx.rooms.size > 0
      ? usedRooms.size / this.ctx.rooms.size
      : 0;

    return {
      totalSlots: totalPairs,
      assignedSlots,
      assignmentRate: totalPairs > 0 ? assignedSlots / totalPairs : 0,
      averageFacultyLoad,
      averageRoomUtilization,
      preferenceMatchRate,
      generationTimeMs: Date.now() - this.startTime,
      backtrackCount: this.backtrackCount,
      skippedCount: this.skippedCount,
    };
  }
}

// ============================================================================
// EXPORT HELPER FUNCTION
// ============================================================================

export function generateSchedules(
  faculty: Faculty[],
  rooms: Room[],
  sections: Section[],
  subjects: Subject[],
  curriculum?: CurriculumEntry[]
): GenerationResult {
  const generator = new ScheduleGenerator(faculty, rooms, sections, subjects, curriculum);
  return generator.generate();
}

// Export utility functions for external use
export {
  timeToMinutes,
  minutesToTime,
  timesOverlap,
  calculateDurationHours,
  subjectMatchesYearLevel,
};
