package com.studybuddy.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/")
    public ResponseEntity<?> root() {
        return ResponseEntity.ok(Map.of(
                "message", "StudyBuddy AI API (Spring Boot)",
                "status", "online",
                "version", "1.0.0",
                "framework", "Java Spring Boot 3"
        ));
    }

    @GetMapping("/api")
    public ResponseEntity<?> api() {
        return ResponseEntity.ok(Map.of(
                "message", "StudyBuddy AI API Endpoints",
                "endpoints", List.of(
                        "/auth",
                        "/api/courses",
                        "/api/materials",
                        "/api/sessions",
                        "/api/chat",
                        "/api/quiz",
                        "/api/progress"
                )
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "timestamp", Instant.now().toString()
        ));
    }
}
