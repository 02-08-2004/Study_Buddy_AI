const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');
const { GoogleClassroomService } = require('../services/classroom');
const { extractText, chunkText } = require('../services/documentParser');
const { storeChunk } = require('../services/openai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

// POST /api/materials/:materialId/process — extract text & create embeddings
router.post('/:materialId/process', authenticate, async (req, res) => {
  try {
    const { materialId } = req.params;

    // Get material
    const matResult = await query(
      `SELECT m.*, c.user_id FROM materials m
       JOIN courses c ON m.course_id = c.id
       WHERE m.id = $1`,
      [materialId]
    );

    if (!matResult.rows.length || matResult.rows[0].user_id !== req.user.id) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const material = matResult.rows[0];

    if (material.extraction_status === 'completed') {
      return res.json({ message: 'Already processed', materialId });
    }

    // Mark as processing
    await query(
      "UPDATE materials SET extraction_status = 'processing' WHERE id = $1",
      [materialId]
    );

    // Download from Google Drive
    const gc = new GoogleClassroomService(req.user.access_token);

    let buffer;
    let mimeType = 'application/pdf';

    try {
      const fileInfo = await gc.getDriveFile(material.drive_file_id);
      mimeType = fileInfo.mimeType;
      buffer = await gc.downloadDriveFile(material.drive_file_id, mimeType);
    } catch (downloadErr) {
      await query(
        "UPDATE materials SET extraction_status = 'failed' WHERE id = $1",
        [materialId]
      );
      return res.status(422).json({ error: `Download failed: ${downloadErr.message}` });
    }

    // Extract text
    const extractedText = await extractText(buffer, mimeType, material.file_name);

    if (!extractedText || extractedText.length < 50) {
      await query(
        "UPDATE materials SET extraction_status = 'empty' WHERE id = $1",
        [materialId]
      );
      return res.json({ message: 'File has no extractable text', materialId });
    }

    // Save extracted text
    await query(
      "UPDATE materials SET extracted_text = $1, extraction_status = 'extracted' WHERE id = $2",
      [extractedText, materialId]
    );

    // Chunk and embed
    const chunks = chunkText(extractedText);

    // Delete old chunks
    await query('DELETE FROM document_chunks WHERE material_id = $1', [materialId]);

    // Store new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      await storeChunk(materialId, i, chunks[i]);
    }

    await query(
      "UPDATE materials SET extraction_status = 'completed' WHERE id = $1",
      [materialId]
    );

    res.json({
      message: 'Processing complete',
      materialId,
      chunks: chunks.length,
      textLength: extractedText.length
    });

  } catch (err) {
    console.error('Material processing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/materials/:materialId/status
router.get('/:materialId/status', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.id, m.file_name, m.extraction_status,
              COUNT(dc.id) as chunk_count
       FROM materials m
       LEFT JOIN document_chunks dc ON m.id = dc.material_id
       JOIN courses c ON m.course_id = c.id
       WHERE m.id = $1 AND c.user_id = $2
       GROUP BY m.id`,
      [req.params.materialId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/materials/upload — upload local file
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { courseId, sessionId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // 1. Extract text
    const buffer = fs.readFileSync(file.path);
    const extractedText = await extractText(buffer, file.mimetype, file.originalname);

    if (!extractedText || extractedText.length < 50) {
      return res.status(422).json({ error: 'File has no extractable text or is too short' });
    }

    // 2. Save material to DB
    const matResult = await query(
      `INSERT INTO materials (course_id, file_name, file_type, file_url, extraction_status, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [courseId, file.originalname, 'local', file.path, 'processing', file.size]
    );

    const material = matResult.rows[0];

    // 3. If sessionId provided, add to session's selected materials
    if (sessionId) {
      await query(
        `UPDATE study_sessions 
         SET selected_material_ids = array_append(selected_material_ids, $1)
         WHERE id = $2 AND user_id = $3`,
        [material.id, sessionId, req.user.id]
      );
    }

    // 4. Chunk and embed
    const chunks = chunkText(extractedText);
    for (let i = 0; i < chunks.length; i++) {
      await storeChunk(material.id, i, chunks[i]);
    }

    // 5. Update status
    await query(
      "UPDATE materials SET extracted_text = $1, extraction_status = 'completed' WHERE id = $2",
      [extractedText, material.id]
    );

    res.json({
      message: 'Upload and processing complete',
      material,
      chunks: chunks.length
    });

  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
