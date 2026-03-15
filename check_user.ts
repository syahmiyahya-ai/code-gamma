import Database from 'better-sqlite3';
const db = new Database('roster.db');

const user = db.prepare("SELECT * FROM users WHERE email = ?").get('harizshahrin@gmail.com');
console.log('User data for harizshahrin@gmail.com:', JSON.stringify(user, null, 2));

const allAdmins = db.prepare("SELECT * FROM users WHERE role = 'Administrator'").all();
console.log('All Administrators:', JSON.stringify(allAdmins, null, 2));
