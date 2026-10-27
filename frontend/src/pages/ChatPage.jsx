import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/api';
import {
  Send, ArrowLeft, FileQuestion, BookMarked,
  Loader2, Sparkles, User, AlertCircle, ChevronDown, Plus, Paperclip
} from 'lucide-react';

const QUICK_PROMPTS = [
  { label: 'Summarize', prompt: 'Give me a comprehensive summary of all the key topics covered in these materials.' },
  { label: 'Quiz me', prompt: 'Generate a 5-question quiz based on the most important concepts from these materials.' },
  { label: 'Flashcards', prompt: 'Create 10 flashcards with the key terms and their definitions from these materials.' },
  { label: 'Key concepts', prompt: 'List the 10 most important concepts from these materials with brief explanations.' },
  { label: 'Explain simply', prompt: 'Explain the main topics from these materials in simple, easy-to-understand terms.' },
];

export default function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/sessions/${sessionId}`);
        setSession(res.data.session);
        setMessages(res.data.messages || []);
        // Touch session updated_at so recent sessions is updated
        api.put(`/api/sessions/${sessionId}`, {}).catch(() => {});
        window.dispatchEvent(new Event('sessions-updated'));
      } catch (err) {
        setError('Session not found');
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setError('');

    const optimisticMsg = { id: Date.now(), sender: 'user', content: msg, created_at: new Date() };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await api.post(`/api/chat/${sessionId}`, { message: msg });
      setMessages(prev => [...prev, res.data.message]);
      window.dispatchEvent(new Event('sessions-updated'));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', session.course_id);
    formData.append('sessionId', sessionId);

    try {
      await api.post('/api/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Add a system message to chat
      const systemMsg = { 
        id: Date.now(), 
        sender: 'assistant', 
        content: `✅ **File uploaded successfully:** ${file.name}\n\nI've indexed the content and I'm ready to answer questions about it.`,
        created_at: new Date() 
      };
      setMessages(prev => [...prev, systemMsg]);
      
      // Reload session to get updated material count/list if needed
      const sessionRes = await api.get(`/api/sessions/${sessionId}`);
      setSession(sessionRes.data.session);
      window.dispatchEvent(new Event('sessions-updated'));

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5 flex-shrink-0">
        <button onClick={() => navigate(`/courses/${session?.course_id}`)} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-sm truncate">
            {session?.session_title || 'Study Session'}
          </h2>
          <p className="text-slate-500 text-xs truncate">{session?.course_name || ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full">
            <Sparkles size={11} />
            AI Tutor
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <button 
            onClick={() => navigate(`/quiz/${sessionId}`)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <FileQuestion size={14} />
            Quiz
          </button>
          <button 
            onClick={() => navigate(`/flashcards/${sessionId}`)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <BookMarked size={14} />
            Cards
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-5 py-3 border-b border-white/5 flex-shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 whitespace-nowrap">
          {QUICK_PROMPTS.map(qp => (
            <button
              key={qp.label}
              onClick={() => send(qp.prompt)}
              className="text-[11px] px-3 py-1 rounded-full border border-white/8 text-slate-400 hover:text-white hover:border-brand-500/40 hover:bg-brand-500/10 transition-all flex-shrink-0"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
      >
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center mb-4">
              <BookMarked size={24} className="text-brand-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Ready to study</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Ask me anything about your materials. I'll explain concepts, create quizzes, generate summaries, and more.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
              ${msg.sender === 'user'
                ? 'bg-brand-500/30 text-brand-400'
                : 'bg-gradient-to-br from-brand-500 to-brand-700'
              }`}>
              {msg.sender === 'user'
                ? <User size={13} />
                : <Sparkles size={13} className="text-white" />
              }
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm
                ${msg.sender === 'user'
                  ? 'bg-brand-500/25 border border-brand-500/30 text-white rounded-tr-sm'
                  : 'glass border-white/8 rounded-tl-sm'
                }`}>
                {msg.sender === 'assistant' ? (
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              <p className="text-slate-600 text-xs px-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0">
              <Sparkles size={13} className="text-white" />
            </div>
            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-24 right-6 w-8 h-8 rounded-full glass border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-lg"
        >
          <ChevronDown size={16} />
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-2 flex flex-col gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400 transition-colors">✕</button>
          </div>
          {error.includes('re-authenticate') && (
            <button 
              onClick={() => {
                localStorage.removeItem('sb_token');
                window.location.href = '/login';
              }}
              className="mt-1 w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-md border border-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={12} />
              Reconnect Google Account
            </button>
          )}
          {error.includes('high demand') && (
            <button 
              onClick={() => send()}
              className="mt-1 w-full py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-md border border-brand-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Loader2 size={12} />
              Try Again Now
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".pdf,.docx,.doc,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            title="Upload study material"
          >
            {uploading ? <Loader2 size={18} className="animate-spin text-brand-400" /> : <Plus size={18} />}
          </button>
          
          <div className="flex-1 glass rounded-xl border-white/10 focus-within:border-brand-500/40 transition-colors relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={uploading ? "Processing file..." : "Ask anything about your study materials..."}
              rows={1}
              disabled={uploading}
              className="w-full bg-transparent px-4 py-3 text-white placeholder-slate-600 text-sm resize-none focus:outline-none max-h-32"
              style={{ minHeight: '48px' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending || uploading}
            className="btn-primary h-11 w-11 p-0 flex items-center justify-center rounded-xl flex-shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-slate-700 text-xs mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
