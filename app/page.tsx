"use client";

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { FiEdit2, FiTrash2, FiSend, FiSettings, FiClock, FiZap, FiChevronRight, FiGrid, FiList } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import * as CryptoJS from 'crypto-js';

const SECRET_KEY = 'uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=';

export default function Home() {
  const [hasKey, setHasKey] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [homeInput, setHomeInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchFilter, setSearchFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini-api-key');
      if (!saved) return setHasKey(false);
      const decrypted = CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8);
      setHasKey(Boolean(decrypted));
    } catch {
      setHasKey(false);
    }
    try {
      const raw = localStorage.getItem('chat_sessions');
      if (raw) setSessions(JSON.parse(raw));
    } catch {}
    
    // Load view preference
    const savedView = localStorage.getItem('view_mode');
    if (savedView === 'list') setViewMode('list');
  }, []);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [homeInput]);

  const persistSessions = (list: typeof sessions) => {
    setSessions(list);
    try { localStorage.setItem('chat_sessions', JSON.stringify(list)); } catch {}
  };

  const handleStartFromHome = async () => {
    const text = homeInput.trim();
    if (!text || isStarting) return;
    if (!hasKey) { router.push('/settings'); return; }

    setIsStarting(true);
    const id = newId();
    try {
      const saved = localStorage.getItem('gemini-api-key');
      const decrypted = saved ? CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8) : '';
      if (!decrypted) { router.push('/settings'); return; }

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, model: 'gemini-1.5-flash', apiKey: decrypted })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to optimize');

      const optimizedPrompt: string = data?.optimizedPrompt || '';
      const explanations: string[] = Array.isArray(data?.explanations) ? data.explanations : [];

      const messages = [
        { role: 'user', content: text },
        { role: 'assistant', content: optimizedPrompt, explanations },
      ];
      try { localStorage.setItem(`chat:${id}`, JSON.stringify({ messages, optimizedPrompt })); } catch {}

      const title = text.slice(0, 80);
      const list = [{ id, title, updatedAt: Date.now() }, ...sessions.filter(s => s.id !== id)];
      setSessions(list);
      try { localStorage.setItem('chat_sessions', JSON.stringify(list)); } catch {}

      router.push(`/optimize/${id}`);
    } catch (e: any) {
      console.error('Start from home failed', e);
      alert(e?.message || 'Failed to optimize prompt. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const onDragStart = (index: number) => setDragIndex(index);
  const onDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const list = [...sessions];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(index, 0, moved);
    persistSessions(list);
    setDragIndex(null);
  };

  const requestRename = (id: string, current: string) => {
    setEditingId(id);
    setEditingTitle(current);
  };
  
  const saveRename = (id: string) => {
    const list = sessions.map(s => s.id === id ? { ...s, title: editingTitle } : s);
    persistSessions(list);
    setEditingId(null);
    setEditingTitle('');
  };
  
  const deleteSession = (id: string) => {
    const list = sessions.filter(s => s.id !== id);
    persistSessions(list);
    try { localStorage.removeItem(`chat:${id}`); } catch {}
    setConfirmDeleteId(null);
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    localStorage.setItem('view_mode', newMode);
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl">
        {/* Header Section */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-cyan-700 bg-cyan-100/80 rounded-full backdrop-blur-sm dark:bg-cyan-900/30 dark:text-cyan-300">
            <FiZap className="w-3 h-3" />
            AI-Powered Optimization
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 tracking-tight animate-gradient-x">
            Prompt Optimizer
          </h1>
          
          <p className="mt-4 text-base md:text-lg text-slate-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform your prompts into high-performance instructions with AI-driven optimization
          </p>
        </div>

        {/* Main Input Card */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 blur-3xl" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-gray-800/50 p-6 md:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="prompt-input" className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                  Enter your prompt
                </label>
                {!hasKey && (
                  <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline">
                    <FiSettings className="w-3 h-3" />
                    Add API Key
                  </Link>
                )}
              </div>
              
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="prompt-input"
                  value={homeInput}
                  onChange={(e) => setHomeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleStartFromHome();
                    }
                  }}
                  placeholder={hasKey ? "Describe what you want to achieve with your prompt..." : "Please add your API key in Settings first"}
                  disabled={!hasKey}
                  className="w-full min-h-[120px] max-h-[200px] p-4 pr-14 text-base rounded-xl bg-slate-50 dark:bg-gray-800 border-2 border-transparent
                           text-slate-900 dark:text-gray-100 transition-all duration-200 resize-none
                           placeholder:text-slate-400 dark:placeholder:text-gray-500
                           focus:outline-none focus:border-cyan-500 focus:bg-white dark:focus:bg-gray-900
                           hover:border-slate-300 dark:hover:border-gray-700
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
                
                <button
                  onClick={handleStartFromHome}
                  disabled={!homeInput.trim() || isStarting || !hasKey}
                  className="absolute bottom-3 right-3 p-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600
                           text-white shadow-lg transition-all duration-200
                           hover:from-cyan-600 hover:to-blue-700 hover:shadow-xl hover:scale-105
                           active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                           focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                  aria-label="Optimize prompt"
                >
                  <FiSend className={`w-5 h-5 ${isStarting ? 'animate-pulse' : ''}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-500">
                <span>Press Enter to optimize • Shift+Enter for new line</span>
                <span>{homeInput.length}/1000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-gray-100">
              Past Optimizations
            </h2>
            
            {sessions.length > 0 && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                
                <button
                  onClick={toggleViewMode}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                           hover:bg-slate-50 dark:hover:bg-gray-750 transition-colors"
                  aria-label="Toggle view mode"
                >
                  {viewMode === 'grid' ? <FiList className="w-4 h-4" /> : <FiGrid className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white/50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
              <div className="max-w-sm mx-auto">
                <FiClock className="w-12 h-12 mx-auto mb-4 text-slate-400 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  {searchFilter ? 'No matching sessions' : 'No optimizations yet'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-500 mb-4">
                  {searchFilter ? 'Try adjusting your search' : 'Start by entering a prompt above to optimize it'}
                </p>
                {!searchFilter && (
                  <Link
                    href={hasKey ? "#" : "/settings"}
                    onClick={hasKey ? (e) => { e.preventDefault(); textareaRef.current?.focus(); } : undefined}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg
                             hover:from-cyan-600 hover:to-blue-700 transition-all duration-200"
                  >
                    {hasKey ? 'Start Optimizing' : 'Setup API Key'}
                    <FiChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 
              'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 
              'space-y-3'
            }>
              {filteredSessions.map((session, idx) => (
                <div
                  key={session.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(idx)}
                  className={`group relative bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800
                           hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-xl
                           transition-all duration-200 cursor-move overflow-hidden
                           ${viewMode === 'grid' ? 'p-5' : 'p-4'}`}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {editingId === session.id ? (
                    <div className="space-y-3">
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveRename(session.id); }}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                                 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRename(session.id)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditingTitle(''); }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : confirmDeleteId === session.id ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Delete this session?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/optimize/${session.id}`)}
                        className="w-full text-left"
                      >
                        <h3 className="font-semibold text-slate-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {session.title || 'Untitled Session'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
                          <FiClock className="w-3 h-3" />
                          <span>{formatRelativeTime(session.updatedAt)}</span>
                        </div>
                      </button>
                      
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); requestRename(session.id, session.title); }}
                          className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Rename"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                          className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                          aria-label="Delete"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}