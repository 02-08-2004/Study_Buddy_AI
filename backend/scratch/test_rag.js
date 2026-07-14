require('dotenv').config();
const { retrieveRelevantChunks } = require('../src/services/openai');

async function test() {
  const materialIds = ['3e8877cf-0e02-421a-bc8c-c53aaa27fc01'];
  const chunks = await retrieveRelevantChunks('summary', materialIds);
  console.log(`Found ${chunks.length} chunks`);
  chunks.forEach((c, i) => console.log(`Chunk ${i}: ${c.file_name} - ${c.content.substring(0, 50)}...`));
  process.exit(0);
}

test();
