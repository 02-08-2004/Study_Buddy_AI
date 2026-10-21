package com.studybuddy.repository;

import com.studybuddy.model.QuizResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuizResultRepository extends JpaRepository<QuizResult, UUID> {
    List<QuizResult> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<QuizResult> findBySessionId(UUID sessionId);
}
