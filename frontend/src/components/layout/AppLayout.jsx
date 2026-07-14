import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, BookOpen, MessageSquare,
  TrendingUp, LogOut, ChevronRight, Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../lib/api';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/sessions').then(res => setSessions(res.data.sessions?.slice(0, 5) || []));
  }, []);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/progress', icon: TrendingUp, label: 'My Progress' },
  ];

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0b0d14]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">StudyBuddy</p>
              <p className="text-brand-400 text-xs font-medium mt-0.5">AI Tutor</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Recent Sessions
              </p>
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/chat/${s.id}`)}
                  className="sidebar-item w-full text-left group"
                >
                  <MessageSquare size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1 text-xs">{s.session_title || 'Study Session'}</span>
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt={user.name} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-500/30 flex items-center justify-center text-brand-400 text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-slate-500 text-xs truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="text-slate-600 hover:text-red-400 transition-colors" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
