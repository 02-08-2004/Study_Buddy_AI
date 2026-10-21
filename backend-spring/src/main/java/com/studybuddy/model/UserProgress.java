package com.studybuddy.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_progress")
public class UserProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    @JsonProperty("user_id")
    private UUID userId;

    @Column(name = "course_id", nullable = false)
    @JsonProperty("course_id")
    private UUID courseId;

    @Column(name = "weak_topics", columnDefinition = "text[]")
    @JsonProperty("weak_topics")
    private String[] weakTopics;

    @Column(name = "strong_topics", columnDefinition = "text[]")
    @JsonProperty("strong_topics")
    private String[] strongTopics;

    @Column(name = "studied_material_ids", columnDefinition = "uuid[]")
    @JsonProperty("studied_material_ids")
    private UUID[] studiedMaterialIds;

    @Column(name = "total_chat_messages")
    @JsonProperty("total_chat_messages")
    private Integer totalChatMessages = 0;

    @Column(name = "total_quizzes_taken")
    @JsonProperty("total_quizzes_taken")
    private Integer totalQuizzesTaken = 0;

    @Column(name = "average_quiz_score")
    @JsonProperty("average_quiz_score")
    private Double averageQuizScore = 0.0;

    @Column(name = "study_streak_days")
    @JsonProperty("study_streak_days")
    private Integer studyStreakDays = 0;

    @Column(name = "last_studied_at")
    @JsonProperty("last_studied_at")
    private LocalDateTime lastStudiedAt;

    @Column(name = "created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @JsonProperty("updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Transient
    @JsonProperty("course_name")
    private String courseName;

    public UserProgress() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getCourseId() { return courseId; }
    public void setCourseId(UUID courseId) { this.courseId = courseId; }

    public String[] getWeakTopics() { return weakTopics; }
    public void setWeakTopics(String[] weakTopics) { this.weakTopics = weakTopics; }

    public String[] getStrongTopics() { return strongTopics; }
    public void setStrongTopics(String[] strongTopics) { this.strongTopics = strongTopics; }

    public UUID[] getStudiedMaterialIds() { return studiedMaterialIds; }
    public void setStudiedMaterialIds(UUID[] studiedMaterialIds) { this.studiedMaterialIds = studiedMaterialIds; }

    public Integer getTotalChatMessages() { return totalChatMessages; }
    public void setTotalChatMessages(Integer totalChatMessages) { this.totalChatMessages = totalChatMessages; }

    public Integer getTotalQuizzesTaken() { return totalQuizzesTaken; }
    public void setTotalQuizzesTaken(Integer totalQuizzesTaken) { this.totalQuizzesTaken = totalQuizzesTaken; }

    public Double getAverageQuizScore() { return averageQuizScore; }
    public void setAverageQuizScore(Double averageQuizScore) { this.averageQuizScore = averageQuizScore; }

    public Integer getStudyStreakDays() { return studyStreakDays; }
    public void setStudyStreakDays(Integer studyStreakDays) { this.studyStreakDays = studyStreakDays; }

    public LocalDateTime getLastStudiedAt() { return lastStudiedAt; }
    public void setLastStudiedAt(LocalDateTime lastStudiedAt) { this.lastStudiedAt = lastStudiedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }
}
