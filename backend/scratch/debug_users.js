require('dotenv').config();
const { pool } = require('../src/utils/db');

async function debugUsers() {
  try {
    const users = await pool.query('SELECT id, name, email FROM users');
    console.log('--- USERS ---');
    users.rows.forEach(u => console.log(`[${u.id}] ${u.name} (${u.email})`));

    const courses = await pool.query('SELECT user_id, COUNT(*) FROM courses GROUP BY user_id');
    console.log('\n--- COURSES PER USER ---');
    courses.rows.forEach(c => console.log(`User ID ${c.user_id}: ${c.count} courses`));
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit();
  }
}

debugUsers();
