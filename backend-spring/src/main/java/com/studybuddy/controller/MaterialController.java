package com.studybuddy.controller;

import com.studybuddy.model.Course;
import com.studybuddy.model.Material;
import com.studybuddy.model.StudySession;
import com.studybuddy.model.User;
import com.studybuddy.repository.CourseRepository;
import com.studybuddy.repository.DocumentChunkRepository;
import com.studybuddy.repository.MaterialRepository;
import com.studybuddy.repository.StudySessionRepository;
import com.studybuddy.service.AiService;
import com.studybuddy.service.DocumentParserService;
import com.studybuddy.service.GoogleClassroomService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api/materials")
public class MaterialController {

    private final MaterialRepository materialRepository;
    private final CourseRepository courseRepository;
    private final StudySessionRepository sessionRepository;
    private final DocumentChunkRepository chunkRepository;
    private final GoogleClassroomService classroomService;
    private final DocumentParserService documentParserService;
    private final AiService aiService;

    public MaterialController(MaterialRepository materialRepository,
                              CourseRepository courseRepository,
                              StudySessionRepository sessionRepository,
                              DocumentChunkRepository chunkRepository,
                              GoogleClassroomService classroomService,
                              DocumentParserService documentParserService,
                              AiService aiService) {
        this.materialRepository = materialRepository;
        this.courseRepository = courseRepository;
        this.sessionRepository = sessionRepository;
        this.chunkRepository = chunkRepository;
        this.classroomService = classroomService;
        this.documentParserService = documentParserService;
        this.aiService = aiService;
    }

    @PostMapping("/{materialId}/process")
    @Transactional
    public ResponseEntity<?> processMaterial(@PathVariable UUID materialId, @AuthenticationPrincipal User user) {
        try {
            Optional<Material> matOpt = materialRepository.findById(materialId);
            if (matOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Material not found"));
            }

            Material material = matOpt.get();
            Optional<Course> courseOpt = courseRepository.findByIdAndUserId(material.getCourseId(), user.getId());
            if (courseOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Material not found"));
            }

            if ("completed".equalsIgnoreCase(material.getExtractionStatus())) {
                return ResponseEntity.ok(Map.of("message", "Already processed", "materialId", materialId));
            }

            material.setExtractionStatus("processing");
            materialRepository.save(material);

            byte[] buffer;
            String mimeType = "application/pdf";

            if (material.getDriveFileId() != null) {
                Map<String, Object> fileInfo = classroomService.getDriveFileInfo(user.getAccessToken(), material.getDriveFileId());
                mimeType = (String) fileInfo.getOrDefault("mimeType", "application/pdf");
                buffer = classroomService.downloadDriveFile(user.getAccessToken(), material.getDriveFileId(), mimeType);
            } else {
                return ResponseEntity.status(422).body(Map.of("error", "No file source found for processing"));
            }

            String extractedText = documentParserService.extractText(buffer, mimeType, material.getFileName());
            if (extractedText == null || extractedText.length() < 50) {
                material.setExtractionStatus("empty");
                materialRepository.save(material);
                return ResponseEntity.ok(Map.of("message", "File has no extractable text", "materialId", materialId));
            }

            material.setExtractedText(extractedText);
            material.setExtractionStatus("extracted");
            materialRepository.save(material);

            List<String> chunks = documentParserService.chunkText(extractedText, 800, 150);

            chunkRepository.deleteByMaterialId(materialId);

            for (int i = 0; i < chunks.size(); i++) {
                aiService.storeChunk(materialId, i, chunks.get(i));
            }

            material.setExtractionStatus("completed");
            materialRepository.save(material);

            return ResponseEntity.ok(Map.of(
                    "message", "Processing complete",
                    "materialId", materialId,
                    "chunks", chunks.size(),
                    "textLength", extractedText.length()
            ));

        } catch (Exception ex) {
            System.err.println("Material processing error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{materialId}/status")
    public ResponseEntity<?> getMaterialStatus(@PathVariable UUID materialId, @AuthenticationPrincipal User user) {
        Optional<Material> matOpt = materialRepository.findById(materialId);
        if (matOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Material not found"));
        }

        Material material = matOpt.get();
        Optional<Course> courseOpt = courseRepository.findByIdAndUserId(material.getCourseId(), user.getId());
        if (courseOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Material not found"));
        }

        long chunkCount = chunkRepository.countByMaterialId(materialId);
        Map<String, Object> resp = new HashMap<>();
        resp.put("id", material.getId());
        resp.put("file_name", material.getFileName());
        resp.put("extraction_status", material.getExtractionStatus());
        resp.put("chunk_count", chunkCount);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/upload")
    @Transactional
    public ResponseEntity<?> uploadMaterial(@RequestParam("file") MultipartFile file,
                                           @RequestParam("courseId") UUID courseId,
                                           @RequestParam(value = "sessionId", required = false) UUID sessionId,
                                           @AuthenticationPrincipal User user) {
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.status(400).body(Map.of("error", "No file uploaded"));
            }

            Optional<Course> courseOpt = courseRepository.findByIdAndUserId(courseId, user.getId());
            if (courseOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Course not found"));
            }

            byte[] bytes = file.getBytes();
            String extractedText = documentParserService.extractText(bytes, file.getContentType(), file.getOriginalFilename());

            if (extractedText == null || extractedText.length() < 50) {
                return ResponseEntity.status(422).body(Map.of("error", "File has no extractable text or is too short"));
            }

            Material material = new Material();
            material.setCourseId(courseId);
            material.setFileName(file.getOriginalFilename());
            material.setFileType("local");
            material.setFileSizeBytes(file.getSize());
            material.setExtractionStatus("processing");
            material = materialRepository.save(material);

            if (sessionId != null) {
                Optional<StudySession> sessOpt = sessionRepository.findByIdAndUserId(sessionId, user.getId());
                if (sessOpt.isPresent()) {
                    StudySession session = sessOpt.get();
                    UUID[] current = session.getSelectedMaterialIds();
                    List<UUID> list = current != null ? new ArrayList<>(Arrays.asList(current)) : new ArrayList<>();
                    if (!list.contains(material.getId())) {
                        list.add(material.getId());
                        session.setSelectedMaterialIds(list.toArray(new UUID[0]));
                        sessionRepository.save(session);
                    }
                }
            }

            List<String> chunks = documentParserService.chunkText(extractedText, 800, 150);
            for (int i = 0; i < chunks.size(); i++) {
                aiService.storeChunk(material.getId(), i, chunks.get(i));
            }

            material.setExtractedText(extractedText);
            material.setExtractionStatus("completed");
            material = materialRepository.save(material);

            return ResponseEntity.ok(Map.of(
                    "message", "Upload and processing complete",
                    "material", material,
                    "chunks", chunks.size()
            ));

        } catch (Exception ex) {
            System.err.println("Upload error: " + ex.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
