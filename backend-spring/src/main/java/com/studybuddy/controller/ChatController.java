package com.studybuddy.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studybuddy.model.ChatMessage;
import com.studybuddy.model.StudySession;
import com.studybuddy.model.User;
import com.studybuddy.model.UserProgress;
import com.studybuddy.repository.ChatMessageRepository;
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
@RequestMapping("/api/chat")
public class ChatController {

    private final StudySessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final UserProgressRepository progressRepository;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public ChatController(StudySessionRepository sessionRepository,
                          ChatMessageRepository messageRepository,
                          UserProgressRepository progressRepository,
                          AiService aiService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.progressRepository = progressRepository;
        this.aiService = aiService;
        this.objectMapper = new ObjectMapper();
    }

    @PostMapping("/{sessionId}")
    @Transactional
    public ResponseEntity<?> sendMessage(@PathVariable UUID sessionId,
                                        @RequestBody Map<String, String> body,
                                        @AuthenticationPrincipal User user) {
        try {
            String message = body.get("message");
            if (message == null || message.trim().isEmpty()) {
                return ResponseEntity.status(400).body(Map.of("error", "Message is required"));
            }

            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            StudySession session = sessOpt.get();

            List<ChatMessage> history = messageRepository.findTop20BySessionIdOrderByCreatedAtDesc(sessionId);
            Collections.reverse(history);

            List<Map<String, String>> chatHistoryList = new ArrayList<>();
            for (ChatMessage m : history) {
                chatHistoryList.add(Map.of("sender", m.getSender(), "content", m.getContent()));
            }

            UserProgress profile = null;
            if (session.getCourseId() != null) {
                profile = progressRepository.findByUserIdAndCourseId(user.getId(), session.getCourseId()).orElse(null);
            }

            ChatMessage userMsg = new ChatMessage();
            userMsg.setSessionId(sessionId);
            userMsg.setSender("user");
            userMsg.setContent(message);
            userMsg.setCreatedAt(LocalDateTime.now());
            messageRepository.save(userMsg);

            List<UUID> materialIds = session.getSelectedMaterialIds() != null
                    ? Arrays.asList(session.getSelectedMaterialIds())
                    : Collections.emptyList();

            Map<String, Object> aiResponse = aiService.generateChatResponse(message, chatHistoryList, materialIds, profile);
            String aiContent = (String) aiResponse.get("content");
            boolean contextUsed = (boolean) aiResponse.get("context_used");

            ChatMessage assistantMsg = new ChatMessage();
            assistantMsg.setSessionId(sessionId);
            assistantMsg.setSender("assistant");
            assistantMsg.setContent(aiContent);
            assistantMsg.setMetadata(objectMapper.writeValueAsString(Map.of("context_used", contextUsed)));
            assistantMsg.setCreatedAt(LocalDateTime.now());
            ChatMessage savedAiMsg = messageRepository.save(assistantMsg);

            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);

            if (session.getCourseId() != null) {
                Optional<UserProgress> progOpt = progressRepository.findByUserIdAndCourseId(user.getId(), session.getCourseId());
                UserProgress prog = progOpt.orElseGet(() -> {
                    UserProgress p = new UserProgress();
                    p.setUserId(user.getId());
                    p.setCourseId(session.getCourseId());
                    return p;
                });
                prog.setTotalChatMessages((prog.getTotalChatMessages() != null ? prog.getTotalChatMessages() : 0) + 1);
                prog.setLastStudiedAt(LocalDateTime.now());
                prog.setUpdatedAt(LocalDateTime.now());
                progressRepository.save(prog);
            }

            return ResponseEntity.ok(Map.of(
                    "message", savedAiMsg,
                    "contextUsed", contextUsed
            ));

        } catch (Exception ex) {
            System.err.println("Chat error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<?> getMessages(@PathVariable UUID sessionId, @AuthenticationPrincipal User user) {
        try {
            Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
            if (sessOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            List<ChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
            return ResponseEntity.ok(Map.of("messages", messages));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
