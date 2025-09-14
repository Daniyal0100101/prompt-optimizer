"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  FiEdit2,
  FiTrash2,
  FiSend,
  FiSettings,
  FiClock,
  FiGrid,
  FiList,
  FiPlus,
} from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi2";
import { useRouter } from "next/navigation";
import * as CryptoJS from "crypto-js";

const SECRET_KEY = "uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=";

export default function Home() {
  const [hasKey, setHasKey] = useState(false);
  const [sessions, setSessions] = useState<
    { id: string; title: string; updatedAt: number }[]
  >([]);
  const [homeInput, setHomeInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchFilter, setSearchFilter] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const newId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gemini-api-key");
      if (!saved) return setHasKey(false);
      const decrypted = CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(
        CryptoJS.enc.Utf8
      );
      setHasKey(Boolean(decrypted));
    } catch {
      setHasKey(false);
    }
    try {
      const raw = localStorage.getItem("chat_sessions");
      if (raw) setSessions(JSON.parse(raw));
    } catch {}

    // Load view preference
    const savedView = localStorage.getItem("view_mode");
    if (savedView === "list") setViewMode("list");
  }, []);

  useEffect(() => {
    // Auto-resize textarea with smooth animation
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 56), 160);
      textareaRef.current.style.height = newHeight + "px";
    }
  }, [homeInput]);

  const persistSessions = (list: typeof sessions) => {
    setSessions(list);
    try {
      localStorage.setItem("chat_sessions", JSON.stringify(list));
    } catch {}
  };

  const handleStartFromHome = async () => {
    const text = homeInput.trim();
    if (!text || isStarting) return;
    if (!hasKey) {
      router.push("/settings");
      return;
    }

    setIsStarting(true);
    const id = newId();
    try {
      const saved = localStorage.getItem("gemini-api-key");
      const decrypted = saved
        ? CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8)
        : "";
      if (!decrypted) {
        router.push("/settings");
        return;
      }

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: "gemini-1.5-flash",
          apiKey: decrypted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to optimize");

      const optimizedPrompt: string = data?.optimizedPrompt || "";
      const explanations: string[] = Array.isArray(data?.explanations)
        ? data.explanations
        : [];

      const messages = [
        { role: "user", content: text },
        { role: "assistant", content: optimizedPrompt, explanations },
      ];
      try {
        localStorage.setItem(
          `chat:${id}`,
          JSON.stringify({ messages, optimizedPrompt })
        );
      } catch {}

      const title = text.slice(0, 80);
      const list = [
        { id, title, updatedAt: Date.now() },
        ...sessions.filter((s) => s.id !== id),
      ];
      setSessions(list);
      try {
        localStorage.setItem("chat_sessions", JSON.stringify(list));
      } catch {}

      router.push(`/optimize/${id}`);
    } catch (e: any) {
      console.error("Start from home failed", e);
      alert(e?.message || "Failed to optimize prompt. Please try again.");
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
    const list = sessions.map((s) =>
      s.id === id ? { ...s, title: editingTitle } : s
    );
    persistSessions(list);
    setEditingId(null);
    setEditingTitle("");
  };

  const deleteSession = (id: string) => {
    const list = sessions.filter((s) => s.id !== id);
    persistSessions(list);
    try {
      localStorage.removeItem(`chat:${id}`);
    } catch {}
    setConfirmDeleteId(null);
  };

  const toggleViewMode = () => {
    const newMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(newMode);
    localStorage.setItem("view_mode", newMode);
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const quickPrompts = [
    "Explain this concept",
    "Write a clear summary",
    "Generate a detailed report",
    "Write a persuasive essay",
    "Write a humorous tweet",
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Header Section - More compact */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 text-xs font-semibold text-blue-700 bg-blue-100/80 rounded-full backdrop-blur-sm dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50"
            style={{ userSelect: "none" }}
          >
            <HiOutlineSparkles className="w-3 h-3" />
            AI-Powered Optimization
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 tracking-tight mb-3">
            Prompt Optimizer
          </h1>

          <p className="text-sm md:text-base text-slate-600 dark:text-gray-400 max-w-xl mx-auto">
            Transform your prompts into high-performance instructions with
            AI-driven optimization
          </p>
        </div>

        {/* Futuristic Interactive Input Section */}
        <div className="relative mb-12">
          <div
            className={`relative bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-gray-900/95 dark:to-gray-800/95 rounded-2xl shadow-2xl backdrop-blur-sm transition-all duration-500 ease-out ${
              isFocused
                ? "ring-2 ring-offset-2 ring-blue-500/50 shadow-2xl shadow-blue-500/20 dark:shadow-blue-400/10"
                : "ring-1 ring-slate-200/80 dark:ring-gray-700/80 hover:ring-slate-300/80 dark:hover:ring-gray-600/80"
            }`}
            style={{
              boxShadow: isFocused
                ? "0 10px 30px -10px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1)"
                : "0 4px 20px -4px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* Status indicator */}
            {!hasKey && (
              <div className="absolute -top-2 left-6 px-3 py-1 bg-gradient-to-r from-amber-400/90 to-orange-400/90 dark:from-amber-600/90 dark:to-orange-600/90 text-white text-xs font-medium rounded-full shadow-md backdrop-blur-sm">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                API Key Required
              </div>
            )}

            <div className="p-5">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <textarea
                  ref={textareaRef}
                  value={homeInput}
                  onChange={(e) => setHomeInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleStartFromHome();
                    }
                  }}
                  placeholder={
                    hasKey
                      ? "What would you like to optimize today?"
                      : "Please add your API key in Settings first"
                  }
                  disabled={!hasKey}
                  className="w-full min-h-[64px] max-h-[200px] p-5 pr-20 text-base bg-transparent border-none relative z-10
                           text-slate-900 dark:text-gray-100 transition-all duration-300 ease-out resize-none
                           placeholder:text-slate-400/80 dark:placeholder:text-gray-500/80
                           focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                           scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300/50 dark:scrollbar-thumb-gray-600/50
                           font-medium tracking-wide leading-relaxed"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, transparent 0%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    backgroundPosition: homeInput.trim() ? "0% 0%" : "100% 0%",
                    transition: "background-position 1s ease-out",
                    textShadow: "0 1px 1px rgba(0,0,0,0.02)",
                  }}
                />

                {/* Enhanced send button with better accessibility and hover effects */}
                <div className="absolute bottom-4 right-4 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isStarting && hasKey && homeInput.trim()) {
                        handleStartFromHome();
                      }
                    }}
                    disabled={isStarting || !hasKey || !homeInput.trim()}
                    className={`p-3.5 rounded-xl transition-all duration-300 transform
                      ${
                        homeInput.trim() && hasKey && !isStarting
                          ? "cursor-pointer bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                          : "bg-slate-100/80 dark:bg-gray-800/80 text-slate-400 dark:text-gray-600 cursor-not-allowed"
                      }`}
                    aria-label={
                      isStarting ? "Optimizing..." : "Optimize prompt"
                    }
                    aria-disabled={isStarting || !hasKey || !homeInput.trim()}
                    title={
                      !hasKey
                        ? "Please add your API key in Settings"
                        : !homeInput.trim()
                        ? "Enter a prompt to optimize"
                        : "Optimize prompt"
                    }
                  >
                    {isStarting ? (
                      <span className="sr-only">Optimizing...</span>
                    ) : (
                      <span className="sr-only">Optimize prompt</span>
                    )}
                    {isStarting ? (
                      <div
                        className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <FiSend className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                  {/* Tooltip for better UX */}
                  {(!homeInput.trim() || !hasKey) && (
                    <div className="absolute -top-10 right-0 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                      {!hasKey
                        ? "Add API key in Settings"
                        : "Enter a prompt to optimize"}
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced footer with animated elements */}
              <div className="flex items-center justify-between mt-4 text-xs">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-gray-500 group">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/80 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                    </span>
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded-md text-xs font-mono font-bold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600">
                      Enter
                    </kbd>{" "}
                    to optimize
                  </span>
                  {!hasKey && (
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1.5 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium transition-colors group"
                    >
                      <FiSettings className="w-3.5 h-3.5 transition-transform group-hover:rotate-45" />
                      Setup API Key
                    </Link>
                  )}
                </div>
                <span
                  className={`tabular-nums ${
                    homeInput.length > 800
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                  }`}
                >
                  {homeInput.length}/1000
                </span>
              </div>
            </div>
          </div>

          {/* Quick prompt suggestions */}
          {!homeInput && hasKey && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setHomeInput(prompt)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-gray-800 rounded-full
                           hover:bg-slate-200 dark:hover:bg-gray-700 hover:text-slate-800 dark:hover:text-gray-200 
                           transition-all duration-200 border border-transparent hover:border-slate-300 dark:hover:border-gray-600"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sessions Section */}
        {sessions.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <FiClock className="w-5 h-5 text-slate-500" />
                Recent Optimizations
              </h2>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 dark:placeholder:text-gray-500 w-32 sm:w-40"
                />

                <button
                  onClick={toggleViewMode}
                  className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                           hover:bg-slate-50 dark:hover:bg-gray-750 transition-colors text-slate-600 dark:text-gray-400"
                  aria-label="Toggle view mode"
                >
                  {viewMode === "grid" ? (
                    <FiList className="w-4 h-4" />
                  ) : (
                    <FiGrid className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 px-6 bg-white/50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
                <div className="max-w-sm mx-auto">
                  <FiClock className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-gray-600" />
                  <h3 className="text-base font-semibold text-slate-700 dark:text-gray-300 mb-1">
                    {searchFilter
                      ? "No matching sessions"
                      : "No optimizations yet"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-gray-500">
                    {searchFilter
                      ? "Try adjusting your search"
                      : "Start by entering a prompt above"}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-3"
                }
              >
                {filteredSessions.map((session, idx) => (
                  <div
                    key={session.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(idx)}
                    className={`group relative bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800
                             hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg
                             transition-all duration-200 cursor-move overflow-hidden
                             ${viewMode === "grid" ? "p-4" : "p-3"}`}
                  >
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {editingId === session.id ? (
                      <div className="space-y-3">
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(session.id);
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditingTitle("");
                            }
                          }}
                          className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveRename(session.id)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditingTitle("");
                            }}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirmDeleteId === session.id ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                          Delete this session?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
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
                          <h3 className="font-semibold text-slate-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                            {session.title || "Untitled Session"}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
                            <FiClock className="w-3 h-3" />
                            <span>{formatRelativeTime(session.updatedAt)}</span>
                          </div>
                        </button>

                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestRename(session.id, session.title);
                            }}
                            className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Rename"
                          >
                            <FiEdit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(session.id);
                            }}
                            className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                            aria-label="Delete"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state for new users */}
        {sessions.length === 0 && (
          <div className="text-center py-12 px-6 bg-gradient-to-br from-white to-slate-50/50 dark:from-gray-900 dark:to-gray-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <HiOutlineSparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-gray-300 mb-2">
                Ready to optimize your prompts?
              </h3>
              <p className="text-sm text-slate-500 dark:text-gray-500 mb-6">
                Enter any prompt above and watch our AI transform it into a
                high-performance instruction
              </p>
              {hasKey ? (
                <button
                  onClick={() => textareaRef.current?.focus()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl
                           hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 hover:scale-105"
                >
                  <FiPlus className="w-4 h-4" />
                  Start Optimizing
                </button>
              ) : (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl
                           hover:from-amber-600 hover:to-orange-700 transition-all duration-200 hover:scale-105"
                >
                  <FiSettings className="w-4 h-4" />
                  Setup API Key
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
