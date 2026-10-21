package com.studybuddy.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "courses")
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    @JsonProperty("user_id")
    private UUID userId;

    @Column(name = "classroom_course_id", nullable = false)
    @JsonProperty("classroom_course_id")
    private String classroomCourseId;

    @Column(name = "course_name", nullable = false)
    @JsonProperty("course_name")
    private String courseName;

    @Column(name = "course_code")
    @JsonProperty("course_code")
    private String courseCode;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "teacher_name")
    @JsonProperty("teacher_name")
    private String teacherName;

    private String section;

    @Column(name = "source_type")
    @JsonProperty("source_type")
    private String sourceType = "google_classroom";

    @Column(name = "teacher_folder_id")
    @JsonProperty("teacher_folder_id")
    private String teacherFolderId;

    @Column(name = "created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Course() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getClassroomCourseId() { return classroomCourseId; }
    public void setClassroomCourseId(String classroomCourseId) { this.classroomCourseId = classroomCourseId; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public String getCourseCode() { return courseCode; }
    public void setCourseCode(String courseCode) { this.courseCode = courseCode; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getTeacherFolderId() { return teacherFolderId; }
    public void setTeacherFolderId(String teacherFolderId) { this.teacherFolderId = teacherFolderId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
