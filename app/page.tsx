"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import * as CryptoJS from 'crypto-js';

const SECRET_KEY = 'your-super-secret-key';

export default function Home() {
  const [hasKey, setHasKey] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [homeInput, setHomeInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
  }, []);

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
      // Load and decrypt API key
      const saved = localStorage.getItem('gemini-api-key');
      const decrypted = saved ? CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8) : '';
      if (!decrypted) { router.push('/settings'); return; }

      // Call optimizer API directly
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, model: 'gemini-1.5-flash', apiKey: decrypted })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to optimize');

      const optimizedPrompt: string = data?.optimizedPrompt || '';
      const explanations: string[] = Array.isArray(data?.explanations) ? data.explanations : [];

      // Persist full session so the session page loads instantly with results
      const messages = [
        { role: 'user', content: text },
        { role: 'assistant', content: optimizedPrompt, explanations },
      ];
      try { localStorage.setItem(`chat:${id}`, JSON.stringify({ messages, optimizedPrompt })); } catch {}

      // Update sessions list
      const title = text.slice(0, 80);
      const list = [{ id, title, updatedAt: Date.now() }, ...sessions.filter(s => s.id !== id)];
      setSessions(list);
      try { localStorage.setItem('chat_sessions', JSON.stringify(list)); } catch {}

      // Navigate to the session
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
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-4xl text-center">
        <h1
          className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 select-none transition-transform duration-200 hover:scale-[1.01] drop-shadow-[0_0_18px_rgba(59,130,246,0.45)]"
          aria-label="Prompt Optimizer"
        >
          Prompt Optimizer
        </h1>
        <p className="mt-3 text-slate-600 dark:text-gray-300">Optimize a prompt, then refine with follow-ups.</p>

        {/* Quick start input */}
        <div className="mt-8 flex items-end space-x-2 text-left">
          <textarea
            value={homeInput}
            onChange={(e)=>setHomeInput(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleStartFromHome(); } }}
            placeholder={hasKey?"Enter your prompt to optimize...":"Enter API key first in Settings"}
            className="flex-1 h-28 p-4 rounded-xl bg-white/90 border border-slate-300 text-slate-900 shadow-sm transition-all resize-none
                       focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-300
                       hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]
                       dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-100 dark:focus-visible:ring-cyan-400/30"
            aria-label="Enter your prompt"
          />
          <button
            onClick={handleStartFromHome}
            disabled={!homeInput.trim() || isStarting}
            className="h-12 px-5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-semibold shadow-md
                       hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.99]
                       disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/30"
            aria-label="Start optimization"
          >{isStarting ? 'Optimizing…' : 'Start'}</button>
        </div>

        {/* Minimal helper text */}
        <p className="mt-3 text-xs text-gray-500">Press Enter to start, Shift+Enter for newline.</p>

        <div className="mt-6 text-sm text-slate-600 dark:text-gray-400">
          {hasKey ? 'API key detected. You can optimize or refine.' : 'No API key found. Please complete setup first.'}
        </div>

        <div className="mt-10 w-full text-left">
          <h2 className="text-xl font-semibold mb-3">Past Optimizations</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-400">No past sessions yet. Start a <Link className="text-blue-400 hover:underline" href={hasKey?"/optimize":"/settings"}>new optimization</Link>.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s, idx) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={()=>onDragStart(idx)}
                  onDragOver={(e)=>e.preventDefault()}
                  onDrop={()=>onDrop(idx)}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-move bg-white border-slate-200 hover:bg-slate-50
                             dark:bg-gray-800/50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors glow"
                >
                  <button
                    onClick={()=>router.push(`/optimize/${s.id}`)}
                    className="flex-1 text-left pr-3"
                  >
                    {editingId===s.id ? (
                      <input
                        value={editingTitle}
                        onChange={(e)=>setEditingTitle(e.target.value)}
                        onKeyDown={(e)=>{ if(e.key==='Enter') saveRename(s.id); }}
                        className="w-full rounded px-2 py-1 text-sm bg-white border border-slate-300 text-slate-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                      />
                    ) : (
                      <div className="truncate text-sm text-slate-800 dark:text-gray-100">{s.title || 'Untitled'}</div>
                    )}
                    <div className="text-xs text-slate-500 dark:text-gray-400">{new Date(s.updatedAt).toLocaleString()}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    {editingId===s.id ? (
                      <button
                        onClick={()=>saveRename(s.id)}
                        className="px-2 py-1 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        title="Save name"
                      >Save</button>
                    ) : confirmDeleteId===s.id ? (
                      <>
                        <button
                          onClick={()=>{ deleteSession(s.id); setConfirmDeleteId(null); }}
                          className="px-2 py-1 rounded-md bg-red-500 text-white text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                          title="Confirm delete"
                        >Delete</button>
                        <button
                          onClick={()=>setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-md bg-slate-200 text-slate-800 text-xs hover:bg-slate-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                          title="Cancel"
                        >Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={()=>requestRename(s.id, s.title)}
                          className="p-1.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                          title="Rename"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={()=>setConfirmDeleteId(s.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-600 dark:hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
