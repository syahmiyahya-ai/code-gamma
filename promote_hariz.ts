import Database from "better-sqlite3";

const db = new Database("roster.db");

const emailsToPromote = ["harizshahrin@gmail.com"];

try {
  for (const email of emailsToPromote) {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (user) {
      console.log(`Found user: ${user.name} (ID: ${user.id}, Role: ${user.role})`);
      db.prepare("UPDATE users SET role = 'Administrator' WHERE email = ?").run(email);
      console.log(`User ${email} promoted to Administrator successfully!`);
    } else {
      console.log(`User ${email} not found in database.`);
    }
  }
} catch (err) {
  console.error("Error promoting user:", err);
}
