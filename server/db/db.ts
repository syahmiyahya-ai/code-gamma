import Database from "better-sqlite3";

let db: any;
try {
  db = new Database("roster.db");
  console.log('[SERVER] Database connection established');
} catch (err) {
  console.error('[SERVER] Failed to connect to database:', err);
  process.exit(1);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_state TEXT,
    after_state TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    avatar_url TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT
  );

  CREATE TABLE IF NOT EXISTS shift_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    description TEXT,
    background_color TEXT NOT NULL,
    text_color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    shift_code TEXT NOT NULL,
    is_code_blue INTEGER DEFAULT 0,
    UNIQUE(user_id, date),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(shift_code) REFERENCES shift_types(code)
  );

  CREATE TABLE IF NOT EXISTS shift_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- SYSTEM, LEAVE_UPDATE, SWAP_REQUEST, DIRECT_MESSAGE
    related_entity_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS owed_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- PN, HKO
    reason TEXT,
    date_earned TEXT NOT NULL,
    date_redeemed TEXT,
    status TEXT DEFAULT 'OWED', -- OWED, REDEEMED
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    created_by TEXT NOT NULL,
    is_edited INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, COMPLETED
    completed_at DATETIME,
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shift_swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id TEXT NOT NULL,
    requester_shift_id INTEGER NOT NULL,
    target_user_id TEXT, -- Null means it's an open giveaway
    target_shift_id INTEGER, -- Optional, if null it's a giveaway
    status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, APPROVED, REJECTED, CANCELLED
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(requester_id) REFERENCES users(id),
    FOREIGN KEY(requester_shift_id) REFERENCES shifts(id),
    FOREIGN KEY(target_user_id) REFERENCES users(id),
    FOREIGN KEY(target_shift_id) REFERENCES shifts(id)
  );
`);

// Migration: Add avatar_url to users if it doesn't exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
} catch (e) {
  // Column might already exist
}

// Migration: Add is_edited and is_deleted to tasks if they don't exist
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN is_edited INTEGER DEFAULT 0").run();
} catch (e) {
  // Column might already exist
}
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN is_deleted INTEGER DEFAULT 0").run();
} catch (e) {
  // Column might already exist
}

// Migration: Add indexes to shifts if they don't exist
try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts (user_id, date)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (date)").run();
} catch (e) {
  // Indexes might already exist
}

// Migration: Update shift type colors
const newColors: Record<string, { bg: string, text: string }> = {
  "EP": { bg: "#93c47d", text: "#000000" },
  "AM": { bg: "#93c47d", text: "#000000" },
  "PM": { bg: "#ffd966", text: "#000000" },
  "NS": { bg: "#6fa8dc", text: "#000000" },
  "PN": { bg: "#8e7cc3", text: "#ffffff" },
  "FL": { bg: "#a4c2f4", text: "#000000" },
  "WP": { bg: "#ffffff", text: "#000000" },
  "HK1": { bg: "#3c78d8", text: "#ffffff" },
  "HK2": { bg: "#3c78d8", text: "#ffffff" },
  "HK3": { bg: "#3c78d8", text: "#ffffff" },
  "HK4": { bg: "#3c78d8", text: "#ffffff" },
  "HK5": { bg: "#3c78d8", text: "#ffffff" },
  "HK": { bg: "#3c78d8", text: "#ffffff" },
  "HKA": { bg: "#e6b8af", text: "#000000" },
  "HKO": { bg: "#c27ba0", text: "#ffffff" },
  "CR": { bg: "#b6d7a8", text: "#000000" },
  "EL": { bg: "#ea9999", text: "#000000" },
  "MC": { bg: "#e06666", text: "#ffffff" }
};

Object.entries(newColors).forEach(([code, colors]) => {
  db.prepare("UPDATE shift_types SET background_color = ?, text_color = ? WHERE code = ?")
    .run(colors.bg, colors.text, code);
});

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const insertUser = db.prepare("INSERT INTO users (id, name, role, phone_number, email) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("1", "Dr. Ahmad", "Admin", "60123456789", "ahmad@hospital.com");
  insertUser.run("2", "Dr. Siti", "Staff", "60123456790", "siti@hospital.com");
  insertUser.run("3", "Dr. Wong", "Staff", "60123456791", "wong@hospital.com");
  insertUser.run("4", "Dr. Kavita", "Staff", "60123456792", "kavita@hospital.com");
  insertUser.run("5", "Dr. Zulkifli", "Staff", "60123456793", "zulkifli@hospital.com");

  const insertShiftType = db.prepare("INSERT INTO shift_types (code, name, start_time, end_time, description, background_color, text_color) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertShiftType.run("EP", "EP Incharge", "08:00", "17:00", "Emergency Physician Incharge", "#93c47d", "#000000");
  insertShiftType.run("AM", "Morning", "08:00", "15:00", "Morning Shift", "#93c47d", "#000000");
  insertShiftType.run("PM", "Afternoon", "15:00", "22:00", "Afternoon Shift", "#ffd966", "#000000");
  insertShiftType.run("NS", "Night", "22:00", "08:00", "Night Shift (2 days back-to-back)", "#6fa8dc", "#000000");
  insertShiftType.run("PN", "Postnight Rest", null, null, "Rest day after 2 consecutive NS", "#8e7cc3", "#ffffff");
  insertShiftType.run("FL", "Flexi", "11:00", "18:00", "Flexi Shift", "#a4c2f4", "#000000");
  insertShiftType.run("WP", "Office hour", "08:00", "17:00", "Standard Office Hours", "#ffffff", "#000000");
  insertShiftType.run("HK1", "Offday (Wk 1)", null, null, "Obligatory weekly offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HK2", "Offday (Wk 2)", null, null, "Obligatory weekly offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HK3", "Offday (Wk 3)", null, null, "Obligatory weekly offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HK4", "Offday (Wk 4)", null, null, "Obligatory weekly offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HK5", "Offday (Wk 5)", null, null, "Obligatory weekly offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HK", "Offday", null, null, "Offday", "#3c78d8", "#ffffff");
  insertShiftType.run("HKA", "Public Holiday", null, null, "Public Holiday Off Duty", "#e6b8af", "#000000");
  insertShiftType.run("HKO", "Owed Offduty", null, null, "Offduty owed to staff", "#c27ba0", "#ffffff");
  insertShiftType.run("CR", "Cuti Rehat", null, null, "Annual Leave", "#b6d7a8", "#000000");
  insertShiftType.run("EL", "Emergency Leave", null, null, "Unplanned Offduty", "#ea9999", "#000000");
  insertShiftType.run("MC", "Medical Leave", null, null, "Medical Leave", "#e06666", "#ffffff");

  const insertAnnouncement = db.prepare("INSERT INTO announcements (title, content, author_id, is_pinned) VALUES (?, ?, ?, ?)");
  insertAnnouncement.run("Welcome to the New Roster System", "We have successfully launched our new staff roster management system. Please check your shifts and report any discrepancies to the Admin.", "1", 1);
  insertAnnouncement.run("Code Blue Protocol Update", "Please review the updated Code Blue response protocol in the guidelines section. All staff on AM and PM shifts must be familiar with the new assembly points.", "1", 0);

  const insertDocument = db.prepare("INSERT INTO documents (title, category, file_url, uploaded_by) VALUES (?, ?, ?, ?)");
  insertDocument.run("Hospital SOP 2026", "SOP", "https://example.com/sop.pdf", "1");
  insertDocument.run("Leave Application Form", "Forms", "https://example.com/form.pdf", "1");
  insertDocument.run("Clinical Guidelines v2", "Guidelines", "https://example.com/guidelines.pdf", "1");

  const insertNotification = db.prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?, ?)");
  insertNotification.run(Math.random().toString(36).substring(7), "1", "System Update", "The roster system has been updated to v2.1.", "SYSTEM", 0);
  insertNotification.run(Math.random().toString(36).substring(7), "2", "Shift Swap Request", "Dr. Wong wants to swap their NS shift on March 20th with your AM shift.", "SWAP_REQUEST", 0);

  const insertShift = db.prepare("INSERT INTO shifts (user_id, date, shift_code) VALUES (?, ?, ?)");
  insertShift.run("1", "2026-03-04", "EP");
  insertShift.run("2", "2026-03-04", "AM");
  insertShift.run("3", "2026-03-04", "AM");
  insertShift.run("4", "2026-03-04", "PM");
  insertShift.run("5", "2026-03-04", "NS");
  insertShift.run("1", "2026-03-16", "EP");
  insertShift.run("2", "2026-03-16", "AM");
  insertShift.run("3", "2026-03-16", "AM");
  insertShift.run("4", "2026-03-16", "PM");
  insertShift.run("5", "2026-03-16", "NS");
}

export { db };

export function run(query: string, params: any[] = []) {
  return db.prepare(query).run(...params);
}

export function get(query: string, params: any[] = []) {
  return db.prepare(query).get(...params);
}

export function all(query: string, params: any[] = []) {
  return db.prepare(query).all(...params);
}

export default db;
