package com.studybuddy.repository;

import com.studybuddy.model.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {

    List<DocumentChunk> findByMaterialIdOrderByChunkIndexAsc(UUID materialId);

    List<DocumentChunk> findByMaterialIdIn(List<UUID> materialIds);

    @Modifying
    @Query("DELETE FROM DocumentChunk dc WHERE dc.materialId = :materialId")
    void deleteByMaterialId(@Param("materialId") UUID materialId);

    long countByMaterialId(UUID materialId);

    @Query(value = "SELECT dc.* FROM document_chunks dc WHERE dc.material_id IN (:materialIds) " +
                   "AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', :queryText) " +
                   "ORDER BY ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', :queryText)) DESC " +
                   "LIMIT :limit", nativeQuery = true)
    List<DocumentChunk> searchRelevantChunks(@Param("queryText") String queryText,
                                            @Param("materialIds") List<UUID> materialIds,
                                            @Param("limit") int limit);
}
