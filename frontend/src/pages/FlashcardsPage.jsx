import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, 
  RotateCcw, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';

export default function FlashcardsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await api.get(`/api/sessions/${sessionId}`);
        setSession(res.data.session);
        api.put(`/api/sessions/${sessionId}`, {}).catch(() => {});
        window.dispatchEvent(new Event('sessions-updated'));
      } catch (err) {
        console.error('Failed to load session');
      }
    };
    loadSession();
  }, [sessionId]);

  const fetchCards = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/quiz/flashcards', { sessionId, numCards: 10 });
      setCards(res.data.flashcards.flashcards || res.data.flashcards || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [sessionId]);

  const handleNext = () => {
    if (currentIdx < cards.length - 1) {
      setFlipped(false);
      setTimeout(() => setCurrentIdx(currentIdx + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setFlipped(false);
      setTimeout(() => setCurrentIdx(currentIdx - 1), 150);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center mb-6 animate-pulse">
        <Sparkles size={32} className="text-brand-400" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Creating flashcards...</h2>
      <p className="text-slate-500 max-w-xs">Distilling key concepts into review cards.</p>
    </div>
  );

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-slate-500 mb-8 max-w-xs">{error}</p>
      
      {error.includes('re-authenticate') ? (
        <button 
          onClick={() => {
            localStorage.removeItem('sb_token');
            window.location.href = '/login';
          }}
          className="btn-primary px-8 py-3 flex items-center gap-2"
        >
          <Sparkles size={16} />
          Reconnect Google Account
        </button>
      ) : (
        <button onClick={fetchCards} className="btn-primary px-8 py-3">Retry Generation</button>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/chat/${sessionId}`)} className="btn-ghost p-1.5">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-white font-bold">Review Flashcards</h2>
        </div>
        <div className="text-slate-400 text-sm font-medium">
          {currentIdx + 1} / {cards.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg perspective-1000">
          {/* Flashcard */}
          <div 
            onClick={() => setFlipped(!flipped)}
            className={`relative w-full h-[400px] cursor-pointer transition-all duration-500 preserve-3d
              ${flipped ? 'rotate-y-180' : ''}
            `}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden card flex flex-col items-center justify-center p-12 text-center border-brand-500/20 bg-gradient-to-b from-[#1a1c25] to-[#0f1117]">
              <span className="text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">Question / Term</span>
              <h3 className="text-2xl text-white font-semibold leading-relaxed">
                {cards[currentIdx]?.term}
              </h3>
              <p className="absolute bottom-8 text-slate-600 text-xs flex items-center gap-2">
                <RefreshCw size={12} /> Tap to flip
              </p>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 card flex flex-col items-center justify-center p-12 text-center border-emerald-500/20 bg-gradient-to-b from-[#1a1c25] to-[#0f1117]">
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">Answer / Definition</span>
              <div className="overflow-y-auto max-h-full scrollbar-none">
                <p className="text-lg text-slate-200 leading-relaxed">
                  {cards[currentIdx]?.definition}
                </p>
              </div>
              <p className="absolute bottom-8 text-slate-600 text-xs flex items-center gap-2">
                <RefreshCw size={12} /> Tap to see term
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mt-12">
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={currentIdx === 0}
              className="w-12 h-12 rounded-full glass border-white/5 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }}
              className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 hover:bg-brand-500/20 transition-colors"
            >
              <RotateCcw size={20} />
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={currentIdx === cards.length - 1}
              className="w-12 h-12 rounded-full glass border-white/5 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="mt-12 flex flex-col gap-3 max-w-xs mx-auto">
            <button 
              onClick={() => navigate(`/chat/${sessionId}`)}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Back to Chat
            </button>
            {session?.course_id && (
              <button 
                onClick={() => navigate(`/courses/${session.course_id}`)}
                className="btn-ghost w-full py-2.5 text-sm"
              >
                Back to Course
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
