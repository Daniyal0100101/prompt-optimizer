"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import {
  FiSettings,
  FiClock,
  FiGrid,
  FiList,
  FiPlus,
} from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi2";
import { useRouter } from "next/navigation";
import * as CryptoJS from "crypto-js";
import { toast } from "react-hot-toast";
import { decryptSafe } from "./utils/cryptoUtils";
import TextareaInput from "./components/ui/TextareaInput";
import QuickPrompts from "./components/ui/QuickPrompts";
import EmptyState from "./components/ui/EmptyState";
import SessionCard from "./components/ui/SessionCard";

const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY as string;

if (!SECRET_KEY) {
  throw new Error("NEXT_PUBLIC_SECRET_KEY is not defined");
}

// --- Type Definitions ---

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

// --- Helper Functions ---

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatRelativeTime = (timestamp: number): string => {
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

// --- Main Component ---

export default function Home() {
  const [hasKey, setHasKey] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [homeInput, setHomeInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchFilter, setSearchFilter] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      // Check for API key
      const savedKey = localStorage.getItem("API_KEY");
      if (savedKey) {
        const result = decryptSafe(
          savedKey,
          SECRET_KEY,
          undefined, // IV will be handled by decryptSafe
          CryptoJS.mode.CBC,
          CryptoJS.pad.Pkcs7
        );
        
        if (result.ok && result.plaintext) {
          setHasKey(true);
        } else {
          console.warn('Failed to decrypt API key');
          if (!result.ok) {
            const errorResult = result as { reason?: string };
            console.warn('Reason:', errorResult.reason || 'Unknown error');
          }
          setHasKey(false);
        }
      }

      const rawSessions = localStorage.getItem("chat_sessions");
      if (rawSessions) {
        setSessions(JSON.parse(rawSessions));
      }

      const savedView = localStorage.getItem("view_mode");
      if (savedView === "list" || savedView === "grid") {
        setViewMode(savedView);
      }
    } catch (error) {
      console.error("Error loading from localStorage", error);
      // Clear potentially corrupted data
      localStorage.removeItem("API_KEY");
      localStorage.removeItem("chat_sessions");
      setHasKey(false);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const { scrollHeight } = textareaRef.current;
      const newHeight = Math.min(Math.max(scrollHeight, 56), 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [homeInput]);

  const persistSessions = useCallback((updatedSessions: Session[]) => {
    setSessions(updatedSessions);
    try {
      localStorage.setItem("chat_sessions", JSON.stringify(updatedSessions));
    } catch (error) {
      console.error("Failed to save sessions", error);
    }
  }, []);

  const handleStartFromHome = async (e: FormEvent) => {
    e.preventDefault();
    const text = homeInput.trim();
    if (!text || isStarting) return;

    if (!hasKey) {
      router.push("/settings");
      return;
    }

    setIsStarting(true);
    const id = newId();

    try {
      const savedKey = localStorage.getItem("API_KEY");
      if (!savedKey) {
        router.push("/settings");
        throw new Error("API key not found in localStorage.");
      }

      const result = decryptSafe(
        savedKey,
        SECRET_KEY,
        undefined,
        CryptoJS.mode.CBC,
        CryptoJS.pad.Pkcs7
      );

      if (!result.ok || !result.plaintext) {
        console.error('Failed to decrypt API key:', result);
        toast.error("Invalid or corrupted API key. Please re-enter in settings.");
        router.push("/settings");
        return;
      }

      const decryptedKey = result.plaintext;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: "gemini-1.5-flash",
          apiKey: decryptedKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to optimize prompt.");
      }

      const messages = [
        { role: "user", content: text },
        {
          role: "assistant",
          content: data.optimizedPrompt || "",
          explanations: data.explanations || [],
        },
      ];

      localStorage.setItem(`chat:${id}`, JSON.stringify({ messages }));

      const newSession: Session = { id, title: text.slice(0, 80), updatedAt: Date.now() };
      persistSessions([newSession, ...sessions]);

      router.push(`/optimize/${id}`);
    } catch (error: unknown) {
      const errorMessage = (error as Error).message || "An unknown error occurred.";
      console.error("Start from home failed", errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const saveRename = (id: string) => {
    const updatedSessions = sessions.map((s) =>
      s.id === id ? { ...s, title: editingTitle.trim() || "Untitled" } : s
    );
    persistSessions(updatedSessions);
    setEditingId(null);
    setEditingTitle("");
  };

  const deleteSession = (id: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== id);
    persistSessions(updatedSessions);
    try {
      localStorage.removeItem(`chat:${id}`);
    } catch (error) {
      console.error("Failed to remove session item", error);
    }
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

  const quickPrompts = [
    "Explain this concept simply",
    "Summarize this article",
    "Generate a report on market trends",
    "Write a persuasive email",
    "Create a funny tweet about AI",
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        <header className="text-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-indigo-400/20 blur-3xl -z-10" />
            <div
              className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-semibold text-blue-700 bg-gradient-to-r from-blue-100/90 to-indigo-100/90 rounded-full backdrop-blur-sm dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shadow-lg"
              style={{ userSelect: "none" }}
            >
              <HiOutlineSparkles className="w-4 h-4 animate-pulse" />
              AI-Powered Optimization
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black gradient-text tracking-tight mb-4 leading-tight">
              Prompt Optimizer
            </h1>

            <p className="text-base md:text-lg text-slate-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Transform your ideas into high-performance instructions with AI-driven
              optimization. Get better results with smarter prompts.
            </p>
          </div>
        </header>

        <form onSubmit={handleStartFromHome} className="relative mb-12">
          {!hasKey && (
            <div className="absolute -top-3 left-6 z-30 px-3 py-1.5 bg-gradient-to-r from-amber-500/95 to-orange-500/95 dark:from-amber-600/95 dark:to-orange-600/95 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm border border-white/20">
              <span className="relative flex h-2 w-2 mr-2 inline-block">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              API Key Required
            </div>
          )}
          
          <TextareaInput
            ref={textareaRef}
            value={homeInput}
            onChange={setHomeInput}
            onSubmit={() => handleStartFromHome({} as FormEvent)}
            placeholder={
              hasKey
                ? "What would you like to optimize today?"
                : "Please add your API key in Settings first."
            }
            disabled={!hasKey}
            isLoading={isStarting}
            maxLength={1000}
            submitButtonText="Optimize"
          />

          {!homeInput && hasKey && (
            <div className="mt-8">
              <div className="text-center mb-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Try these popular prompts
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">
                  Click any suggestion to get started quickly
                </p>
              </div>
              <QuickPrompts
                prompts={quickPrompts}
                onSelect={setHomeInput}
              />
            </div>
          )}

          {!hasKey && (
            <div className="mt-6 text-center">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200/50 dark:border-amber-800/50">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FiSettings className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                  Get Started
                </h3>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                  Add your API key to start optimizing prompts with AI
                </p>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl
                           hover:from-amber-600 hover:to-orange-700 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-lg"
                >
                  <FiSettings className="w-4 h-4" />
                  Setup API Key
                </Link>
              </div>
            </div>
          )}
        </form>

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
              <EmptyState
                icon={<FiClock className="w-8 h-8 text-white" />}
                title={searchFilter ? "No matching sessions" : "No optimizations yet"}
                description={searchFilter ? "Try adjusting your search terms." : "Start by entering a prompt above to create your first optimization."}
              />
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-3"
                }
              >
                {filteredSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    viewMode={viewMode}
                    onRename={(id, newTitle) => {
                      const updatedSessions = sessions.map((s) =>
                        s.id === id ? { ...s, title: newTitle } : s
                      );
                      persistSessions(updatedSessions);
                    }}
                    onDelete={(id) => {
                      const updatedSessions = sessions.filter((s) => s.id !== id);
                      persistSessions(updatedSessions);
                      try {
                        localStorage.removeItem(`chat:${id}`);
                      } catch (error) {
                        console.error("Failed to remove session item", error);
                      }
                    }}
                    formatTime={formatRelativeTime}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {sessions.length === 0 && (
          <EmptyState
            icon={<HiOutlineSparkles className="w-8 h-8 text-white" />}
            title="Ready to optimize your prompts?"
            description="Enter any prompt above and watch our AI transform it into a high-performance instruction."
            action={
              hasKey ? (
                <button
                  onClick={() => textareaRef.current?.focus()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl
                           hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <FiPlus className="w-4 h-4" />
                  Start Optimizing
                </button>
              ) : (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl
                           hover:from-amber-600 hover:to-orange-700 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <FiSettings className="w-4 h-4" />
                  Setup API Key
                </Link>
              )
            }
          />
        )}
      </div>
    </main>
  );
}
