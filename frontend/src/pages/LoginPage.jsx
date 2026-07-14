import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Sparkles, BookOpen, Brain, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const features = [
  { icon: BookOpen, text: 'Auto-sync Google Classroom materials' },
  { icon: Brain, text: 'AI tutor powered by your actual notes' },
  { icon: Zap, text: 'Quizzes, flashcards & progress tracking' },
];

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-500/8 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-none">StudyBuddy AI</h1>
              <p className="text-brand-400 text-sm mt-0.5">Personalized Learning System</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Learn smarter,<br />
            <span className="text-brand-400">not harder.</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-md">
            AI-powered tutoring that connects directly to your Google Classroom — no manual uploads, just learning.
          </p>

          <div className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
                  <Icon size={14} className="text-brand-400" />
                </div>
                <p className="text-slate-300 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 justify-center mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center">
              <Sparkles size={17} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">StudyBuddy AI</span>
          </div>

          <div className="card text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-8">Sign in with your Google account to access your courses</p>

            <a
              href={`${API_URL}/auth/google`}
              className="flex items-center justify-center gap-3 w-full py-3 px-5 bg-white text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-colors shadow-md"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 014.5 7.5V5.43H1.83a8 8 0 000 7.13l2.67-2.08z"/>
                <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 001.83 5.43L4.5 7.5a4.77 4.77 0 014.48-3.92z"/>
              </svg>
              Continue with Google
            </a>

            <p className="text-slate-600 text-xs mt-6">
              By signing in, you authorize access to Google Classroom & Drive to fetch your study materials.
            </p>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            Your data stays private. Materials are used only for your learning sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
