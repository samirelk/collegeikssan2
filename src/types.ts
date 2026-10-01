export interface AppSettings {
  institution: string;
  year: string;
  teacher: string;
}

export type TeacherSubject =
  | 'الرياضيات'
  | 'الفرنسية'
  | 'العربية'
  | 'المعلوميات'
  | 'علوم الحياة والأرض'
  | 'علوم الفيزياء'
  | 'الاجتماعيات'
  | 'التربية الإسلامية'
  | 'الرياضة';

export const TEACHER_SUBJECTS: TeacherSubject[] = [
  'الرياضيات',
  'الفرنسية',
  'العربية',
  'المعلوميات',
  'علوم الحياة والأرض',
  'علوم الفيزياء',
  'الاجتماعيات',
  'التربية الإسلامية',
  'الرياضة'
];

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'director' | 'teacher';
  academicYear: string;
  subject?: string;
  status: 'active' | 'pending' | 'inactive';
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  mustChangeProfile?: boolean;
  createdAt: string;
}

export interface DirectorItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'director';
  academicYear: string;
  status: 'active' | 'inactive' | 'pending';
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  mustChangeProfile?: boolean;
  createdAt: string;
}

export interface AcademicYearItem {
  id: string;
  name: string; // e.g. '2026/2027'
  startDate: string; // e.g. '2026-09-01' (1 شتنبر)
  endDate: string; // e.g. '2027-07-30' (30 يوليوز)
  isCurrent: boolean;
  isArchived: boolean;
  notes?: string;
  createdAt: string;
  archivedAt?: string | null;
}

export interface SectionAssignmentRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subject?: string;
  sectionId: string;
  level: string;
  classNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  requestNote?: string;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface StudentChangeRequest {
  id: string;
  sectionId: string;
  level?: string;
  classNumber?: string;
  teacherId: string;
  teacherName: string;
  teacherSubject: string;
  requestType: 'add' | 'remove';
  studentName: string;
  studentNumber: string;
  seatNum?: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  type: 'password_reset' | 'request_approved' | 'request_rejected' | 'admin_notification' | 'student_change_approved' | 'student_change_rejected';
  token?: string;
}

export interface NoteItem {
  id: string;
  text: string;
  date: string;
  time: string;
}

export interface StudentViolationRecord {
  id: string;
  sectionId?: string;
  seatNum?: number;
  studentName?: string;
  studentNumber?: string;
  massarNumber?: string;
  violationType: string;
  description?: string;
  actionTaken?: string;
  teacherName?: string;
  teacherSubject?: string;
  recordedDate: string; // French numerals DD/MM/YYYY
  recordedTime: string; // French numerals HH:mm
  createdAt?: string;
}

export interface PositiveParticipationItem {
  id: string;
  sectionId?: string;
  seatNum?: number;
  studentName?: string;
  studentNumber?: string;
  massarNumber?: string;
  participationType: string;
  points: number;
  note?: string;
  teacherName?: string;
  teacherSubject?: string;
  teacherId?: string;
  recordedDate: string;
  recordedTime: string;
  createdAt?: string;
}

export interface ViolationTypeItem {
  id: string;
  title: string;
  severity?: 'normal' | 'high' | 'critical' | string;
  order_index?: number;
  created_at?: string;
}

export type SeatStatusColor = 'default' | 'needs_help' | 'excellent' | 'reserved' | 'special_case';
export type SeatAttendance = 'present' | 'absent' | 'late' | null;

export interface SeatStatusInfo {
  id: SeatStatusColor;
  label: string;
  bgClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
}

export const SEAT_STATUS_LIST: SeatStatusInfo[] = [
  {
    id: 'default',
    label: 'عادي',
    bgClass: 'bg-[#F4EFDE]',
    borderClass: 'border-[#E4DBC0]',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-800',
    dotColor: '#A8A29E'
  },
  {
    id: 'needs_help',
    label: 'يحتاج مساعدة',
    bgClass: 'bg-[#FEF3C7]',
    borderClass: 'border-[#F59E0B]',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    dotColor: '#F59E0B'
  },
  {
    id: 'excellent',
    label: 'تلميذ متفوق',
    bgClass: 'bg-[#D1FAE5]',
    borderClass: 'border-[#10B981]',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    dotColor: '#10B981'
  },
  {
    id: 'reserved',
    label: 'مقعد محجوز / فارغ',
    bgClass: 'bg-[#F3E8FF]',
    borderClass: 'border-[#A855F7]',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    dotColor: '#A855F7'
  },
  {
    id: 'special_case',
    label: 'حالة خاصة (سمع/بصر/صحة)',
    bgClass: 'bg-[#E0F2FE]',
    borderClass: 'border-[#0284C7]',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    dotColor: '#0284C7'
  }
];

export interface SeatItem {
  seat: number;
  name: string;
  number: string;
  massarNumber?: string;
  notes: NoteItem[];
  violations?: StudentViolationRecord[];
  positiveParticipationCount?: number;
  positiveParticipations?: PositiveParticipationItem[];
  rosterId: string | null;
  statusColor?: SeatStatusColor;
  attendance?: SeatAttendance;
  seatNum?: number;
  studentName?: string;
  studentNumber?: string;
}

export interface RosterItem {
  id: string;
  name: string;
  number: string;
  massarNumber?: string;
  positiveParticipationCount?: number;
  positiveParticipations?: PositiveParticipationItem[];
}

export interface AssignedTeacherSummary {
  teacherId: string;
  teacherName: string;
  subject: string;
  academicYear?: string;
}

export interface SectionItem {
  id: string;
  level: string;
  classNumber: string;
  teacher: string;
  createdAt: number;
  seats: SeatItem[];
  roster: RosterItem[];
  assignedTeacherId?: string | null;
  assignmentStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  assignedTeacherName?: string | null;
  assignedTeachers?: AssignedTeacherSummary[];
}

export interface AvailableSectionItem {
  id: string;
  level: string;
  classNumber: string;
  teacher: string;
  studentCount: number;
  assignedTeacherId: string | null;
  assignedTeacherName: string | null;
  assignmentStatus: 'none' | 'pending' | 'approved' | 'assigned_to_other';
  assignedSubjects?: Array<{ subject: string; teacherName: string; teacherId: string }>;
  isMySubjectAssigned?: boolean;
}

export interface DbStats {
  engine: string;
  dbPath: string;
  fileSizeKb: number;
  sectionsCount: number;
  assignedSeatsCount: number;
  notesCount: number;
  historyCount: number;
  status: string;
  teachersCount?: number;
  pendingRequestsCount?: number;
  pendingStudentChangesCount?: number;
}

export interface ChangeLogItem {
  id: number;
  action: string;
  summary: string;
  details_json: string;
  created_at: string;
}

export interface TeacherItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'teacher';
  academicYear: string;
  status: 'active' | 'pending' | 'inactive';
  subject: string;
  emailVerified?: boolean;
  createdAt: string;
  assignedSectionsCount: number;
}

export interface DirectorStudentItem {
  sectionId: string;
  seatNum: number;
  studentName: string;
  studentNumber: string;
  massarNumber?: string;
  sectionLevel: string;
  sectionClass: string;
  teacherName: string;
  teacherSubject: string;
  violationsCount: number;
  absencesCount: number;
  currentAttendance: SeatAttendance;
  statusColor?: SeatStatusColor;
  lastViolationText?: string;
  lastViolationDate?: string;
}

export interface DirectorAnalytics {
  topViolations: DirectorStudentItem[];
  topAbsences: DirectorStudentItem[];
  allStudents: DirectorStudentItem[];
  allViolations?: Array<{
    id?: string;
    sectionId?: string;
    level?: string;
    classNumber?: string;
    sectionName?: string;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    violationType: string;
    date?: string;
    time?: string;
    teacherName?: string;
    teacherSubject?: string;
    actionTaken?: string;
    notes?: string;
  }>;
  allAbsences?: Array<{
    id?: string | number;
    sectionId?: string;
    level?: string;
    classNumber?: string;
    sectionName?: string;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    status?: string;
    date?: string;
    time?: string;
    session?: string;
    teacherName?: string;
    subject?: string;
    isJustified?: boolean;
    justificationReason?: string;
  }>;
  summary: {
    totalStudents: number;
    totalTeachers: number;
    totalSections: number;
    totalViolations: number;
    totalAbsences: number;
  };
}

export type ActivityCategory =
  | 'أنشطة علمية'
  | 'أنشطة رياضية'
  | 'أنشطة ثقافية'
  | 'ورشات تربوية'
  | 'احتفالات وتكريمات'
  | 'رحلات مدرسية'
  | 'أنشطة عامة';

export interface SchoolActivity {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory | string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'director' | 'teacher';
  authorSubject?: string;
  status: 'pending' | 'approved' | 'rejected';
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

// Daily Archive: Absences & Violations (أرشيف الغيابات والمخالفات اليومي)
export type AbsenceJustifiedStatus = 'unjustified' | 'justified' | 'medical' | 'permission';

export interface DailyAbsenceItem {
  id: number;
  sectionId: string;
  sectionLevel?: string;
  sectionClass?: string;
  seatNum: number;
  studentName: string;
  studentNumber: string;
  massarNumber?: string;
  status: 'absent' | 'late';
  recordedDate: string; // YYYY-MM-DD
  sessionPeriod?: string;
  teacherName?: string;
  teacherSubject?: string;
  removerName?: string;
  removerSubject?: string;
  removedAt?: string | null;
  absenceMode?: 'hours' | 'days';
  durationHours?: number;
  durationDays?: number;
  durationLabel?: string;
  isOngoing?: boolean;
  justified?: AbsenceJustifiedStatus;
  justificationReason?: string;
  notes?: string;
  createdAt: string;
}

export type ViolationCategory =
  | 'تشويش داخل القسم'
  | 'عدم إحضار اللوازم المدرسية'
  | 'عدم إنجاز الواجب المنزلي'
  | 'سوء سلوك وقلة انضباط'
  | 'استخدام الهاتف النقال'
  | 'تأخر متكرر عن الحصة'
  | 'هندام غير لائق'
  | 'إتلاف التجهيزات المدرسية'
  | 'مخالفة تربوية أخرى';

export type DisciplinaryAction =
  | 'تنبيه شفهي'
  | 'إنذار كتابي'
  | 'إشعار لولي الأمر'
  | 'إحالة للحراسة العامة'
  | 'استدعاء ولي الأمر'
  | 'إحالة لمجلس الانضباط';

export interface DailyViolationItem {
  id: string;
  sectionId: string;
  sectionLevel?: string;
  sectionClass?: string;
  seatNum?: number;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  violationType: ViolationCategory | string;
  description: string;
  actionTaken?: DisciplinaryAction | string;
  teacherName?: string;
  teacherSubject?: string;
  recordedDate: string; // YYYY-MM-DD
  recordedTime: string; // HH:mm
  createdAt: string;
}

export interface DailyArchiveStats {
  totalAbsences: number;
  totalLates: number;
  totalViolations: number;
  justifiedCount: number;
  unjustifiedCount: number;
  sectionsAffected: number;
  topSectionAbsences?: string;
}

export interface DailyArchiveResponse {
  success: boolean;
  date: string;
  absences: DailyAbsenceItem[];
  violations: DailyViolationItem[];
  stats: DailyArchiveStats;
  availableDates: string[];
}

// ==========================================
// Teacher Timetable Types (استعمال زمن الأساتذة)
// ==========================================

export type TimetableDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface TimetableSlotDef {
  id: string; // e.g. 'm1', 'm2', 'm3', 'm4' (Morning 08:00-12:00), 'e1', 'e2', 'e3', 'e4' (Evening 14:00-18:00)
  period: 'morning' | 'evening';
  index: number;
  label: string; // e.g. '08:00 - 09:00'
  shortLabel: string; // 'ح1', 'ح2'
  startMinutes: number; // e.g. 8 * 60 = 480
  endMinutes: number; // e.g. 9 * 60 = 540
  startTime: string; // '08:00'
  endTime: string; // '09:00'
}

export interface TeacherTimetableEntry {
  id: string;
  teacherId: string;
  dayOfWeek: TimetableDay;
  slotId: string;
  periodType: 'morning' | 'evening';
  startTime: string;
  endTime: string;
  sectionId: string;
  sectionName?: string;
  room?: string;
  subject?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherTimetableResponse {
  success: boolean;
  teacherId: string;
  entries: TeacherTimetableEntry[];
  message?: string;
}
