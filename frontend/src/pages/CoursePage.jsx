import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  FileText, File, Link, RefreshCw, CheckSquare,
  Square, ArrowLeft, Play, Loader2, AlertCircle, BookOpen
} from 'lucide-react';

const fileIcon = (type) => {
  if (type === 'link') return <Link size={14} className="text-blue-400" />;
  if (type === 'youtube') return <Play size={14} className="text-red-500" />;
  return <FileText size={14} className="text-brand-400" />;
};

const statusBadge = (status) => {
  const map = {
    completed: 'bg-green-500/15 text-green-400 border-green-500/20',
    processing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
    pending: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    empty: 'bg-slate-500/15 text-slate-500 border-slate-500/20'
  };
  return map[status] || map.pending;
};

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [courseName, setCourseName] = useState('');

  const loadMaterials = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch course name and materials independently — one failing won't kill the other
      const [materialsRes, courseRes] = await Promise.allSettled([
        api.get(`/api/courses/${courseId}/materials`),
        api.get(`/api/courses/${courseId}`)
      ]);

      if (materialsRes.status === 'fulfilled') {
        setMaterials(materialsRes.value.data.materials || []);
      } else {
        setError(materialsRes.reason?.message || 'Failed to load materials');
      }

      if (courseRes.status === 'fulfilled') {
        setCourseName(courseRes.value.data.course?.course_name || '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMaterials(); }, [courseId]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const processable = materials.filter(m => m.drive_file_id);
    setSelected(new Set(processable.map(m => m.id)));
  };

  const processSelected = async () => {
    const toProcess = Array.from(selected).filter(id => {
      const mat = materials.find(m => m.id === id);
      return mat?.extraction_status !== 'completed' && !processing.has(id);
    });

    if (toProcess.length === 0) return;

    // Process in parallel
    await Promise.all(toProcess.map(async (id) => {
      setProcessing(prev => new Set([...prev, id]));
      try {
        await api.post(`/api/materials/${id}/process`);
        setMaterials(prev => prev.map(m =>
          m.id === id ? { ...m, extraction_status: 'completed' } : m
        ));
      } catch {
        setMaterials(prev => prev.map(m =>
          m.id === id ? { ...m, extraction_status: 'failed' } : m
        ));
      } finally {
        setProcessing(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }));
  };

  const startSession = async () => {
    if (selected.size === 0) return;
    setStarting(true);
    try {
      // Process unprocessed files first
      await processSelected();

      const processedIds = materials
        .filter(m => selected.has(m.id) && m.extraction_status === 'completed')
        .map(m => m.id);

      const res = await api.post('/api/sessions', {
        courseId,
        materialIds: processedIds.length > 0 ? processedIds : [...selected],
        sessionTitle: `Study: ${courseName || 'Course Session'}`
      });

      window.dispatchEvent(new Event('sessions-updated'));
      navigate(`/chat/${res.data.session.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="btn-ghost p-2">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white line-clamp-1">
              {courseName || 'Course Materials'}
            </h1>
            <p className="text-slate-400 text-sm">Select files to study with AI</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">✕</button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={loadMaterials}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={11} /> Retry
              </button>
              {(error.toLowerCase().includes('token') || error.toLowerCase().includes('auth') || error.toLowerCase().includes('expired')) && (
                <button
                  onClick={() => { localStorage.removeItem('sb_token'); window.location.href = '/login'; }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-all"
                >
                  Re-authenticate with Google
                </button>
              )}
            </div>
          </div>
        )}


        {/* Action bar */}
        {materials.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="btn-ghost text-xs flex items-center gap-1.5">
                <CheckSquare size={13} /> Select All
              </button>
              <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs">
                Clear
              </button>
              <span className="text-slate-500 text-sm">
                {selected.size} selected
              </span>
            </div>
            <button
              onClick={startSession}
              disabled={selected.size === 0 || starting}
              className="btn-primary flex items-center gap-2"
            >
              {starting
                ? <Loader2 size={15} className="animate-spin" />
                : <Play size={15} />
              }
              {starting ? 'Preparing...' : 'Start Study Session'}
            </button>
          </div>
        )}

        {/* Materials list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-brand-400" />
          </div>
        ) : materials.length === 0 ? (
          <div className="card text-center py-16">
            <BookOpen size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No materials found</p>
            <p className="text-slate-600 text-sm mt-1">This course has no attached files yet</p>
            <button onClick={loadMaterials} className="btn-ghost mt-4 text-sm flex items-center gap-2 mx-auto">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map(mat => (
              <button
                key={mat.id}
                onClick={() => (mat.drive_file_id || mat.file_url) && toggle(mat.id)}
                disabled={!mat.drive_file_id && !mat.file_url}
                className={`card w-full text-left flex items-center gap-4 group transition-all
                  ${(mat.drive_file_id || mat.file_url) ? 'cursor-pointer glass-hover' : 'opacity-50 cursor-default'}
                  ${selected.has(mat.id) ? 'border-brand-500/40 bg-brand-500/8' : ''}
                `}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                  ${selected.has(mat.id)
                    ? 'bg-brand-500 text-white'
                    : 'border border-white/10'}`
                }>
                  {selected.has(mat.id) && <CheckSquare size={12} />}
                </div>

                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  {fileIcon(mat.file_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{mat.file_name}</p>
                  <p className="text-slate-500 text-xs capitalize">{mat.file_type || 'document'}</p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {processing.has(mat.id) ? (
                    <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/20">
                      <Loader2 size={10} className="animate-spin" /> Processing
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(mat.study_status || 'pending')}`}>
                      {mat.study_status === 'completed' ? 'studied' : 'pending'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
