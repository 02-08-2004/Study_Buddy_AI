require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const materialsRoutes = require('./routes/materials');
const sessionsRoutes = require('./routes/sessions');
const chatRoutes = require('./routes/chat');
const quizRoutes = require('./routes/quiz');
const progressRoutes = require('./routes/progress');

require('./services/passport');

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// Rate limiting — global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Per-user rate limiting for AI-heavy endpoints (chat + quiz)
// Reads user ID from JWT header — no DB hit, zero latency overhead.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return `user_${decoded.userId}`;
      }
    } catch {}
    return req.ip; // fallback to IP if token is absent/invalid
  },
  message: { error: 'AI rate limit reached. Please wait a moment before sending more messages.' },
  standardHeaders: true,
  legacyHeaders: false
});

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'studybuddy_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);   // per-user AI limit
app.use('/api/quiz', aiLimiter, quizRoutes);   // per-user AI limit
app.use('/api/progress', progressRoutes);

// Root routes
app.get('/', (req, res) => {
  res.json({
    message: 'StudyBuddy AI API',
    status: 'online',
    version: '1.0.0',
    documentation: 'https://github.com/user/studybuddy'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'StudyBuddy AI API Endpoints',
    endpoints: [
      '/auth',
      '/api/courses',
      '/api/materials',
      '/api/sessions',
      '/api/chat',
      '/api/quiz',
      '/api/progress'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Improved 404 handler
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    message: `The requested ${req.method} route was not found on this server.`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 StudyBuddy API running on http://localhost:${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
