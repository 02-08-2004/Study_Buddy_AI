package com.studybuddy.repository;

import com.studybuddy.model.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseRepository extends JpaRepository<Course, UUID> {
    List<Course> findByUserIdOrderByCourseNameAsc(UUID userId);
    Optional<Course> findByIdAndUserId(UUID id, UUID userId);
    Optional<Course> findByUserIdAndClassroomCourseId(UUID userId, String classroomCourseId);
}
