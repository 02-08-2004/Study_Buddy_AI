require('dotenv').config();
const { pool } = require('../src/utils/db');

async function check() {
  try {
    const matResult = await pool.query('SELECT * FROM materials ORDER BY created_at DESC LIMIT 1');
    if (!matResult.rows.length) {
      console.log('No materials found');
      process.exit(0);
    }
    
    const material = matResult.rows[0];
    console.log('--- Material ---');
    console.log(JSON.stringify(material, null, 2));
    
    const chunkCount = await pool.query('SELECT COUNT(*) FROM document_chunks WHERE material_id = $1', [material.id]);
    console.log(`\nChunks found: ${chunkCount.rows[0].count}`);
    
    const sampleChunks = await pool.query('SELECT content FROM document_chunks WHERE material_id = $1 LIMIT 2', [material.id]);
    console.log('\n--- Sample Chunks ---');
    sampleChunks.rows.forEach((c, i) => console.log(`Chunk ${i}: ${c.content.substring(0, 100)}...`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
