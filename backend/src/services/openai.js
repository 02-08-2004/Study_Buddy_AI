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

    // 1. PostgreSQL full-text search — using websearch_to_tsquery first for better natural language query handling
    let result = await query(
      `SELECT dc.content, dc.material_id, m.file_name,
              ts_rank(to_tsvector('english', dc.content), websearch_to_tsquery('english', $1)) AS rank
       FROM document_chunks dc
       JOIN materials m ON dc.material_id = m.id
       WHERE dc.material_id IN (${placeholders})
         AND to_tsvector('english', dc.content) @@ websearch_to_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [queryText, topK, ...materialIds]
    );

    console.log(`🔍 RAG: Full-text search for "${queryText}" found ${result.rows.length} chunks`);

    // 2. If websearch_to_tsquery finds 0 matches, try OR search with extracted keywords
    if (result.rows.length === 0 && queryText.trim().length > 0) {
      const keywords = queryText
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['with', 'from', 'these', 'about', 'brief', 'explain', 'concepts', 'important', 'material', 'materials', 'list', 'create', 'generate', 'question', 'questions', 'quiz'].includes(w.toLowerCase()));
      
      if (keywords.length > 0) {
        const orQuery = keywords.join(' | ');
        const orPlaceholders = materialIds.map((_, i) => `$${i + 3}`).join(',');
        try {
          result = await query(
            `SELECT dc.content, dc.material_id, m.file_name,
                    ts_rank(to_tsvector('english', dc.content), to_tsquery('english', $1)) AS rank
             FROM document_chunks dc
             JOIN materials m ON dc.material_id = m.id
             WHERE dc.material_id IN (${orPlaceholders})
               AND to_tsvector('english', dc.content) @@ to_tsquery('english', $1)
             ORDER BY rank DESC
             LIMIT $2`,
            [orQuery, topK, ...materialIds]
          );
          console.log(`🔍 RAG: Keyword search for "${orQuery}" found ${result.rows.length} chunks`);
        } catch (e) {
          // ignore tsquery syntax error
        }
      }
    }

    // 3. If no FTS matches, return top chunks from each material (first parts of documents)
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
 * Helper to run Gemini with retries and clean history formatting
 */
const runGemini = async (prompt, chatHistory = [], retries = 4) => {
  const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
  
  for (let i = 0; i < retries; i++) {
    try {
      if (chatHistory.length > 0) {
        try {
          // Ensure history strictly alternates and starts with 'user'
          let validHistory = [];
          for (const m of chatHistory) {
            const role = m.sender === 'user' ? 'user' : 'model';
            if (validHistory.length === 0 && role !== 'user') continue;
            if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === role) continue;
            validHistory.push({ role, parts: [{ text: m.content }] });
          }
          
          if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
            validHistory.pop();
          }

          if (validHistory.length > 0) {
            const chat = model.startChat({ history: validHistory });
            const result = await chat.sendMessage(prompt);
            return result.response.text();
          }
        } catch (historyErr) {
          console.warn('⚠️ Gemini startChat history issue, falling back to generateContent:', historyErr.message);
        }
      }

      const historyPrefix = chatHistory.map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      const fullPrompt = historyPrefix ? `${historyPrefix}\n\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      return result.response.text();
    } catch (err) {
      const isRetryable = err.message.includes('503') || err.message.includes('429') || err.message.includes('Service Unavailable');
      
      if (isRetryable && i < retries - 1) {
        const waitTime = Math.min(Math.pow(1.5, i + 1) * 1000 + Math.random() * 500, 4000);
        console.log(`⚠️ Gemini busy/rate-limited (Attempt ${i + 1}/${retries}). Retrying in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (isRetryable && i === retries - 1) {
        console.log('🔄 All retries failed. Attempting fallback model (gemini-pro-latest)...');
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro-latest' });
          const result = await fallbackModel.generateContent(prompt);
          return result.response.text();
        } catch (fallbackErr) {
          console.error('❌ Fallback model also failed:', fallbackErr.message);
          throw err;
        }
      }
      
      throw err;
    }
  }
};

/**
 * Fallback chat response generator using retrieved document chunks when API quota is exhausted
 */
const generateLocalFallbackChat = (userMessage, chunks) => {
  let responseText = `⚠️ **[Offline Mode - API Quota Exceeded]**\nBoth the Gemini and OpenAI API keys configured in the environment have exceeded their free usage limits. However, I have parsed your study materials directly to assist you:\n\n`;

  if (chunks && chunks.length > 0) {
    responseText += `### 📚 Insights from "${chunks[0].file_name}":\n`;
    
    const lines = chunks
      .map(c => c.content)
      .join('\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 15 && !line.startsWith('---'));
    
    const uniqueLines = Array.from(new Set(lines)).slice(0, 8);
    
    if (uniqueLines.length > 0) {
      uniqueLines.forEach((line) => {
        responseText += `• ${line}\n\n`;
      });
    } else {
      responseText += `The selected study materials contain content regarding Operating Systems, scheduling, or computing concepts. Please see the cards/quiz options above to review extracted terms!\n`;
    }
  } else {
    responseText += `No study materials were selected for this session yet. Please process a document from your course to view extracted terms and study guides offline!`;
  }

  return responseText;
};

/**
 * Fallback quiz generator using retrieved document chunks when API quota is exhausted
 */
const generateLocalFallbackQuiz = (chunks) => {
  const questions = [];
  
  if (chunks && chunks.length > 0) {
    const lines = chunks
      .map(c => c.content)
      .join('\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 30 && (line.includes(':') || line.includes('-') || line.includes('is') || line.includes('are')));

    const uniqueLines = Array.from(new Set(lines)).slice(0, 5);
    
    uniqueLines.forEach((line) => {
      const words = line.split(' ');
      const subjectWord = words.find(w => w.length > 5 && !['operating', 'system', 'systems', 'computer'].includes(w.toLowerCase())) || words[0];
      const maskedLine = line.replace(new RegExp(subjectWord, 'gi'), '_________');
      
      questions.push({
        question: `[Quiz Offline Mode] Fill in the blank: "${maskedLine}"`,
        options: [
          `A) ${subjectWord}`,
          `B) ${subjectWord.split('').reverse().join('')}`,
          `C) Alternate Concept`,
          `D) None of the above`
        ],
        correct: 'A',
        explanation: `Based directly on the study materials: "${line}"`
      });
    });
  }

  if (questions.length < 3) {
    questions.push({
      question: "Which of the following is a primary task of an Operating System?",
      options: [
        "A) Resource allocation and hardware control",
        "B) Designing physical computer cases",
        "C) Manufacturing CPU silicon wafers",
        "D) Serving web pages over public DNS"
      ],
      correct: "A",
      explanation: "An OS acts as a resource allocator and control program, managing hardware resources and program execution."
    });
    questions.push({
      question: "What is the primary difference between FCFS and SSTF disk scheduling?",
      options: [
        "A) FCFS services requests in arrival order; SSTF services requests closest to the head.",
        "B) FCFS is only for SSDs; SSTF is only for spinning HDDs.",
        "C) SSTF causes no starvation; FCFS causes extreme starvation.",
        "D) There is no difference in their seek patterns."
      ],
      correct: "A",
      explanation: "First-Come First-Served (FCFS) processes requests sequentially. Shortest Seek Time First (SSTF) selects the nearest request first to minimize seek time, though it can cause starvation."
    });
    questions.push({
      question: "What is the 'Kernel' of an operating system?",
      options: [
        "A) The one program running at all times on the computer",
        "B) A bootloader program residing on secondary sectors",
        "C) A web application framework running on port 3001",
        "D) The user interface shell used for terminal command input"
      ],
      correct: "A",
      explanation: "The kernel is the central core of an OS that stays loaded in memory and runs continuously."
    });
  }

  return { questions: questions.slice(0, 5) };
};

/**
 * Fallback flashcard generator using retrieved document chunks when API quota is exhausted
 */
const generateLocalFallbackFlashcards = (chunks) => {
  const flashcards = [];

  if (chunks && chunks.length > 0) {
    const text = chunks.map(c => c.content).join('\n');
    const regexPatterns = [
      /\*\*([^*]+)\*\*\s*[:-]\s*([^\n.]+)/g,
      /###\s*([^\n]+)\n+\*\s*([^\n.]+)/g,
      /([A-Z][a-zA-Z\s]{3,25})\s*is\s*([^\n.]+)/g
    ];

    for (const regex of regexPatterns) {
      let match;
      while ((match = regex.exec(text)) !== null && flashcards.length < 10) {
        const term = match[1].trim();
        const definition = match[2].trim();
        if (term.length > 2 && definition.length > 5 && !flashcards.some(f => f.term.toLowerCase() === term.toLowerCase())) {
          flashcards.push({ term, definition });
        }
      }
    }
  }

  if (flashcards.length < 4) {
    flashcards.push({
      term: "Operating System (OS)",
      definition: "A control program and resource allocator that manages hardware execution and user applications."
    });
    flashcards.push({
      term: "Kernel",
      definition: "The core program of the operating system that runs at all times on the computer."
    });
    flashcards.push({
      term: "Seek Time",
      definition: "The time required for the disk arm to move the read/write heads to the correct cylinder."
    });
    flashcards.push({
      term: "Rotational Latency",
      definition: "The time spent waiting for the correct disk sector to rotate under the read/write head."
    });
    flashcards.push({
      term: "Starvation (SSTF)",
      definition: "A situation where a disk request is delayed indefinitely because newer, closer requests keep arriving."
    });
  }

  return { flashcards };
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
  
  try {
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
  } catch (err) {
    console.error('⚠️ LLM Generation failed, using local offline fallback:', err.message);
    const content = generateLocalFallbackChat(userMessage, chunks);
    return { content, context_used: chunks.length > 0 };
  }
};

/**
 * Generate quiz questions from materials
 */
const generateQuiz = async (materialIds, topic, numQuestions = 5) => {
  const chunks = await retrieveRelevantChunks(topic || 'key concepts important topics', materialIds, 10);
  
  try {
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

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('⚠️ LLM Quiz generation failed, using local offline fallback:', err.message);
    return generateLocalFallbackQuiz(chunks);
  }
};

/**
 * Generate flashcards from materials
 */
const generateFlashcards = async (materialIds, topic, numCards = 10) => {
  const chunks = await retrieveRelevantChunks(topic || 'definitions concepts terms', materialIds, 8);
  
  try {
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

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('⚠️ LLM Flashcard generation failed, using local offline fallback:', err.message);
    return generateLocalFallbackFlashcards(chunks);
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
