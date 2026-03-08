/**
 * Utility functions for Code Gamma ACCU Roster Management
 */

export interface ShiftRecord {
  doctorName: string;
  date: string;
  shift_code: string;
  is_code_blue: boolean;
}

/**
 * Generates a daily summary of shifts grouped by shift code.
 * Doctors with 'is_code_blue' set to true are prioritized at the top of their respective groups.
 * 
 * @param shifts - Array of shift records containing doctor names and shift details
 * @param date - The specific date to summarize (YYYY-MM-DD)
 * @returns A record where keys are shift codes and values are arrays of doctor names
 */
export function generateDailySummary(shifts: ShiftRecord[], date: string): Record<string, string[]> {
  // 1. Filter shifts for the specific date
  const dailyShifts = shifts.filter(s => s.date === date);

  // 2. Group by shift_code
  const summary: Record<string, string[]> = {};

  dailyShifts.forEach(shift => {
    if (!summary[shift.shift_code]) {
      summary[shift.shift_code] = [];
    }
    
    // 3. Apply "Crucial Medical Rule": is_code_blue doctors go to index 0
    if (shift.is_code_blue) {
      summary[shift.shift_code].unshift(shift.doctorName);
    } else {
      summary[shift.shift_code].push(shift.doctorName);
    }
  });

  return summary;
}
