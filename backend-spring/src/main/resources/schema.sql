-- Database Schema for StudyBuddy AI (Spring Boot Backend)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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
);

-- Courses table
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
);

-- Materials table
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
);

-- Document chunks (for RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    token_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    selected_material_ids UUID[],
    session_title VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant')),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quiz results
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
);

-- User progress / learning profile
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
);
