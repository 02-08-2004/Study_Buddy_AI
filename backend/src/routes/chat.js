const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');
const { generateChatResponse } = require('../services/openai');

const router = express.Router();

// POST /api/chat/:sessionId — send a message
router.post('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Verify session belongs to user
    const sessionResult = await query(
      'SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get chat history (last 20 messages)
    const historyResult = await query(
      'SELECT sender, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20',
      [sessionId]
    );
    const chatHistory = historyResult.rows.reverse();

    // Get user's learning profile for this course
    let learningProfile = null;
    if (session.course_id) {
      const profileResult = await query(
        'SELECT * FROM user_progress WHERE user_id = $1 AND course_id = $2',
        [req.user.id, session.course_id]
      );
      learningProfile = profileResult.rows[0] || null;
    }

    // Save user message
    await query(
      'INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // Generate AI response
    const aiResponse = await generateChatResponse({
      userMessage: message,
      chatHistory,
      materialIds: session.selected_material_ids || [],
      learningProfile
    });

    // Save AI message
    const savedMsg = await query(
      'INSERT INTO chat_messages (session_id, sender, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [sessionId, 'assistant', aiResponse.content, JSON.stringify({ context_used: aiResponse.context_used })]
    );

    // Update session timestamp
    await query(
      'UPDATE study_sessions SET updated_at = NOW() WHERE id = $1',
      [sessionId]
    );

    // Update progress stats
    if (session.course_id) {
      await query(
        `INSERT INTO user_progress (user_id, course_id, total_chat_messages, last_studied_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, course_id)
         DO UPDATE SET
           total_chat_messages = user_progress.total_chat_messages + 1,
           last_studied_at = NOW(),
           updated_at = NOW()`,
        [req.user.id, session.course_id]
      );
    }

    res.json({
      message: savedMsg.rows[0],
      contextUsed: aiResponse.context_used
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/:sessionId/messages — get all messages
router.get('/:sessionId/messages', authenticate, async (req, res) => {
  try {
    const sessionCheck = await query(
      'SELECT id FROM study_sessions WHERE id = $1 AND user_id = $2',
      [req.params.sessionId, req.user.id]
    );

    if (!sessionCheck.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = await query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.sessionId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
