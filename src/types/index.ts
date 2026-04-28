// User Types
export type UserRole = 'admin' | 'department_head' | 'faculty';
export type ContractType = 'full-time' | 'part-time';
export type ScheduleStatus = 'generated' | 'approved' | 'modified' | 'conflict';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type NotificationType = 'info' | 'warning' | 'success' | 'error';
export type ConflictType = 'faculty_double_booking' | 'room_double_booking' | 'section_overlap';

// Entity Interfaces
export interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  contractType: ContractType;
  maxUnits: number;
  specialization: string[];
  image?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
  department?: Department;
  preferences?: FacultyPreference | null;
  _count?: { schedules: number };
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  college: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number; subjects: number; sections: number };
}

export interface Subject {
  id: string;
  subjectCode: string;
  subjectName: string;
  description?: string | null;
  units: number;
  departmentId: string;
  requiredSpecialization: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  department?: Department;
  _count?: { schedules: number };
}

export interface Room {
  id: string;
  roomName: string;
  roomCode?: string | null;
  capacity: number;
  equipment: string[];
  building: string;
  floor?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { schedules: number };
}

export interface Section {
  id: string;
  sectionName: string;
  sectionCode?: string | null;
  yearLevel: number;
  departmentId: string;
  studentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  department?: Department;
  _count?: { schedules: number };
}

export interface Schedule {
  id: string;
  subjectId: string;
  facultyId: string;
  sectionId: string;
  roomId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  semester?: string | null;
  academicYear?: string | null;
  createdAt: Date;
  updatedAt: Date;
  subject?: Subject;
  faculty?: User;
  section?: Section;
  room?: Room;
  conflicts?: string[];
}

export interface FacultyPreference {
  id: string;
  facultyId: string;
  preferredDays: DayOfWeek[];
  preferredTimeStart: string;
  preferredTimeEnd: string;
  preferredSubjects: string[];
  unavailableDays?: string[] | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  actionUrl?: string | null;
  createdAt: Date;
}

export interface ScheduleLog {
  id: string;
  scheduleId: string;
  modifiedBy: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  action: 'created' | 'modified' | 'deleted';
  reason?: string | null;
  timestamp: Date;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  scheduleId1: string;
  scheduleId2: string | null;
  description: string;
  severity?: 'critical' | 'warning' | 'info';
  suggestedResolution?: string | null;
  resolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string | null;
  category: string;
  updatedAt: Date;
}

// Dashboard Stats
export interface DashboardStats {
  totalFaculty: number;
  totalSchedules: number;
  totalConflicts: number;
  facultyUtilizationAvg: number;
  facultyUtilization: Array<{ id: string; name: string; image?: string | null; assigned: number; max: number; percent: number }>;
  roomOccupancy: number;
  overloadedFaculty: number;
  underloadedFaculty: number;
  schedulesByDay: Array<{ day: string; count: number }>;
  schedulesByStatus: Array<{ status: string; count: number }>;
  facultyByDepartment: Array<{ department: string; count: number }>;
  roomUtilization: Array<{ room: string; utilization: number }>;
}

// Time Slot
export interface TimeSlot {
  startTime: string;
  endTime: string;
}

// Constants
export const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Time slots from 7:00 AM to 9:00 PM (07:00 - 21:00)
export const TIME_SLOTS: TimeSlot[] = [
  { startTime: '07:00', endTime: '08:00' },
  { startTime: '08:00', endTime: '09:00' },
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '12:00', endTime: '13:00' },
  { startTime: '13:00', endTime: '14:00' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '17:00', endTime: '18:00' },
  { startTime: '18:00', endTime: '19:00' },
  { startTime: '19:00', endTime: '20:00' },
  { startTime: '20:00', endTime: '21:00' },
];

// Time options for dropdowns (for forms) - 12-hour format display
export const TIME_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
];

export const EQUIPMENT_OPTIONS = [
  'Computers',
  'Projector',
  'Whiteboard',
  'AC',
  'Microphone',
  'Engineering Software',
  'Lab Equipment',
];

export const SPECIALIZATION_OPTIONS = [
  'Programming',
  'Web Development',
  'Mobile Development',
  'Database Systems',
  'Data Structures',
  'Algorithms',
  'Networking',
  'Cybersecurity',
  'UI/UX',
  'Engineering Mathematics',
  'Thermodynamics',
  'Structural Analysis',
  'Civil Engineering',
  'Marketing',
  'Business Strategy',
  'Entrepreneurship',
];

// API Response Types
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form Types
export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  role: UserRole;
  departmentId?: string;
  contractType: ContractType;
  maxUnits: number;
  specialization: string[];
}

export interface ScheduleFormData {
  subjectId: string;
  facultyId: string;
  sectionId: string;
  roomId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface DepartmentFormData {
  name: string;
  code?: string;
  college: string;
}

export interface SubjectFormData {
  subjectCode: string;
  subjectName: string;
  description?: string;
  units: number;
  departmentId: string;
  requiredSpecialization: string[];
}

export interface RoomFormData {
  roomName: string;
  roomCode?: string;
  capacity: number;
  equipment: string[];
  building: string;
  floor?: number;
}

export interface SectionFormData {
  sectionName: string;
  sectionCode?: string;
  yearLevel: number;
  departmentId: string;
  studentCount: number;
}
