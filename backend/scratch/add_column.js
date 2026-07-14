require('dotenv').config();
const { pool } = require('../src/utils/db');

const addColumn = async () => {
  const client = await pool.connect();
  try {
    console.log('🏗️ Adding study_status column to materials...');
    await client.query(`
      ALTER TABLE materials 
      ADD COLUMN IF NOT EXISTS study_status VARCHAR(50) DEFAULT 'pending'
    `);
    console.log('✅ Column added!');
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
};

addColumn();
