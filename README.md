.
.# StudyBuddy AI

An intelligent, classroom-integrated learning system that connects with Google Classroom & Drive to create a persistent, personalized AI tutoring experience.

## Project Structure

```
studybuddy/
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Express backend
├── docker-compose.yml # Full stack orchestration
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Google Cloud Project with Classroom & Drive APIs enabled

### 1. Clone & Install
```bash
# Install frontend deps
cd frontend && npm install

# Install backend deps
cd ../backend && npm install
```

### 2. Configure Environment
```bash
# Backend
cp backend/.env.example backend/.env
# Fill in your Google OAuth credentials, DB, and OpenAI key

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Setup Database
```bash
cd backend
npm run db:migrate
```

### 4. Run (Development)
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

App runs at: http://localhost:5173
API runs at: http://localhost:3001

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project
3. Enable: **Google Classroom API**, **Google Drive API**, **Google OAuth 2.0**
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
6. Copy Client ID & Secret to `backend/.env`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Auth | Google OAuth 2.0, JWT |
| AI | OpenAI GPT-4o + RAG |
| Vector DB | pgvector (PostgreSQL) |
| Primary DB | PostgreSQL |
| File Parsing | pdf-parse, mammoth |

## Features

- 🔗 **Google Classroom Integration** — Auto-fetch courses & materials
- 📚 **Course-Aware Chat** — AI answers using your actual class notes
- 🧠 **Persistent Sessions** — Continue studying where you left off
- 📝 **Quiz Generation** — MCQs from your materials
- 🃏 **Flashcards** — Auto-generated from key concepts
- 📊 **Progress Tracking** — Weak topics, history, streaks
