import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { 
  ArrowLeft, CheckCircle2, XCircle, ChevronRight, 
  Loader2, Trophy, Timer, AlertCircle, Sparkles
} from 'lucide-react';

export default function QuizPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [startTime] = useState(Date.now());
  const [session, setSession] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await api.get(`/api/sessions/${sessionId}`);
        setSession(res.data.session);
      } catch (err) {
        console.error('Failed to load session');
      }
    };
    loadSession();
  }, [sessionId]);

  const fetchQuiz = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/api/quiz/generate', { sessionId, numQuestions: 5 });
      setQuiz(res.data.quiz.questions);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to generate quiz';
      setError(errorMsg);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuiz();
  }, [sessionId]);

  const handleSelect = (optionKey) => {
    if (submitted) return;
    setAnswers({ ...answers, [currentIdx]: optionKey });
  };

  const handleNext = () => {
    if (currentIdx < quiz.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    setLoading(true);
    try {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      let score = 0;
      const weakTopics = new Set();

      quiz.forEach((q, idx) => {
        if (answers[idx] === q.correct) {
          score++;
        } else {
          // Extract potential topics from question if possible, or just generic
          if (q.question.toLowerCase().includes('what')) weakTopics.add('Conceptual Basics');
          else weakTopics.add('Technical Details');
        }
      });

      const res = await api.post('/api/quiz/submit', {
        sessionId,
        quizData: { questions: quiz, answers },
        score,
        totalQuestions: quiz.length,
        timeTakenSeconds: timeTaken,
        weakTopics: Array.from(weakTopics)
      });

      setResults({
        score,
        total: quiz.length,
        percentage: Math.round((score / quiz.length) * 100),
        timeTaken
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit results');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !quiz) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center mb-6 animate-bounce">
        <Sparkles size={32} className="text-brand-400" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Generating your personalized quiz...</h2>
      <p className="text-slate-500 max-w-xs mb-6">Analyzing your study materials to create relevant questions.</p>
      
      {error && (
        <div className="max-w-sm w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left animate-fade-in mb-8">
          <div className="flex items-center gap-3 text-red-400 mb-3">
            <AlertCircle size={18} />
            <span className="font-medium text-sm">{error}</span>
          </div>
          {error.includes('re-authenticate') ? (
            <button 
              onClick={() => {
                localStorage.removeItem('sb_token');
                window.location.href = '/login';
              }}
              className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              Reconnect Google Account
            </button>
          ) : (
            <button onClick={fetchQuiz} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition-all">
              Retry Generation
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (submitted && results) return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="card text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-accent" />
          
          <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto mb-6">
            <Trophy size={40} className="text-brand-400" />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-2">Quiz Completed!</h2>
          <p className="text-slate-400 mb-8">Great job reviewing your materials.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Score</p>
              <p className="text-2xl font-bold text-white">{results.score} / {results.total}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Percentage</p>
              <p className="text-2xl font-bold text-brand-400">{results.percentage}%</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => navigate(`/chat/${sessionId}`)}
              className="btn-primary w-full py-3"
            >
              Back to Chat
            </button>
            {session?.course_id && (
              <button 
                onClick={() => navigate(`/courses/${session.course_id}`)}
                className="btn-ghost w-full py-3"
              >
                Back to Course
              </button>
            )}
            <button 
              onClick={() => {
                setSubmitted(false);
                setResults(null);
                setCurrentIdx(0);
                setAnswers({});
                fetchQuiz();
              }}
              className="btn-ghost w-full py-3"
            >
              Try Another Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const currentQ = quiz?.[currentIdx];
  const progress = ((currentIdx + 1) / quiz?.length) * 100;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/chat/${sessionId}`)} className="btn-ghost p-1.5">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-white font-bold">Practice Quiz</h2>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Timer size={16} />
          <span>{Math.floor((Date.now() - startTime) / 60000)}m elapsed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/5">
        <div 
          className="h-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <span className="text-brand-400 font-bold text-sm uppercase tracking-widest">Question {currentIdx + 1} of {quiz?.length}</span>
            <h3 className="text-xl text-white font-medium mt-2 leading-relaxed">
              {currentQ?.question}
            </h3>
          </div>

          <div className="space-y-3 mb-10">
            {currentQ?.options.map((opt) => {
              const optKey = opt.split(')')[0].trim(); // Extract 'A', 'B', etc.
              const isSelected = answers[currentIdx] === optKey;
              
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(optKey)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group
                    ${isSelected 
                      ? 'bg-brand-500/10 border-brand-500/50 text-white shadow-lg shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                      ${isSelected ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-500 group-hover:text-slate-300'}
                    `}>
                      {optKey}
                    </div>
                    <span className="flex-1">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={!answers[currentIdx]}
              className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-50"
            >
              {currentIdx === quiz?.length - 1 ? 'Finish Quiz' : 'Next Question'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
