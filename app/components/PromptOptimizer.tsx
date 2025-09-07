"use client";

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { FiArrowRight, FiCopy, FiCheckCircle, FiRefreshCw, FiSend, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import * as CryptoJS from 'crypto-js';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const SECRET_KEY = 'uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=';

interface PromptOptimizerProps {
  apiKey?: string;
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  explanations?: string[];
};

export default function PromptOptimizer({ apiKey: apiKeyProp }: PromptOptimizerProps) {
  // State management
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const sessionId = (params && (params as any).id) || '';
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [apiKey, setApiKey] = useState(apiKeyProp || '');
  const [input, setInput] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const FIXED_BACKEND_MODEL = 'gemini-1.5-flash';
  const [sessions, setSessions] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const saveTimer = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load API key from localStorage (decrypt)
  const loadApiKeyFromStorage = () => {
    try {
      const saved = localStorage.getItem('gemini-api-key');
      if (!saved) return;
      const decrypted = CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8);
      if (decrypted) setApiKey(decrypted);
    } catch (e) {
      console.error('Failed to load API key from storage', e);
    }
  };

  useEffect(() => {
    if (!apiKeyProp) {
      loadApiKeyFromStorage();
    }
  }, [apiKeyProp]);

  useEffect(() => {
    setIsApiKeyValid(Boolean(apiKeyProp || apiKey));
  }, [apiKeyProp, apiKey]);

  // Load session messages & list; reset state when switching sessions
  useEffect(() => {
    try {
      const rawList = localStorage.getItem('chat_sessions');
      const listParsed: { id: string; title: string; updatedAt: number }[] = rawList ? JSON.parse(rawList) : [];
      if (rawList) setSessions(listParsed);

      // Clear current view before loading new session to avoid flashes
      setLoadingSession(true);
      setMessages([]);
      setOptimizedPrompt('');

      if (sessionId) {
        const raw = localStorage.getItem(`chat:${sessionId}`);
        const data = raw ? JSON.parse(raw) : null;
        const loadedMessages: ChatMessage[] = Array.isArray(data?.messages) ? data.messages : [];
        const loadedOptimized: string = typeof data?.optimizedPrompt === 'string' ? data.optimizedPrompt : '';
        setMessages(loadedMessages);
        setOptimizedPrompt(loadedOptimized);
      }
      setLoadingSession(false);
    } catch (e) {
      console.warn('Failed to load session data', e);
      setLoadingSession(false);
    }
  }, [sessionId]);

  // If we came from home quick-start, auto-run optimization once
  useEffect(() => {
    if (!sessionId || !isApiKeyValid || loadingSession) return;
    try {
      const key = `init_prompt:${sessionId}`;
      const seed = localStorage.getItem(key);
      if (seed && !messages.some(m=>m.role==='assistant')) {
        setInput(seed);
        localStorage.removeItem(key);
        // fire and forget
        handleOptimize(false);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isApiKeyValid, loadingSession]);

  // Persist session on change (debounced) — only when content actually exists and changes
  useEffect(() => {
    if (!sessionId || loadingSession) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const hasContent = messages.length > 0 || Boolean(optimizedPrompt);
        // If no content, ensure nothing is saved/persisted for this session
        if (!hasContent) {
          try { localStorage.removeItem(`chat:${sessionId}`); } catch {}
          const raw = localStorage.getItem('chat_sessions');
          const listParsed: { id: string; title: string; updatedAt: number }[] = raw ? JSON.parse(raw) : [];
          const cleaned = listParsed.filter(s => s.id !== sessionId);
          if (cleaned.length !== listParsed.length) {
            localStorage.setItem('chat_sessions', JSON.stringify(cleaned));
            setSessions(cleaned);
          }
          return;
        }
        // Compare with existing to avoid bumping updatedAt on mere load
        const existingRaw = localStorage.getItem(`chat:${sessionId}`);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;
        const nextPayload = { messages, optimizedPrompt };
        const hasChanges = JSON.stringify(existing || {}) !== JSON.stringify(nextPayload);

        if (hasChanges) {
          localStorage.setItem(`chat:${sessionId}`, JSON.stringify(nextPayload));

          // Update sessions list entry (title + updatedAt)
          const firstUser = messages.find(m => m.role === 'user');
          const title = (firstUser?.content || 'New Optimization').slice(0, 80);
          const list = [...sessions];
          const idx = list.findIndex(s => s.id === sessionId);
          const entry = { id: sessionId, title, updatedAt: Date.now() };
          if (idx >= 0) list[idx] = entry; else list.unshift(entry);
          setSessions(list);
          localStorage.setItem('chat_sessions', JSON.stringify(list));
        }
      } catch (e) {
        console.warn('Failed to save session data', e);
      }
    }, 200);

    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [sessionId, messages, optimizedPrompt, loadingSession]);

  // Inline rename + delete handlers for history items
  const beginRename = (id: string, current: string) => {
    setEditingId(id);
    setEditingTitle(current);
  };
  const saveRename = (id: string) => {
    const title = editingTitle.trim() || 'Untitled';
    const list = [...sessions];
    const idx = list.findIndex(s => s.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], title };
      setSessions(list);
      try { localStorage.setItem('chat_sessions', JSON.stringify(list)); } catch {}
    }
    setEditingId(null);
    setEditingTitle('');
  };
  const cancelRename = () => { setEditingId(null); setEditingTitle(''); };
  const deleteSession = (id: string) => {
    const list = sessions.filter(s => s.id !== id);
    setSessions(list);
    try {
      localStorage.setItem('chat_sessions', JSON.stringify(list));
      localStorage.removeItem(`chat:${id}`);
    } catch {}
    if (id === sessionId) {
      router.push('/');
    }
  };

  // Core request function (handles both initial optimize and subsequent refinements)
  const handleOptimize = async (isRefinement = false, instruction?: string) => {
    if (!isApiKeyValid) {
      toast.error('Please enter a valid API key');
      return;
    }

    if (!isRefinement && !input.trim()) {
      toast.error('Please enter a prompt to optimize');
      return;
    }

    if (isRefinement && !(instruction || '').trim()) {
      toast.error('Please enter refinement instructions');
      return;
    }

    try {
      setIsLoading(true);

      const payload: any = {
        prompt: isRefinement ? optimizedPrompt : input,
        model: FIXED_BACKEND_MODEL, // backend is fixed; platform selection is UI-only
        apiKey,
      };
      if (isRefinement) {
        payload.refinementInstruction = instruction;
        payload.previousPrompt = optimizedPrompt || input;
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process your request');
      }

      const data = await response.json();
      const newOptimized = data.optimizedPrompt || '';
      const newExplanations = data.explanations || [];
      setOptimizedPrompt(newOptimized);
      // Persist latest prompt
      try { localStorage.setItem('optimized_prompt', newOptimized); } catch {}

      // Update chat messages
      if (!isRefinement) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: input.trim() },
          { role: 'assistant', content: newOptimized, explanations: newExplanations },
        ]);
        setInput('');
        toast.success('Prompt optimized');
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: instruction || '' },
          { role: 'assistant', content: newOptimized, explanations: newExplanations },
        ]);
        toast.success('Prompt refined');
      }
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast.error(error.message || 'An error occurred while processing your request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasAssistantReply = messages.some(m => m.role === 'assistant');
    if (!hasAssistantReply) {
      await handleOptimize(false);
    } else {
      await handleOptimize(true, input);
      setInput('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Removed global optimized_prompt preload to keep prompts scoped per session

  const startNewOptimization = () => {
    // Prevent creating multiple empty sessions; reuse current if empty
    const hasContent = messages.length > 0 || Boolean(optimizedPrompt);
    if (!hasContent && sessionId) {
      // Focus compose area instead of creating a new one
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
      toast('Compose your first message to start this chat');
      return;
    }
    router.push('/optimize');
  };

  const goHomeAndRefresh = () => {
    router.push('/');
    if (typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 50);
    }
  };

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-900 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:text-white transition-colors">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* History Sidebar */}
        {showHistory && (
        <aside id="history" className="lg:col-span-1 rounded-xl p-4 h-[78vh] overflow-y-auto bg-white border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700" aria-busy={loadingSession}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Context History</h2>
            <button
              onClick={startNewOptimization}
              className="text-xs px-2 py-1 rounded bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-sm hover:from-cyan-400 hover:to-indigo-600 disabled:opacity-50"
              aria-label="New chat"
            >New</button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400">No past chats yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...sessions]
                .sort((a,b)=>{
                  if (b.updatedAt === a.updatedAt) return a.id.localeCompare(b.id);
                  return b.updatedAt - a.updatedAt;
                })
                .map((s) => (
                <li key={s.id} className="group">
                  <div className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-slate-200 hover:bg-white dark:bg-gray-800/40 dark:border-gray-700 dark:hover:bg-gray-800 transition-all ${s.id===sessionId?'ring-2 ring-blue-500/30':''}`}>
                    <Link href={`/optimize/${s.id}`} aria-current={s.id===sessionId ? 'page' : undefined} className="flex-1 text-left min-w-0">
                      {editingId===s.id ? (
                        <input
                          value={editingTitle}
                          onChange={(e)=>setEditingTitle(e.target.value)}
                          onKeyDown={(e)=>{ if(e.key==='Enter'){ saveRename(s.id); } if(e.key==='Escape'){ cancelRename(); } }}
                          onBlur={()=>saveRename(s.id)}
                          autoFocus
                          className="w-full bg-white/70 dark:bg-gray-900/20 border border-slate-300 dark:border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/30 shadow-sm"
                          title="Rename chat"
                        />
                      ) : (
                        <>
                          <div className="truncate">{s.title || 'Untitled'}</div>
                          <div className="text-xs text-gray-400">{new Date(s.updatedAt).toLocaleString()}</div>
                        </>
                      )}
                    </Link>
                    {editingId!==s.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {confirmDeleteId===s.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e)=>{ e.preventDefault(); deleteSession(s.id); setConfirmDeleteId(null); }}
                              className="px-2 py-1 rounded-md bg-red-500 text-white text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/40 shadow-sm"
                              title="Confirm delete"
                              aria-label={`Confirm delete ${s.title}`}
                            >Delete</button>
                            <button
                              onClick={(e)=>{ e.preventDefault(); setConfirmDeleteId(null); }}
                              className="px-2 py-1 rounded-md bg-slate-200 text-slate-800 text-xs hover:bg-slate-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                              title="Cancel"
                            >Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={(e)=>{ e.preventDefault(); beginRename(s.id, s.title || 'Untitled'); }}
                              className="p-1.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                              aria-label={`Rename ${s.title}`}
                              title="Rename"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e)=>{ e.preventDefault(); setConfirmDeleteId(s.id); }}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-600 dark:hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                              aria-label={`Delete ${s.title}`}
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <button onClick={goHomeAndRefresh} className="w-full text-xs px-2 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600">Home & Refresh</button>
          </div>
        </aside>
        )}

        <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">Prompt Optimizer</h1>
          <button className="lg:hidden px-3 py-1.5 text-sm rounded-md bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100" onClick={()=>setShowHistory(v=>!v)} aria-expanded={showHistory} aria-controls="history">
            {showHistory? 'Hide' : 'Show'} History
          </button>
        </div>

        {/* Progress indicator during optimization/refinement */}
        {isLoading && (
          <div className="mb-3" aria-live="polite">
            <div className="progress" role="progressbar" aria-label="Processing" aria-valuetext="Processing">
              <div className="bar" />
            </div>
          </div>
        )}

        {/* Section: Conversation */}
        <div className="mb-2 text-sm font-medium text-slate-600 dark:text-gray-300">Conversation</div>
        {/* Chat window */}
        <div ref={chatRef} className="rounded-xl p-4 h-[70vh] overflow-y-auto space-y-4 bg-white border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700" aria-busy={loadingSession}>
          {loadingSession ? (
            <div className="text-center text-gray-400 py-12">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <FiArrowRight className="mx-auto w-8 h-8 text-gray-500 mb-2" />
              Start by entering your prompt below. After the first optimization, continue refining with follow-up messages.
            </div>
          ) : (
            messages.map((m, i) => {
              const key = `${m.role}-${i}-${(m.content || '').slice(0, 24)}`;
              return (
              <div key={key} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-200 text-slate-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'}`}>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{m.content}</pre>
                  {m.role === 'assistant' && m.explanations && m.explanations.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {m.explanations.map((ex, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-slate-700 dark:text-gray-200">
                          <FiCheckCircle className="shrink-0 text-green-400 w-4 h-4 mt-0.5" />
                          <span className="text-sm leading-snug">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );})
          )}
        </div>

        {/* Section: Current Optimized Prompt */}
        {!loadingSession && optimizedPrompt && (
          <div className="mt-4 rounded-xl p-4 bg-white border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Current Optimized Prompt</h2>
              <button onClick={() => copyToClipboard(optimizedPrompt)} className="flex items-center text-sm text-slate-600 hover:text-slate-800 dark:text-gray-300 dark:hover:text-white">
                <FiCopy className="mr-1.5 w-4 h-4" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{optimizedPrompt}</pre>
          </div>
        )}

        {/* Input composer */}
        {/* Section: Compose */}
        <div className="mt-6 mb-1 text-sm font-medium text-slate-600 dark:text-gray-300">Compose</div>
        <form onSubmit={handleSend} className="mt-2 flex items-end space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e)=>{
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) handleSend(e as any); }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (input.trim()) handleSend(e as any); }
            }}
            placeholder={messages.some(m=>m.role==='assistant') ? 'Refinement instructions...' : 'Enter your prompt...'}
            className="flex-1 h-24 p-3 rounded-xl bg-white border border-slate-300 text-slate-900 transition-all resize-none
                       focus:outline-none focus:ring-4 focus:ring-cyan-400/30 focus:border-cyan-300
                       hover:shadow-[0_0_16px_rgba(34,211,238,0.12)]
                       dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-cyan-400/20"
            disabled={isLoading || !isApiKeyValid || loadingSession}
          />
          <button
            type="submit"
            disabled={isLoading || !isApiKeyValid || !input.trim() || loadingSession}
            className="h-10 px-4 flex items-center justify-center rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-700 focus:ring-4 focus:ring-cyan-400/30"
          >
            {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
