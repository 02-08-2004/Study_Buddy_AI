# 📚 StudyBuddy AI

> An intelligent, classroom-integrated AI tutoring system that connects with Google Classroom & Drive to deliver a fully personalized, context-aware study experience.

[![Live Demo](https://img.shields.io/badge/Demo-localhost%3A5173-blue)](http://localhost:5173)
[![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203-green)](http://localhost:3001)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 What is StudyBuddy AI?

StudyBuddy AI is a full-stack web application that acts as your personal AI tutor. It connects directly to your **Google Classroom** account, pulls in your actual course materials, and lets you:

- Chat with an AI that knows your syllabus
- Generate quizzes and flashcards from your own notes
- Track your progress and weak topics over time
- Study in persistent sessions that remember context

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🔗 **Google Classroom Sync** | Auto-fetches enrolled courses, assignments & materials |
| 🤖 **AI Chat (RAG)** | Answers questions using your actual uploaded class notes |
| 📝 **Quiz Generation** | Auto-generates MCQs from course materials |
| 🃏 **Flashcards** | Creates flashcards from key concepts in your notes |
| 📊 **Progress Tracking** | Tracks study time, quiz scores, and weak topics |
| 💬 **Persistent Sessions** | Saves every study session and chat history |
| 📁 **File Upload** | Upload PDFs and Word docs for AI to learn from |
| 🔐 **Google OAuth** | Secure sign-in with Google — no passwords needed |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│         Vite · Tailwind CSS · React Router       │
│              http://localhost:5173               │
└──────────────────────┬──────────────────────────┘
                       │ REST API (JWT Auth)
┌──────────────────────▼──────────────────────────┐
│           Backend (Spring Boot 3 / Java 21)      │
│    Spring Security · JPA · HikariCP · Tomcat     │
│              http://localhost:3001               │
└───────┬──────────────┬──────────────────┬────────┘
        │              │                  │
   ┌────▼────┐   ┌─────▼─────┐   ┌───────▼──────┐
   │PostgreSQL│   │OpenAI/Gemini│  │Google APIs   │
   │pgvector │   │GPT-4o + RAG│  │Classroom/Drive│
   └─────────┘   └───────────┘   └──────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI component framework |
| **Vite 5** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling |
| **React Router v6** | Client-side routing |
| **Axios** | HTTP client |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| **Java 21** | Programming language |
| **Spring Boot 3.3** | Backend framework |
| **Spring Security** | JWT authentication & CORS |
| **Spring Data JPA** | Database ORM |
| **HikariCP** | Connection pooling |
| **Apache Tomcat** | Embedded web server |

### Database & AI
| Technology | Purpose |
|---|---|
| **PostgreSQL 15** | Primary relational database |
| **pgvector** | Vector embeddings for RAG |
| **OpenAI GPT-4o** | AI chat completions |
| **Google Gemini** | Alternative AI provider |
| **pdf-parse / mammoth** | PDF & Word document parsing |

### Google Cloud
| API | Purpose |
|---|---|
| **Google OAuth 2.0** | User authentication |
| **Google Classroom API** | Fetch courses & assignments |
| **Google Drive API** | Access course attachments |

---

## 📁 Project Structure

```
studybuddy/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── pages/               # Route-level components
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── CoursePage.jsx
│   │   │   ├── QuizPage.jsx
│   │   │   ├── FlashcardsPage.jsx
│   │   │   └── ProgressPage.jsx
│   │   ├── components/          # Reusable UI components
│   │   ├── lib/api.js           # Axios API client
│   │   └── App.jsx              # Router & auth guard
│   └── package.json
│
├── backend-spring/              # Spring Boot backend (Java 21)
│   ├── src/main/java/com/studybuddy/
│   │   ├── controller/          # REST API endpoints
│   │   │   ├── AuthController.java
│   │   │   ├── ChatController.java
│   │   │   ├── CourseController.java
│   │   │   ├── MaterialController.java
│   │   │   ├── QuizController.java
│   │   │   ├── SessionController.java
│   │   │   └── ProgressController.java
│   │   ├── service/             # Business logic
│   │   │   ├── AiService.java
│   │   │   ├── GoogleOAuthService.java
│   │   │   ├── GoogleClassroomService.java
│   │   │   └── DocumentParserService.java
│   │   ├── model/               # JPA entities
│   │   ├── repository/          # Spring Data repositories
│   │   └── config/              # Security & JWT config
│   └── pom.xml
├── docker-compose.yml           # Docker orchestration
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- **Java 21** (JDK)
- **Node.js 18+**
- **PostgreSQL 15+**
- **Maven 3.8+**
- Google Cloud project with Classroom & Drive APIs enabled

---

### 1. Clone the Repository
```bash
git clone https://github.com/02-08-2004/Study_Buddy_AI.git
cd Study_Buddy_AI
```

---

### 2. Setup Database
```sql
-- In PostgreSQL:
CREATE DATABASE studybuddy;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

> 💡 **Note:** Database tables are automatically initialized when Spring Boot starts up using `schema.sql`. No manual migration script is needed.


---

### 3. Configure Backend (Spring Boot)

Copy the example config:
```bash
cd backend-spring/src/main/resources
cp application-local.properties.example application-local.properties
```

Edit `application-local.properties` with your real credentials:
```properties
google.client.id=YOUR_GOOGLE_CLIENT_ID
google.client.secret=YOUR_GOOGLE_CLIENT_SECRET
ai.gemini.api-key=YOUR_GEMINI_API_KEY
ai.openai.api-key=YOUR_OPENAI_API_KEY
```

---

### 4. Configure Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
```

---

### 5. Run the Application

**Terminal 1 — Spring Boot Backend:**
```bash
cd backend-spring
mvn spring-boot:run
# OR run the pre-built JAR:
java -jar target/studybuddy-backend-1.0.0.jar
```

**Terminal 2 — React Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Access the app:** http://localhost:5173

---

## 🔑 Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable these APIs:
   - ✅ Google Classroom API
   - ✅ Google Drive API
   - ✅ Google People API
4. Go to **APIs & Services → Credentials**
5. Create **OAuth 2.0 Client ID** (Web application)
6. Add Authorized redirect URI:
   ```
   http://localhost:3001/auth/google/callback
   ```
7. Copy **Client ID** and **Client Secret** to your config

> ⚠️ Note: The app uses sensitive Google scopes (Classroom). Users will see a "Google hasn't verified this app" warning — they must click **Advanced → Go to StuddyBuddy-AI** to proceed. This is normal for unverified apps.

---

## 🐳 Docker (Optional)

Run everything with Docker Compose:
```bash
docker-compose up --build
```

---

## 📸 Screenshots

| Login | Dashboard |
|---|---|
| Google OAuth sign-in | Course overview & study sessions |

| AI Chat | Quiz |
|---|---|
| Context-aware RAG chat | Auto-generated MCQs |

---

## 👨‍💻 Author

**Makkasowjanya** — [makkasowjanya2000@gmail.com](mailto:makkasowjanya2000@gmail.com)

GitHub: [02-08-2004](https://github.com/02-08-2004)

---

## 📄 License

This project is for educational purposes.
