import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import {
  BookOpen, RefreshCw, ChevronRight, Clock,
  MessageSquare, AlertCircle, GraduationCap, Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // Courses and sessions load independently — one failing won't block the other
  const loadCourses = async () => {
    setLoadingCourses(true);
    setCourseError('');
    try {
      const res = await api.get('/api/courses');
      setCourses(res.data.courses || []);
    } catch (err) {
      setCourseError(err.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionError('');
    try {
      const res = await api.get('/api/sessions');
      setSessions(res.data.sessions || []);
    } catch (err) {
      setSessionError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const syncCourses = async () => {
    setSyncing(true);
    setCourseError('');
    try {
      const res = await api.get('/api/courses');
      setCourses(res.data.courses || []);
    } catch (err) {
      setCourseError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadSessions();
  }, []);

  useEffect(() => {
    const handleUpdate = () => loadSessions();
    window.addEventListener('sessions-updated', handleUpdate);
    return () => window.removeEventListener('sessions-updated', handleUpdate);
  }, []);

  // Only show full-page spinner on very first load (both loading, nothing yet)
  if (loadingCourses && loadingSessions && courses.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthError = (msg) =>
    msg && (
      msg.toLowerCase().includes('token') ||
      msg.toLowerCase().includes('auth') ||
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('expired') ||
      msg.toLowerCase().includes('re-authenticate')
    );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-400">What would you like to study today?</p>
          </div>
          <button
            onClick={syncCourses}
            disabled={syncing}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sync Courses
          </button>
        </div>

        {/* Courses section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <GraduationCap size={18} className="text-brand-400" />
              Your Courses
            </h2>
            <span className="text-slate-500 text-sm">
              {loadingCourses ? '…' : `${courses.length} courses`}
            </span>
          </div>

          {/* Course error banner */}
          {courseError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span className="flex-1">{courseError}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={loadCourses}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={11} /> Retry
                </button>
                {isAuthError(courseError) && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('sb_token');
                      window.location.href = '/login';
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-all"
                  >
                    Re-authenticate with Google
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingCourses ? (
            <div className="card py-12 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : courses.length === 0 ? (
            <div className="card text-center py-12">
              <BookOpen size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium mb-1">No courses found</p>
              <p className="text-slate-600 text-sm">Click "Sync Courses" to fetch from Google Classroom</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => navigate(`/courses/${course.id}`)}
                  className="card glass-hover text-left group animate-fade-in"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center">
                      <BookOpen size={16} className="text-brand-400" />
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-brand-400 transition-colors mt-1" />
                  </div>
                  <h3 className="text-white font-medium text-sm leading-snug mb-1 line-clamp-2">
                    {course.course_name}
                  </h3>
                  {course.section && (
                    <p className="text-slate-500 text-xs">{course.section}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Sessions section */}
        <section>
          <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
            <Clock size={18} className="text-brand-400" />
            Recent Study Sessions
          </h2>

          {/* Session error banner */}
          {sessionError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{sessionError}</span>
              <button
                onClick={loadSessions}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-slate-600" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-slate-600 text-sm">No recent sessions. Start one by selecting a course above.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/chat/${s.id}`)}
                  className="card glass-hover w-full text-left flex items-center gap-4 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{s.session_title || 'Study Session'}</p>
                    <p className="text-slate-500 text-xs">{s.course_name} · {s.message_count} messages</p>
                  </div>
                  <p className="text-slate-600 text-xs flex-shrink-0">{formatRelative(s.updated_at)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatRelative(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
