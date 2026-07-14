require('dotenv').config();
const { pool } = require('../src/utils/db');

const cleanup = async () => {
  const client = await pool.connect();
  try {
    console.log('🧹 Cleaning up duplicate materials...');
    
    // Delete duplicates where drive_file_id and classroom_material_id match within the same course
    await client.query(`
      DELETE FROM materials a 
      USING materials b 
      WHERE a.id < b.id 
      AND a.course_id = b.course_id 
      AND a.drive_file_id = b.drive_file_id 
      AND a.classroom_material_id = b.classroom_material_id
    `);

    // Delete duplicates where file_url matches within the same course
    await client.query(`
      DELETE FROM materials a 
      USING materials b 
      WHERE a.id < b.id 
      AND a.course_id = b.course_id 
      AND a.file_url = b.file_url
      AND a.file_url IS NOT NULL
    `);

    console.log('✅ Duplicates removed. Adding unique constraints...');
    
    await client.query(`
      ALTER TABLE materials 
      ADD CONSTRAINT unique_course_drive_material UNIQUE(course_id, drive_file_id, classroom_material_id)
    `).catch(e => console.log('Constraint drive exists or error:', e.message));

    await client.query(`
      ALTER TABLE materials 
      ADD CONSTRAINT unique_course_url UNIQUE(course_id, file_url)
    `).catch(e => console.log('Constraint url exists or error:', e.message));

    console.log('✨ Database cleanup complete!');
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
};

cleanup();
