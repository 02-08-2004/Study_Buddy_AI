package com.studybuddy.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "materials")
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    @JsonProperty("course_id")
    private UUID courseId;

    @Column(name = "file_name", nullable = false)
    @JsonProperty("file_name")
    private String fileName;

    @Column(name = "file_type")
    @JsonProperty("file_type")
    private String fileType;

    @Column(name = "drive_file_id")
    @JsonProperty("drive_file_id")
    private String driveFileId;

    @Column(name = "classroom_material_id")
    @JsonProperty("classroom_material_id")
    private String classroomMaterialId;

    @Column(name = "file_url", columnDefinition = "TEXT")
    @JsonProperty("file_url")
    private String fileUrl;

    @Column(name = "extracted_text", columnDefinition = "TEXT")
    @JsonProperty("extracted_text")
    private String extractedText;

    @Column(name = "extraction_status")
    @JsonProperty("extraction_status")
    private String extractionStatus = "pending";

    @Column(name = "study_status")
    @JsonProperty("study_status")
    private String studyStatus = "pending";

    @Column(name = "file_size_bytes")
    @JsonProperty("file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Material() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCourseId() { return courseId; }
    public void setCourseId(UUID courseId) { this.courseId = courseId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public String getDriveFileId() { return driveFileId; }
    public void setDriveFileId(String driveFileId) { this.driveFileId = driveFileId; }

    public String getClassroomMaterialId() { return classroomMaterialId; }
    public void setClassroomMaterialId(String classroomMaterialId) { this.classroomMaterialId = classroomMaterialId; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getExtractedText() { return extractedText; }
    public void setExtractedText(String extractedText) { this.extractedText = extractedText; }

    public String getExtractionStatus() { return extractionStatus; }
    public void setExtractionStatus(String extractionStatus) { this.extractionStatus = extractionStatus; }

    public String getStudyStatus() { return studyStatus; }
    public void setStudyStatus(String studyStatus) { this.studyStatus = studyStatus; }

    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
