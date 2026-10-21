package com.studybuddy.controller;

import com.studybuddy.model.Course;
import com.studybuddy.model.QuizResult;
import com.studybuddy.model.StudySession;
import com.studybuddy.model.User;
import com.studybuddy.model.UserProgress;
import com.studybuddy.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final UserProgressRepository progressRepository;
    private final CourseRepository courseRepository;
    private final StudySessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final QuizResultRepository quizResultRepository;

    public ProgressController(UserProgressRepository progressRepository,
                              CourseRepository courseRepository,
                              StudySessionRepository sessionRepository,
                              ChatMessageRepository messageRepository,
                              QuizResultRepository quizResultRepository) {
        this.progressRepository = progressRepository;
        this.courseRepository = courseRepository;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.quizResultRepository = quizResultRepository;
    }

    @GetMapping
    public ResponseEntity<?> getOverallProgress(@AuthenticationPrincipal User user) {
        try {
            List<UserProgress> progressList = progressRepository.findByUserIdOrderByLastStudiedAtDesc(user.getId());
            for (UserProgress p : progressList) {
                courseRepository.findById(p.getCourseId()).ifPresent(c -> p.setCourseName(c.getCourseName()));
            }

            List<StudySession> sessions = sessionRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
            long totalSessions = sessions.size();
            long totalMessages = 0;
            Set<UUID> coursesStudied = new HashSet<>();
            LocalDateTime lastActive = null;

            for (StudySession s : sessions) {
                totalMessages += messageRepository.countBySessionId(s.getId());
                if (s.getCourseId() != null) coursesStudied.add(s.getCourseId());
                if (lastActive == null || (s.getUpdatedAt() != null && s.getUpdatedAt().isAfter(lastActive))) {
                    lastActive = s.getUpdatedAt();
                }
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("total_sessions", totalSessions);
            summary.put("total_messages", totalMessages);
            summary.put("courses_studied", coursesStudied.size());
            summary.put("last_active", lastActive);

            return ResponseEntity.ok(Map.of(
                    "courseProgress", progressList,
                    "summary", summary
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<?> getCourseProgress(@PathVariable UUID courseId, @AuthenticationPrincipal User user) {
        try {
            Optional<UserProgress> progOpt = progressRepository.findByUserIdAndCourseId(user.getId(), courseId);
            progOpt.ifPresent(p -> courseRepository.findById(p.getCourseId()).ifPresent(c -> p.setCourseName(c.getCourseName())));

            List<QuizResult> allQuizzes = quizResultRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
            List<Map<String, Object>> courseQuizzes = new ArrayList<>();

            for (QuizResult qr : allQuizzes) {
                Optional<StudySession> sess = sessionRepository.findById(qr.getSessionId());
                if (sess.isPresent() && courseId.equals(sess.get().getCourseId())) {
                    Map<String, Object> qMap = new HashMap<>();
                    qMap.put("score", qr.getScore());
                    qMap.put("total_questions", qr.getTotalQuestions());
                    qMap.put("weak_topics", qr.getWeakTopics());
                    qMap.put("created_at", qr.getCreatedAt());
                    courseQuizzes.add(qMap);
                    if (courseQuizzes.size() >= 10) break;
                }
            }

            Map<String, Object> resp = new HashMap<>();
            resp.put("progress", progOpt.orElse(null));
            resp.put("quizHistory", courseQuizzes);
            return ResponseEntity.ok(resp);

        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{courseId}/topics")
    public ResponseEntity<?> updateTopics(@PathVariable UUID courseId,
                                          @RequestBody Map<String, Object> body,
                                          @AuthenticationPrincipal User user) {
        try {
            List<?> weakList = (List<?>) body.get("weakTopics");
            List<?> strongList = (List<?>) body.get("strongTopics");

            String[] weak = weakList != null ? weakList.stream().map(Object::toString).toArray(String[]::new) : null;
            String[] strong = strongList != null ? strongList.stream().map(Object::toString).toArray(String[]::new) : null;

            Optional<UserProgress> progOpt = progressRepository.findByUserIdAndCourseId(user.getId(), courseId);
            UserProgress prog = progOpt.orElseGet(() -> {
                UserProgress p = new UserProgress();
                p.setUserId(user.getId());
                p.setCourseId(courseId);
                return p;
            });

            if (weak != null) prog.setWeakTopics(weak);
            if (strong != null) prog.setStrongTopics(strong);
            prog.setUpdatedAt(LocalDateTime.now());
            progressRepository.save(prog);

            return ResponseEntity.ok(Map.of("message", "Topics updated"));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
