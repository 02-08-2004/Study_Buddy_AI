package com.studybuddy.controller;

import com.studybuddy.model.ChatMessage;
import com.studybuddy.model.StudySession;
import com.studybuddy.model.User;
import com.studybuddy.repository.ChatMessageRepository;
import com.studybuddy.repository.CourseRepository;
import com.studybuddy.repository.StudySessionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final StudySessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final CourseRepository courseRepository;

    public SessionController(StudySessionRepository sessionRepository,
                             ChatMessageRepository messageRepository,
                             CourseRepository courseRepository) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.courseRepository = courseRepository;
    }

    @PostMapping
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> body,
                                           @AuthenticationPrincipal User user) {
        try {
            String courseIdStr = (String) body.get("courseId");
            UUID courseId = courseIdStr != null ? UUID.fromString(courseIdStr) : null;
            String title = (String) body.getOrDefault("sessionTitle", "Study Session");

            List<?> materialIdsList = (List<?>) body.get("materialIds");
            UUID[] materialIds = null;
            if (materialIdsList != null) {
                materialIds = materialIdsList.stream()
                        .map(id -> UUID.fromString(id.toString()))
                        .toArray(UUID[]::new);
            }

            StudySession session = new StudySession();
            session.setUserId(user.getId());
            session.setCourseId(courseId);
            session.setSelectedMaterialIds(materialIds);
            session.setSessionTitle(title);
            session.setIsActive(true);
            session.setCreatedAt(LocalDateTime.now());
            session.setUpdatedAt(LocalDateTime.now());

            StudySession saved = sessionRepository.save(session);
            return ResponseEntity.status(201).body(Map.of("session", saved));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getSessions(@AuthenticationPrincipal User user) {
        try {
            List<StudySession> sessions = sessionRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
            for (StudySession s : sessions) {
                if (s.getCourseId() != null) {
                    courseRepository.findById(s.getCourseId()).ifPresent(c -> s.setCourseName(c.getCourseName()));
                }
                long count = messageRepository.countBySessionId(s.getId());
                s.setMessageCount(count);
            }
            return ResponseEntity.ok(Map.of("sessions", sessions));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable UUID sessionId, @AuthenticationPrincipal User user) {
        try {
            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);

            if (session.getCourseId() != null) {
                courseRepository.findById(session.getCourseId()).ifPresent(c -> session.setCourseName(c.getCourseName()));
            }

            List<ChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
            return ResponseEntity.ok(Map.of("session", session, "messages", messages));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{sessionId}")
    public ResponseEntity<?> updateSession(@PathVariable UUID sessionId,
                                           @RequestBody Map<String, Object> body,
                                           @AuthenticationPrincipal User user) {
        try {
            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();
            if (body.containsKey("sessionTitle")) {
                session.setSessionTitle((String) body.get("sessionTitle"));
            }
            if (body.containsKey("materialIds")) {
                List<?> list = (List<?>) body.get("materialIds");
                if (list != null) {
                    UUID[] ids = list.stream().map(id -> UUID.fromString(id.toString())).toArray(UUID[]::new);
                    session.setSelectedMaterialIds(ids);
                }
            }
            session.setUpdatedAt(LocalDateTime.now());
            StudySession updated = sessionRepository.save(session);
            return ResponseEntity.ok(Map.of("session", updated));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<?> deleteSession(@PathVariable UUID sessionId, @AuthenticationPrincipal User user) {
        try {
            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }
            sessionRepository.delete(sessOpt.get());
            return ResponseEntity.ok(Map.of("message", "Session deleted"));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
