package com.studybuddy.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "quiz_results")
public class QuizResult {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "session_id", nullable = false)
    @JsonProperty("session_id")
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    @JsonProperty("user_id")
    private UUID userId;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "quiz_data", nullable = false, columnDefinition = "jsonb")
    @JsonProperty("quiz_data")
    private String quizData;

    private Integer score;

    @Column(name = "total_questions")
    @JsonProperty("total_questions")
    private Integer totalQuestions;

    @Column(name = "time_taken_seconds")
    @JsonProperty("time_taken_seconds")
    private Integer timeTakenSeconds;

    @Column(name = "weak_topics", columnDefinition = "text[]")
    @JsonProperty("weak_topics")
    private String[] weakTopics;

    @Column(name = "created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public QuizResult() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getQuizData() { return quizData; }
    public void setQuizData(String quizData) { this.quizData = quizData; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(Integer totalQuestions) { this.totalQuestions = totalQuestions; }

    public Integer getTimeTakenSeconds() { return timeTakenSeconds; }
    public void setTimeTakenSeconds(Integer timeTakenSeconds) { this.timeTakenSeconds = timeTakenSeconds; }

    public String[] getWeakTopics() { return weakTopics; }
    public void setWeakTopics(String[] weakTopics) { this.weakTopics = weakTopics; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
