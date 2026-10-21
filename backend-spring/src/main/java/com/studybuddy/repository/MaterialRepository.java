package com.studybuddy.repository;

import com.studybuddy.model.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialRepository extends JpaRepository<Material, UUID> {
    List<Material> findByCourseIdOrderByCreatedAtDesc(UUID courseId);
    List<Material> findByIdIn(List<UUID> ids);
    Optional<Material> findByCourseIdAndDriveFileId(UUID courseId, String driveFileId);
    Optional<Material> findByCourseIdAndFileUrl(UUID courseId, String fileUrl);
}
