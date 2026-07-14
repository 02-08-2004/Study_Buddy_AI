require('dotenv').config();
const { pool } = require('./db');

const migrate = async () => {
  console.log('🔄 Running database migrations...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Enable pgvector extension
    // await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        google_account_id VARCHAR(255) UNIQUE NOT NULL,
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        access_token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        classroom_course_id VARCHAR(255) NOT NULL,
        course_name VARCHAR(500) NOT NULL,
        course_code VARCHAR(100),
        description TEXT,
        teacher_name VARCHAR(255),
        section VARCHAR(255),
        source_type VARCHAR(50) DEFAULT 'google_classroom',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, classroom_course_id)
      )
    `);

    // Materials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        drive_file_id VARCHAR(255),
        classroom_material_id VARCHAR(255),
        file_url TEXT,
        extracted_text TEXT,
        extraction_status VARCHAR(50) DEFAULT 'pending',
        study_status VARCHAR(50) DEFAULT 'pending',
        file_size_bytes BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, drive_file_id, classroom_material_id),
        UNIQUE(course_id, file_url)
      )
    `);

    // Document chunks (for RAG)
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT, -- Changed from vector(1536) to TEXT for compatibility
        token_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create vector similarity search index
    // Vector index disabled as pgvector is not present
    /*
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
      ON document_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    */

    // Study sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
        selected_material_ids UUID[],
        session_title VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Chat messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant')),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Quiz results
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quiz_data JSONB NOT NULL,
        score INTEGER,
        total_questions INTEGER,
        time_taken_seconds INTEGER,
        weak_topics TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User progress / learning profile
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        weak_topics TEXT[],
        strong_topics TEXT[],
        studied_material_ids UUID[],
        total_chat_messages INTEGER DEFAULT 0,
        total_quizzes_taken INTEGER DEFAULT 0,
        average_quiz_score FLOAT DEFAULT 0,
        study_streak_days INTEGER DEFAULT 0,
        last_studied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, course_id)
      )
    `);

    // ── Safe column additions for existing databases ────────────────────────
    // These are no-ops if the column already exists.
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS access_token_expiry TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE materials
        ADD COLUMN IF NOT EXISTS study_status VARCHAR(50) DEFAULT 'pending'
    `);
    // ─────────────────────────────────────────────────────────────────────────

    await client.query('COMMIT');
    console.log('✅ Migrations completed successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
