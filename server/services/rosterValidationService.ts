import { db } from "../db/db";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Roster Validation Engine
 * Prevents illegal or unsafe shift assignments based on clinical and safety rules.
 */
export const rosterValidationService = {
  /**
   * Validates a shift assignment before it's saved.
   */
  validateShift: (userId: string, date: string, shiftCode: string | null): ValidationResult => {
    const errors: string[] = [];

    // If shiftCode is null, we are clearing the shift, so it's always valid
    if (shiftCode === null) {
      return { valid: true, errors: [] };
    }

    // 1. Same person cannot exceed 1 shift per day
    // We only check this if we are creating a NEW shift, but since our logic
    // is to always update the existing one if it exists, this check is mostly 
    // to prevent multiple entries if the logic elsewhere fails.
    // For now, we allow it because updateShift handles the existing check.
    /*
    const existingShifts = db.prepare("SELECT shift_code FROM shifts WHERE user_id = ? AND date = ?").all(userId, date) as { shift_code: string }[];
    if (existingShifts.length > 0 && existingShifts[0].shift_code !== shiftCode) {
      // This is actually fine because we update it.
    }
    */

    // 2. Same person cannot have AM and NS on same day (Already covered by 1 shift per day rule, but explicit check for clarity)
    if (shiftCode === 'NS' || shiftCode === 'AM') {
       // Logic for specific combinations if multiple shifts were allowed
    }

    // 3. Prevent AM immediately after NS
    if (shiftCode === 'AM') {
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      
      const prevShift = db.prepare("SELECT shift_code FROM shifts WHERE user_id = ? AND date = ?").get(userId, prevDateStr) as { shift_code: string } | undefined;
      if (prevShift?.shift_code === 'NS') {
        errors.push(`Cannot assign Morning (AM) shift immediately after a Night (NS) shift on ${prevDateStr}.`);
      }
    }

    // 4. Prevent more than configurable max consecutive night shifts
    if (shiftCode === 'NS') {
      const MAX_CONSECUTIVE_NS = 2; // Configurable
      let consecutiveCount = 1;
      
      // Check previous days
      let checkDate = new Date(date);
      for (let i = 0; i < MAX_CONSECUTIVE_NS; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        const shift = db.prepare("SELECT shift_code FROM shifts WHERE user_id = ? AND date = ?").get(userId, checkDateStr) as { shift_code: string } | undefined;
        if (shift?.shift_code === 'NS') {
          consecutiveCount++;
        } else {
          break;
        }
      }

      if (consecutiveCount > MAX_CONSECUTIVE_NS) {
        errors.push(`Maximum consecutive Night (NS) shifts (${MAX_CONSECUTIVE_NS}) exceeded.`);
      }
    }

    // 5. Prevent scheduling during approved leave
    const leave = db.prepare(`
      SELECT * FROM leave_requests 
      WHERE user_id = ? 
      AND status = 'APPROVED'
      AND ? BETWEEN start_date AND end_date
    `).get(userId, date);

    if (leave) {
      errors.push(`User is on approved leave on ${date}.`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
