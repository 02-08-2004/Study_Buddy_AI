package com.studybuddy.repository;

import com.studybuddy.model.UserProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserProgressRepository extends JpaRepository<UserProgress, UUID> {
    List<UserProgress> findByUserIdOrderByLastStudiedAtDesc(UUID userId);
    Optional<UserProgress> findByUserIdAndCourseId(UUID userId, UUID courseId);
}
