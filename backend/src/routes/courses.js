const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../utils/db');
const { GoogleClassroomService, extractMaterialFiles } = require('../services/classroom');

const router = express.Router();

// GET /api/courses — fetch & sync courses from Google Classroom
router.get('/', authenticate, async (req, res) => {
  try {
    const gc = new GoogleClassroomService(req.user.access_token);
    const classroomCourses = await gc.getCourses();

    // Sync to DB
    for (const course of classroomCourses) {
      await query(
        `INSERT INTO courses (user_id, classroom_course_id, course_name, course_code, description, section, teacher_folder_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, classroom_course_id)
         DO UPDATE SET 
           course_name = EXCLUDED.course_name, 
           section = EXCLUDED.section,
           teacher_folder_id = EXCLUDED.teacher_folder_id`,
        [req.user.id, course.id, course.name, null, course.description, course.section, course.teacherFolder?.id]
      );
    }

    const result = await query(
      'SELECT * FROM courses WHERE user_id = $1 ORDER BY course_name',
      [req.user.id]
    );

    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Courses error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses/:courseId — get single course details
router.get('/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await query(
      'SELECT * FROM courses WHERE id = $1 AND user_id = $2',
      [courseId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ course: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses/:courseId/materials — sync & return materials for a course
router.get('/:courseId/materials', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Verify course belongs to user
    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND user_id = $2',
      [courseId, req.user.id]
    );

    if (!courseResult.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    const gc = new GoogleClassroomService(req.user.access_token);

    // Fetch all material sources
    const [courseWorkMaterials, courseWork, announcements, driveFiles] = await Promise.all([
      gc.getCourseWork(course.classroom_course_id),
      gc.getCourseWork2(course.classroom_course_id),
      gc.getCourseAnnouncements(course.classroom_course_id),
      gc.getCourseDriveFiles(course.teacher_folder_id)
    ]);

    const classroomFiles = extractMaterialFiles([...courseWorkMaterials, ...courseWork, ...announcements]);
    
    // Combine Classroom attachments with direct Drive files
    const allFiles = [
      ...classroomFiles,
      ...driveFiles.map(f => ({
        drive_file_id: f.id,
        file_name: f.name,
        file_type: 'drive',
        classroom_material_id: 'drive_direct'
      }))
    ];

    // Sync materials to DB
    for (const file of allFiles) {
      if (file.drive_file_id) {
        await query(
          `INSERT INTO materials (course_id, file_name, file_type, drive_file_id, classroom_material_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, drive_file_id, classroom_material_id) DO UPDATE SET
             file_name = EXCLUDED.file_name`,
          [courseId, file.file_name, file.file_type, file.drive_file_id, file.classroom_material_id]
        ).catch((e) => console.error('Sync drive error:', e.message));
      } else if (file.file_url) {
        await query(
          `INSERT INTO materials (course_id, file_name, file_type, file_url, classroom_material_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, file_url) DO UPDATE SET
             file_name = EXCLUDED.file_name`,
          [courseId, file.file_name, file.file_type, file.file_url, file.classroom_material_id]
        ).catch((e) => console.error('Sync link error:', e.message));
      }
    }

    const materials = await query(
      'SELECT * FROM materials WHERE course_id = $1 ORDER BY file_name',
      [courseId]
    );

    res.json({ materials: materials.rows });
  } catch (err) {
    console.error('Materials sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
