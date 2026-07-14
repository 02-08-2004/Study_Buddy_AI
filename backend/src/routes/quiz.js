const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');
const { generateQuiz, generateFlashcards } = require('../services/openai');

const router = express.Router();

// POST /api/quiz/generate — generate a quiz
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { sessionId, topic, numQuestions = 5 } = req.body;

    const sessionResult = await query(
      'SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { selected_material_ids } = sessionResult.rows[0];
    const quiz = await generateQuiz(selected_material_ids, topic, numQuestions);

    res.json({ quiz });
  } catch (err) {
    console.error('Quiz generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quiz/flashcards — generate flashcards
router.post('/flashcards', authenticate, async (req, res) => {
  try {
    const { sessionId, topic, numCards = 10 } = req.body;

    const sessionResult = await query(
      'SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { selected_material_ids } = sessionResult.rows[0];
    const flashcards = await generateFlashcards(selected_material_ids, topic, numCards);

    res.json({ flashcards });
  } catch (err) {
    console.error('Flashcard generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quiz/submit — submit quiz results
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { sessionId, quizData, score, totalQuestions, timeTakenSeconds, weakTopics } = req.body;

    const sessionResult = await query(
      'SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Save quiz result
    await query(
      `INSERT INTO quiz_results (session_id, user_id, quiz_data, score, total_questions, time_taken_seconds, weak_topics)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, req.user.id, JSON.stringify(quizData), score, totalQuestions, timeTakenSeconds, weakTopics]
    );

    // Update materials to mark as studied
    if (session.selected_material_ids && session.selected_material_ids.length > 0) {
      await query(
        `UPDATE materials 
         SET study_status = 'completed' 
         WHERE id = ANY($1)`,
        [session.selected_material_ids]
      );
    }

    // Update learning profile with weak topics
    if (session.course_id && weakTopics && weakTopics.length > 0) {
      await query(
        `INSERT INTO user_progress (user_id, course_id, weak_topics, total_quizzes_taken, average_quiz_score, last_studied_at)
         VALUES ($1, $2, $3, 1, $4, NOW())
         ON CONFLICT (user_id, course_id)
         DO UPDATE SET
           weak_topics = ARRAY(SELECT DISTINCT unnest(user_progress.weak_topics || EXCLUDED.weak_topics)),
           total_quizzes_taken = user_progress.total_quizzes_taken + 1,
           average_quiz_score = (user_progress.average_quiz_score * user_progress.total_quizzes_taken + $4) / (user_progress.total_quizzes_taken + 1),
           last_studied_at = NOW(),
           updated_at = NOW()`,
        [req.user.id, session.course_id, weakTopics, (score / totalQuestions) * 100]
      );
    }

    res.json({ message: 'Quiz submitted successfully', percentage: Math.round((score / totalQuestions) * 100) });
  } catch (err) {
    console.error('Quiz submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
