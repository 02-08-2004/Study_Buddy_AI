const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');

const router = express.Router();

// POST /api/sessions — create a new study session
router.post('/', authenticate, async (req, res) => {
  try {
    const { courseId, materialIds, sessionTitle } = req.body;

    const result = await query(
      `INSERT INTO study_sessions (user_id, course_id, selected_material_ids, session_title)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, courseId, materialIds, sessionTitle || 'Study Session']
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions — list all sessions for user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT ss.*, c.course_name,
              COUNT(cm.id) as message_count,
              ss.updated_at
       FROM study_sessions ss
       LEFT JOIN courses c ON ss.course_id = c.id
       LEFT JOIN chat_messages cm ON ss.id = cm.session_id
       WHERE ss.user_id = $1
       GROUP BY ss.id, c.course_name
       ORDER BY ss.updated_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:sessionId — get session with messages
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const sessionResult = await query(
      `SELECT ss.*, c.course_name FROM study_sessions ss
       LEFT JOIN courses c ON ss.course_id = c.id
       WHERE ss.id = $1 AND ss.user_id = $2`,
      [req.params.sessionId, req.user.id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messagesResult = await query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.sessionId]
    );

    res.json({
      session: sessionResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:sessionId — update session title or materials
router.put('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionTitle, materialIds } = req.body;

    const result = await query(
      `UPDATE study_sessions
       SET session_title = COALESCE($1, session_title),
           selected_material_ids = COALESCE($2, selected_material_ids),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [sessionTitle, materialIds, req.params.sessionId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:sessionId
router.delete('/:sessionId', authenticate, async (req, res) => {
  try {
    await query(
      'DELETE FROM study_sessions WHERE id = $1 AND user_id = $2',
      [req.params.sessionId, req.user.id]
    );
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
