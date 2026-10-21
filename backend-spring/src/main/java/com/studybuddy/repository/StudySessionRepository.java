package com.studybuddy.repository;

import com.studybuddy.model.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudySessionRepository extends JpaRepository<StudySession, UUID> {
    List<StudySession> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    Optional<StudySession> findByIdAndUserId(UUID id, UUID userId);
    long countByUserId(UUID userId);
}
