const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');

const router = express.Router();

// GET /api/progress — overall user progress summary
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT up.*, c.course_name
       FROM user_progress up
       JOIN courses c ON up.course_id = c.id
       WHERE up.user_id = $1
       ORDER BY up.last_studied_at DESC`,
      [req.user.id]
    );

    const summary = await query(
      `SELECT
         COUNT(DISTINCT ss.id) as total_sessions,
         COUNT(cm.id) as total_messages,
         COUNT(DISTINCT ss.course_id) as courses_studied,
         MAX(ss.updated_at) as last_active
       FROM study_sessions ss
       LEFT JOIN chat_messages cm ON ss.id = cm.session_id
       WHERE ss.user_id = $1`,
      [req.user.id]
    );

    res.json({
      courseProgress: result.rows,
      summary: summary.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/:courseId — progress for specific course
router.get('/:courseId', authenticate, async (req, res) => {
  try {
    const progressResult = await query(
      `SELECT up.*, c.course_name FROM user_progress up
       JOIN courses c ON up.course_id = c.id
       WHERE up.user_id = $1 AND up.course_id = $2`,
      [req.user.id, req.params.courseId]
    );

    const quizHistory = await query(
      `SELECT qr.score, qr.total_questions, qr.weak_topics, qr.created_at
       FROM quiz_results qr
       JOIN study_sessions ss ON qr.session_id = ss.id
       WHERE qr.user_id = $1 AND ss.course_id = $2
       ORDER BY qr.created_at DESC LIMIT 10`,
      [req.user.id, req.params.courseId]
    );

    res.json({
      progress: progressResult.rows[0] || null,
      quizHistory: quizHistory.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/progress/:courseId/topics — manually update weak/strong topics
router.put('/:courseId/topics', authenticate, async (req, res) => {
  try {
    const { weakTopics, strongTopics } = req.body;

    await query(
      `INSERT INTO user_progress (user_id, course_id, weak_topics, strong_topics)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET
         weak_topics = COALESCE($3, user_progress.weak_topics),
         strong_topics = COALESCE($4, user_progress.strong_topics),
         updated_at = NOW()`,
      [req.user.id, req.params.courseId, weakTopics, strongTopics]
    );

    res.json({ message: 'Topics updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
