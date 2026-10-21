package com.studybuddy.controller;

import com.studybuddy.model.Course;
import com.studybuddy.model.Material;
import com.studybuddy.model.User;
import com.studybuddy.repository.CourseRepository;
import com.studybuddy.repository.MaterialRepository;
import com.studybuddy.service.GoogleClassroomService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseRepository courseRepository;
    private final MaterialRepository materialRepository;
    private final GoogleClassroomService classroomService;

    public CourseController(CourseRepository courseRepository,
                            MaterialRepository materialRepository,
                            GoogleClassroomService classroomService) {
        this.courseRepository = courseRepository;
        this.materialRepository = materialRepository;
        this.classroomService = classroomService;
    }

    @GetMapping
    public ResponseEntity<?> getCourses(@AuthenticationPrincipal User user) {
        try {
            if (user.getAccessToken() != null && !user.getAccessToken().isBlank()) {
                List<Map<String, Object>> classroomCourses = classroomService.getCourses(user.getAccessToken());
                for (Map<String, Object> c : classroomCourses) {
                    String courseId = (String) c.get("id");
                    String courseName = (String) c.get("name");
                    String section = (String) c.get("section");
                    String desc = (String) c.get("description");
                    String teacherFolderId = (String) c.get("teacherFolderId");

                    Optional<Course> existing = courseRepository.findByUserIdAndClassroomCourseId(user.getId(), courseId);
                    Course course = existing.orElseGet(Course::new);
                    course.setUserId(user.getId());
                    course.setClassroomCourseId(courseId);
                    course.setCourseName(courseName);
                    course.setSection(section);
                    course.setDescription(desc);
                    course.setTeacherFolderId(teacherFolderId);
                    courseRepository.save(course);
                }
            }

            List<Course> courses = courseRepository.findByUserIdOrderByCourseNameAsc(user.getId());
            return ResponseEntity.ok(Map.of("courses", courses));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<?> getCourse(@PathVariable UUID courseId, @AuthenticationPrincipal User user) {
        Optional<Course> courseOpt = courseRepository.findByIdAndUserId(courseId, user.getId());
        if (courseOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Course not found"));
        }
        return ResponseEntity.ok(Map.of("course", courseOpt.get()));
    }

    @GetMapping("/{courseId}/materials")
    public ResponseEntity<?> getCourseMaterials(@PathVariable UUID courseId, @AuthenticationPrincipal User user) {
        try {
            Optional<Course> courseOpt = courseRepository.findByIdAndUserId(courseId, user.getId());
            if (courseOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Course not found"));
            }

            Course course = courseOpt.get();
            if (user.getAccessToken() != null && !user.getAccessToken().isBlank()) {
                List<Map<String, Object>> materials = classroomService.getCourseMaterials(user.getAccessToken(), course.getClassroomCourseId());
                for (Map<String, Object> item : materials) {
                    String driveFileId = (String) item.get("drive_file_id");
                    String fileUrl = (String) item.get("file_url");
                    String fileName = (String) item.get("file_name");
                    String fileType = (String) item.get("file_type");
                    String classroomMaterialId = (String) item.get("classroom_material_id");

                    if (driveFileId != null) {
                        Optional<Material> existing = materialRepository.findByCourseIdAndDriveFileId(courseId, driveFileId);
                        Material mat = existing.orElseGet(Material::new);
                        mat.setCourseId(courseId);
                        mat.setFileName(fileName);
                        mat.setFileType(fileType);
                        mat.setDriveFileId(driveFileId);
                        mat.setClassroomMaterialId(classroomMaterialId);
                        materialRepository.save(mat);
                    } else if (fileUrl != null) {
                        Optional<Material> existing = materialRepository.findByCourseIdAndFileUrl(courseId, fileUrl);
                        Material mat = existing.orElseGet(Material::new);
                        mat.setCourseId(courseId);
                        mat.setFileName(fileName);
                        mat.setFileType(fileType);
                        mat.setFileUrl(fileUrl);
                        mat.setClassroomMaterialId(classroomMaterialId);
                        materialRepository.save(mat);
                    }
                }
            }

            List<Material> materials = materialRepository.findByCourseIdOrderByCreatedAtDesc(courseId);
            return ResponseEntity.ok(Map.of("materials", materials));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
