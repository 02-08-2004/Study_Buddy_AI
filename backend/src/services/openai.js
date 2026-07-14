const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { query } = require('../utils/db');

// Initialize providers
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PRIMARY_MODEL = 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-pro-latest';

/**
 * Get a generative model with fallback support
 */
const getModel = (name) => genAI.getGenerativeModel({ model: name });

/**
 * Generate embeddings for a text string
 */
const getEmbedding = async (text) => {
  if (process.env.AI_PROVIDER === 'openai' && openai) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000)
    });
    return response.data[0].embedding;
  } else {
    const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await embedModel.embedContent(text.slice(0, 8000));
    return result.embedding.values;
  }
};

/**
 * Store document chunk with embedding in DB
 */
const storeChunk = async (materialId, chunkIndex, content) => {
  try {
    const embedding = await getEmbedding(content);
    const embeddingStr = `[${embedding.join(',')}]`;

    await query(
      `INSERT INTO document_chunks (material_id, chunk_index, content, embedding, token_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [materialId, chunkIndex, content, embeddingStr, Math.ceil(content.length / 4)]
    );
  } catch (err) {
    console.error('Error storing chunk:', err.message);
  }
};

/**
 * Retrieve relevant chunks for a query from selected materials
 * Uses PostgreSQL full-text search (plainto_tsquery + ts_rank) for ranked results.
 * Falls back to first N chunks by index if no FTS match is found.
 */
const retrieveRelevantChunks = async (queryText, materialIds, topK = 10) => {
  if (!materialIds || materialIds.length === 0) {
    console.log('🔍 RAG: No material IDs provided');
    return [];
  }

  try {
    const placeholders = materialIds.map((_, i) => `$${i + 3}`).join(',');

    // 1. PostgreSQL full-text search — ranked, stemmed, no special config needed
    let result = await query(
      `SELECT dc.content, dc.material_id, m.file_name,
              ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $1)) AS rank
       FROM document_chunks dc
       JOIN materials m ON dc.material_id = m.id
       WHERE dc.material_id IN (${placeholders})
         AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [queryText, topK, ...materialIds]
    );

    console.log(`🔍 RAG: Full-text search for "${queryText}" found ${result.rows.length} chunks`);

    // 2. If no FTS matches, return top chunks from each material (first parts of documents)
    if (result.rows.length === 0) {
      const fallbackPlaceholders = materialIds.map((_, i) => `$${i + 2}`).join(',');
      result = await query(
        `SELECT dc.content, dc.material_id, m.file_name
         FROM document_chunks dc
         JOIN materials m ON dc.material_id = m.id
         WHERE dc.material_id IN (${fallbackPlaceholders})
         ORDER BY dc.chunk_index ASC
         LIMIT $1`,
        [topK, ...materialIds]
      );
      console.log(`🔍 RAG: Fallback search found ${result.rows.length} chunks`);
    }

    return result.rows;
  } catch (err) {
    console.error('🔍 RAG: Search error:', err.message);
    return [];
  }
};

/**
 * Helper to run Gemini with retries for 503/429
 */
const runGemini = async (prompt, chatHistory = [], retries = 5) => {
  const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
  
  for (let i = 0; i < retries; i++) {
    try {
      if (chatHistory.length > 0) {
        const chat = model.startChat({
          history: chatHistory.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }))
        });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
      } else {
        const result = await model.generateContent(prompt);
        return result.response.text();
      }
    } catch (err) {
      const isRetryable = err.message.includes('503') || err.message.includes('429') || err.message.includes('Service Unavailable');
      
      if (isRetryable && i < retries - 1) {
        // Exponential backoff: 2s, 4s, 8s, 16s...
        const waitTime = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        console.log(`⚠️ Gemini busy/rate-limited (Attempt ${i + 1}/${retries}). Retrying in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If we failed all retries with 503, try fallback model once
      if (isRetryable && i === retries - 1) {
        console.log('🔄 All retries failed. Attempting fallback model (gemini-pro-latest)...');
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro-latest' });
          const result = await fallbackModel.generateContent(prompt);
          return result.response.text();
        } catch (fallbackErr) {
          console.error('❌ Fallback model also failed:', fallbackErr.message);
          throw err; // Throw original error if fallback also fails
        }
      }
      
      throw err;
    }
  }
};

/**
 * Generate a chat response using RAG context
 */
const generateChatResponse = async ({
  userMessage,
  chatHistory,
  materialIds,
  learningProfile
}) => {
  const chunks = await retrieveRelevantChunks(userMessage, materialIds);
  const context = chunks.map(c => `[From: ${c.file_name}]\n${c.content}`).join('\n\n---\n\n');

  const weakTopics = learningProfile?.weak_topics || [];
  const systemPrompt = `You are StudyBuddy AI, an expert personalized tutor. You help students understand their course materials deeply.

${context ? `COURSE MATERIALS CONTEXT:\n${context}\n\n` : ''}

STUDENT LEARNING PROFILE:
${weakTopics.length > 0 ? `Weak topics: ${weakTopics.join(', ')}` : 'No weak topics identified yet.'}

INSTRUCTIONS:
1. Answer questions based primarily on the provided course materials
2. Give clear, structured explanations with examples when helpful
3. Use markdown formatting for readability
4. Be encouraging and supportive.`;

  if (process.env.AI_PROVIDER === 'openai' && openai) {
    // OpenAI logic...
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1500
    });

    return { content: response.choices[0].message.content, context_used: chunks.length > 0 };
  } else {
    const content = await runGemini(`${systemPrompt}\n\nUser: ${userMessage}`, chatHistory.slice(-10));
    return { content, context_used: chunks.length > 0 };
  }
};

/**
 * Generate quiz questions from materials
 */
const generateQuiz = async (materialIds, topic, numQuestions = 5) => {
  const chunks = await retrieveRelevantChunks(topic || 'key concepts important topics', materialIds, 10);
  const context = chunks.map(c => c.content).join('\n\n');

  const prompt = `Based on this study material, generate ${numQuestions} multiple choice questions${topic ? ` about "${topic}"` : ''}.

MATERIAL:
${context.slice(0, 10000)}

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct": "A",
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}`;

  let text;
  if (process.env.AI_PROVIDER === 'openai' && openai) {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });
    text = response.choices[0].message.content;
  } else {
    text = await runGemini(prompt);
  }

  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Failed to parse quiz response');
  }
};

/**
 * Generate flashcards from materials
 */
const generateFlashcards = async (materialIds, topic, numCards = 10) => {
  const chunks = await retrieveRelevantChunks(topic || 'definitions concepts terms', materialIds, 8);
  const context = chunks.map(c => c.content).join('\n\n');

  const prompt = `Based on this study material, generate ${numCards} flashcards${topic ? ` about "${topic}"` : ''}.

MATERIAL:
${context.slice(0, 8000)}

Return ONLY valid JSON:
{
  "flashcards": [
    { "term": "Term here", "definition": "Clear definition here" }
  ]
}`;

  let text;
  if (process.env.AI_PROVIDER === 'openai' && openai) {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });
    text = response.choices[0].message.content;
  } else {
    text = await runGemini(prompt);
  }

  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Failed to parse flashcards response');
  }
};

module.exports = {
  getEmbedding,
  storeChunk,
  retrieveRelevantChunks,
  generateChatResponse,
  generateQuiz,
  generateFlashcards
};
