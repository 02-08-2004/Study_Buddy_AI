package com.studybuddy.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studybuddy.model.*;
import com.studybuddy.repository.MaterialRepository;
import com.studybuddy.repository.QuizResultRepository;
import com.studybuddy.repository.StudySessionRepository;
import com.studybuddy.repository.UserProgressRepository;
import com.studybuddy.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/quiz")
public class QuizController {

    private final StudySessionRepository sessionRepository;
    private final QuizResultRepository quizResultRepository;
    private final MaterialRepository materialRepository;
    private final UserProgressRepository progressRepository;
    private final com.studybuddy.repository.CourseRepository courseRepository;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public QuizController(StudySessionRepository sessionRepository,
                          QuizResultRepository quizResultRepository,
                          MaterialRepository materialRepository,
                          UserProgressRepository progressRepository,
                          com.studybuddy.repository.CourseRepository courseRepository,
                          AiService aiService) {
        this.sessionRepository = sessionRepository;
        this.quizResultRepository = quizResultRepository;
        this.materialRepository = materialRepository;
        this.progressRepository = progressRepository;
        this.courseRepository = courseRepository;
        this.aiService = aiService;
        this.objectMapper = new ObjectMapper();
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generateQuiz(@RequestBody Map<String, Object> body,
                                         @AuthenticationPrincipal User user) {
        try {
            String sessionIdStr = (String) body.get("sessionId");
            if (sessionIdStr == null) {
                return ResponseEntity.status(400).body(Map.of("error", "sessionId is required"));
            }
            UUID sessionId = UUID.fromString(sessionIdStr);
            String topic = (String) body.get("topic");
            int numQuestions = body.containsKey("numQuestions") ? ((Number) body.get("numQuestions")).intValue() : 5;

            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);

            List<UUID> materialIds = session.getSelectedMaterialIds() != null
                    ? Arrays.asList(session.getSelectedMaterialIds())
                    : Collections.emptyList();

            String courseName = null;
            if (session.getCourseId() != null) {
                courseName = courseRepository.findById(session.getCourseId())
                        .map(com.studybuddy.model.Course::getCourseName)
                        .orElse(null);
            }

            Object quiz = aiService.generateQuiz(materialIds, topic, numQuestions, courseName);
            return ResponseEntity.ok(Map.of("quiz", quiz));

        } catch (Exception ex) {
            System.err.println("Quiz generation error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/flashcards")
    public ResponseEntity<?> generateFlashcards(@RequestBody Map<String, Object> body,
                                               @AuthenticationPrincipal User user) {
        try {
            String sessionIdStr = (String) body.get("sessionId");
            if (sessionIdStr == null) {
                return ResponseEntity.status(400).body(Map.of("error", "sessionId is required"));
            }
            UUID sessionId = UUID.fromString(sessionIdStr);
            String topic = (String) body.get("topic");
            int numCards = body.containsKey("numCards") ? ((Number) body.get("numCards")).intValue() : 10;

            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);

            List<UUID> materialIds = session.getSelectedMaterialIds() != null
                    ? Arrays.asList(session.getSelectedMaterialIds())
                    : Collections.emptyList();

            String courseName = null;
            if (session.getCourseId() != null) {
                courseName = courseRepository.findById(session.getCourseId())
                        .map(com.studybuddy.model.Course::getCourseName)
                        .orElse(null);
            }

            Object flashcards = aiService.generateFlashcards(materialIds, topic, numCards, courseName);
            return ResponseEntity.ok(Map.of("flashcards", flashcards));

        } catch (Exception ex) {
            System.err.println("Flashcard generation error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/submit")
    @Transactional
    public ResponseEntity<?> submitQuiz(@RequestBody Map<String, Object> body,
                                       @AuthenticationPrincipal User user) {
        try {
            String sessionIdStr = (String) body.get("sessionId");
            UUID sessionId = UUID.fromString(sessionIdStr);
            Object quizDataObj = body.get("quizData");
            Integer score = body.containsKey("score") ? ((Number) body.get("score")).intValue() : 0;
            Integer totalQuestions = body.containsKey("totalQuestions") ? ((Number) body.get("totalQuestions")).intValue() : 0;
            Integer timeTakenSeconds = body.containsKey("timeTakenSeconds") ? ((Number) body.get("timeTakenSeconds")).intValue() : 0;

            List<?> weakTopicsList = (List<?>) body.get("weakTopics");
            String[] weakTopics = null;
            if (weakTopicsList != null) {
                weakTopics = weakTopicsList.stream().map(Object::toString).toArray(String[]::new);
            }

            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);

            QuizResult result = new QuizResult();
            result.setSessionId(sessionId);
            result.setUserId(user.getId());
            result.setQuizData(objectMapper.writeValueAsString(quizDataObj));
            result.setScore(score);
            result.setTotalQuestions(totalQuestions);
            result.setTimeTakenSeconds(timeTakenSeconds);
            result.setWeakTopics(weakTopics);
            result.setCreatedAt(LocalDateTime.now());
            quizResultRepository.save(result);

            // Update materials study_status
            if (session.getSelectedMaterialIds() != null) {
                for (UUID matId : session.getSelectedMaterialIds()) {
                    materialRepository.findById(matId).ifPresent(m -> {
                        m.setStudyStatus("completed");
                        materialRepository.save(m);
                    });
                }
            }

            // Update user progress
            if (session.getCourseId() != null) {
                Optional<UserProgress> progOpt = progressRepository.findByUserIdAndCourseId(user.getId(), session.getCourseId());
                UserProgress prog = progOpt.orElseGet(() -> {
                    UserProgress p = new UserProgress();
                    p.setUserId(user.getId());
                    p.setCourseId(session.getCourseId());
                    return p;
                });

                int prevQuizzes = prog.getTotalQuizzesTaken() != null ? prog.getTotalQuizzesTaken() : 0;
                double prevAvg = prog.getAverageQuizScore() != null ? prog.getAverageQuizScore() : 0.0;
                double newAvg = ((prevAvg * prevQuizzes) + score) / (prevQuizzes + 1);

                prog.setTotalQuizzesTaken(prevQuizzes + 1);
                prog.setAverageQuizScore(newAvg);
                prog.setLastStudiedAt(LocalDateTime.now());
                prog.setUpdatedAt(LocalDateTime.now());

                if (weakTopics != null && weakTopics.length > 0) {
                    Set<String> set = new HashSet<>(Arrays.asList(weakTopics));
                    if (prog.getWeakTopics() != null) set.addAll(Arrays.asList(prog.getWeakTopics()));
                    prog.setWeakTopics(set.toArray(new String[0]));
                }

                progressRepository.save(prog);
            }

            return ResponseEntity.ok(Map.of("message", "Quiz results saved"));

        } catch (Exception ex) {
            System.err.println("Quiz submit error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
