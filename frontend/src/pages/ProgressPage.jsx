import { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  TrendingUp, BookOpen, MessageSquare, Target,
  AlertTriangle, CheckCircle, BarChart2, Loader2
} from 'lucide-react';

export default function ProgressPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/progress')
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-brand-400" />
    </div>
  );

  const summary = data?.summary || {};
  const courseProgress = data?.courseProgress || [];

  const stats = [
    { label: 'Study Sessions', value: summary.total_sessions || 0, icon: BookOpen, color: 'text-brand-400' },
    { label: 'Messages Sent', value: summary.total_messages || 0, icon: MessageSquare, color: 'text-green-400' },
    { label: 'Courses Studied', value: summary.courses_studied || 0, icon: Target, color: 'text-purple-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={24} className="text-brand-400" />
            Learning Progress
          </h1>
          <p className="text-slate-400 mt-1">Track your study activity and weak areas</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card text-center">
              <Icon size={20} className={`${color} mx-auto mb-2`} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Course progress */}
        {courseProgress.length === 0 ? (
          <div className="card text-center py-12">
            <BarChart2 size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No progress data yet</p>
            <p className="text-slate-600 text-sm">Start a study session to track your learning</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-white font-semibold">Course Breakdown</h2>
            {courseProgress.map(cp => (
              <div key={cp.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-medium text-sm">{cp.course_name}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {cp.total_chat_messages} messages · {cp.total_quizzes_taken} quizzes
                      {cp.average_quiz_score > 0 && ` · ${Math.round(cp.average_quiz_score)}% avg score`}
                    </p>
                  </div>
                  {cp.last_studied_at && (
                    <p className="text-slate-600 text-xs">
                      {new Date(cp.last_studied_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {cp.weak_topics?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-red-400 flex items-center gap-1 mb-1.5">
                      <AlertTriangle size={11} /> Weak Topics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cp.weak_topics.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {cp.strong_topics?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-400 flex items-center gap-1 mb-1.5">
                      <CheckCircle size={11} /> Strong Topics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cp.strong_topics.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
