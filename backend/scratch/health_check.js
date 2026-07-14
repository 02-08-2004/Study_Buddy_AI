require('dotenv').config();
const { pool } = require('../src/utils/db');

async function check() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM courses');
    console.log(`✅ DB is UP. Course count: ${res.rows[0].count}`);
  } catch (err) {
    console.error(`❌ DB is DOWN: ${err.message}`);
  } finally {
    process.exit();
  }
}

check();
