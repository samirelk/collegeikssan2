export interface ViolationRecord {
  id: string;
  section_id: string;
  seat_num: number | null;
  student_name: string;
  student_number: string;
  massar_number: string;
  violation_type: string;
  description: string;
  action_taken: string;
  teacher_name: string;
  teacher_subject: string;
  recorded_date: string;
  recorded_time: string;
  created_at: string;
  teacher_id: string;
}

/**
 * Baseline Violations - EMPTIED.
 * Fake synthetic violations are strictly prohibited to prevent unauthorized records appearing in teacher spaces.
 */
export const BASELINE_VIOLATIONS: ViolationRecord[] = [];

