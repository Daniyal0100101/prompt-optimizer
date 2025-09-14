"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  FormEvent,
  KeyboardEvent,
} from "react";
import {
  FiCopy,
  FiCheckCircle,
  FiRefreshCw,
  FiSend,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiMessageSquare,
  FiUser,
  FiCpu,
  FiMenu,
  FiX,
  FiHome,
  FiSettings,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import * as CryptoJS from "crypto-js";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSelectedModel } from "../utils/modelConfig";

const SECRET_KEY = "uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=";

interface PromptOptimizerProps {
  apiKey?: string;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  explanations?: string[];
};

export default function PromptOptimizer({
  apiKey: apiKeyProp,
}: PromptOptimizerProps) {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKey, setApiKey] = useState(apiKeyProp || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState<{ [key: number]: boolean }>({});
  const FIXED_BACKEND_MODEL = "gemini-1.5-flash";
  const [sessions, setSessions] = useState<
    { id: string; title: string; updatedAt: number }[]
  >([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const saveTimer = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- Core Logic ---

  const loadApiKeyFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("gemini-api-key");
      if (saved) {
        const decrypted = CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(
          CryptoJS.enc.Utf8
        );
        if (decrypted) setApiKey(decrypted);
      }

      const model = getSelectedModel();
      setSelectedModel(model);
    } catch (e) {
      console.error("Failed to load settings from storage", e);
    }
  }, []);

  useEffect(() => {
    if (!apiKeyProp) {
      loadApiKeyFromStorage();
    }
  }, [apiKeyProp, loadApiKeyFromStorage]);

  useEffect(() => {
    setIsApiKeyValid(Boolean(apiKeyProp || apiKey));
  }, [apiKeyProp, apiKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawList = localStorage.getItem("chat_sessions");
      const listParsed: { id: string; title: string; updatedAt: number }[] =
        rawList ? JSON.parse(rawList) : [];
      if (rawList) setSessions(listParsed);

      setLoadingSession(true);
      setMessages([]);

      if (sessionId) {
        const raw = localStorage.getItem(`chat:${sessionId}`);
        const data = raw ? JSON.parse(raw) : null;
        const loadedMessages: ChatMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : [];
        setMessages(loadedMessages);
      }
      setLoadingSession(false);
    } catch (e) {
      console.warn("Failed to load session data", e);
      setLoadingSession(false);
    }
  }, [sessionId]);

  const latestOptimizedPrompt =
    messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId || loadingSession || messages.length === 0) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const existingRaw = localStorage.getItem(`chat:${sessionId}`);
        const nextPayload = { messages };
        if (
          existingRaw &&
          JSON.stringify(JSON.parse(existingRaw)) ===
            JSON.stringify(nextPayload)
        ) {
          return;
        }

        localStorage.setItem(`chat:${sessionId}`, JSON.stringify(nextPayload));

        const firstUser = messages.find((m) => m.role === "user");
        const title = (firstUser?.content || "New Optimization").slice(0, 80);
        const list = [...sessions];
        const idx = list.findIndex((s) => s.id === sessionId);
        const entry = { id: sessionId, title, updatedAt: Date.now() };

        if (idx >= 0) list[idx] = entry;
        else list.unshift(entry);

        const sortedList = list.sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(sortedList);
        localStorage.setItem("chat_sessions", JSON.stringify(sortedList));
      } catch (e) {
        console.warn("Failed to save session data", e);
      }
    }, 500);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [sessionId, messages, loadingSession, sessions]);

  const handleOptimize = async (isRefinement = false, instruction?: string) => {
    if (!isApiKeyValid) {
      toast.error("Please configure your API key in Settings");
      return;
    }
    if (!isRefinement && !input.trim()) {
      toast.error("Please enter a prompt to optimize");
      return;
    }
    if (isRefinement && !(instruction || "").trim()) {
      toast.error("Please enter refinement instructions");
      return;
    }

    setIsLoading(true);
    const userMessageContent = isRefinement ? instruction || "" : input.trim();
    const currentMessages = [
      ...messages,
      { role: "user", content: userMessageContent },
    ] as ChatMessage[];
    setMessages(currentMessages);
    setInput("");

    try {
      const payload: any = {
        prompt: isRefinement ? latestOptimizedPrompt : input,
        model: selectedModel || FIXED_BACKEND_MODEL,
        apiKey,
      };
      if (isRefinement) {
        payload.refinementInstruction = instruction;
        payload.previousPrompt = latestOptimizedPrompt || input;
      }

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to process your request");
      }

      const data = await response.json();
      const newAssistantMessage: ChatMessage = {
        role: "assistant",
        content: data.optimizedPrompt || "",
        explanations: data.explanations || [],
      };

      setMessages([...currentMessages, newAssistantMessage]);
      toast.success(isRefinement ? "Prompt refined" : "Prompt optimized");
    } catch (error: any) {
      console.error("Optimization error:", error);
      toast.error(error.message || "An error occurred");
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const hasAssistantReply = messages.some((m) => m.role === "assistant");
    handleOptimize(hasAssistantReply, input);
  };

  const copyToClipboard = (text: string, messageIndex: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [messageIndex]: true }));
      toast.success("Copied to clipboard");
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [messageIndex]: false }));
      }, 2000);
    }
  };

  const startNewOptimization = () => {
    router.push("/optimize");
  };

  const deleteSession = (id: string) => {
    const list = sessions.filter((s) => s.id !== id);
    setSessions(list);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("chat_sessions", JSON.stringify(list));
        localStorage.removeItem(`chat:${id}`);
      } catch {}
    }
    if (id === sessionId) {
      router.push("/");
    }
    setConfirmDeleteId(null);
  };

  const saveRename = (id: string) => {
    const title = editingTitle.trim() || "Untitled";
    const list = sessions.map((s) => (s.id === id ? { ...s, title } : s));
    setSessions(list);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("chat_sessions", JSON.stringify(list));
      } catch {}
    }
    setEditingId(null);
    setEditingTitle("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 160;
      textareaRef.current.style.height = `${Math.min(
        scrollHeight,
        maxHeight
      )}px`;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as FormEvent);
    }
  };

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

  // --- Render Components ---

  const HistoryPanel = () => (
    <aside className="flex flex-col h-full w-full max-w-sm bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 shadow-lg">
      <div className="p-4 border-b border-slate-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900 dark:text-gray-100 text-lg">
            History
          </h2>
          <button
            onClick={startNewOptimization}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
            aria-label="New Chat"
          >
            <FiPlus className="w-3 h-3" />
            New
          </button>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <FiHome className="w-3 h-3" />
            Home
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <FiSettings className="w-3 h-3" />
            Settings
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sessions.length === 0 ? (
          <div className="text-center text-sm text-slate-500 dark:text-gray-500 mt-8 animate-fade-in">
            <FiMessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="group relative">
                {editingId === s.id ? (
                  <div className="p-3 border border-blue-300 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(s.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingTitle("");
                        }
                      }}
                      className="w-full text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => saveRename(s.id)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingTitle("");
                        }}
                        className="px-2 py-1 text-xs bg-slate-200 dark:bg-gray-700 rounded hover:bg-slate-300 dark:hover:bg-gray-600 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmDeleteId === s.id ? (
                  <div className="p-3 border border-red-300 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                      Delete this chat?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-all duration-200"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs bg-slate-200 dark:bg-gray-700 rounded hover:bg-slate-300 dark:hover:bg-gray-600 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/optimize/${s.id}`}
                    className={`block p-3 rounded-lg transition-all duration-200 transform hover:scale-102 ${
                      s.id === sessionId
                        ? "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 shadow-md"
                        : "hover:bg-slate-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate mb-1">
                      {s.title || "Untitled Chat"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-500">
                      {formatRelativeTime(s.updatedAt)}
                    </p>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingId(s.id);
                          setEditingTitle(s.title || "");
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-700 transition-all duration-200"
                        title="Rename"
                      >
                        <FiEdit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDeleteId(s.id);
                        }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-all duration-200"
                        title="Delete"
                      >
                        <FiTrash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full z-40 transition-transform duration-300 lg:hidden ${
          isHistoryOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="w-80 h-full">
          <HistoryPanel />
        </div>
      </div>

      <div className="hidden lg:flex lg:w-80">
        <HistoryPanel />
      </div>

      <main className="flex-1 flex flex-col h-screen">
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 shadow-md">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200"
              onClick={() => setIsHistoryOpen(true)}
              aria-label="Open sidebar"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100">
              Prompt Optimizer
            </h1>
          </div>
          {!isApiKeyValid && (
            <Link
              href="/settings"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all duration-200"
            >
              <FiSettings className="w-3 h-3" />
              Setup Required
            </Link>
          )}
        </header>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white/80 to-indigo-50 dark:from-gray-900/80 dark:to-gray-950">
          {loadingSession ? (
            <div className="flex justify-center items-center h-full text-slate-500 dark:text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading chat...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <FiMessageSquare className="w-8 h-8 text-blue-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-2">
                Ready to optimize
              </h2>
              <p className="text-slate-600 dark:text-gray-400 max-w-md">
                Enter a prompt below and let AI transform it into a
                high-performance instruction
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`flex gap-3 px-4 py-2 animate-slide-in ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <FiCpu className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-lg transition-all duration-300 hover:shadow-xl ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white"
                        : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.content}
                    </div>
                    {m.role === "assistant" && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-gray-700">
                        <button
                          onClick={() => copyToClipboard(m.content, i)}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                        >
                          {copied[i] ? (
                            <FiCheckCircle className="w-3 h-3" />
                          ) : (
                            <FiCopy className="w-3 h-3" />
                          )}
                          {copied[i] ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                    {m.explanations && m.explanations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-gray-700">
                        <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                          IMPROVEMENTS MADE:
                        </h4>
                        <ul className="space-y-1.5">
                          {m.explanations.map((ex, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-xs text-slate-700 dark:text-gray-300"
                            >
                              <FiCheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-md">
                      <FiUser className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <FiCpu className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Optimizing your prompt...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {latestOptimizedPrompt && (
          <div className="p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-slate-200/50 dark:border-gray-800/50 shadow-md">
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(latestOptimizedPrompt, -1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-all duration-200 transform hover:scale-105"
              >
                {copied[-1] ? (
                  <FiCheckCircle className="w-4 h-4" />
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
                Copy Latest
              </button>
              <button
                onClick={startNewOptimization}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 transform hover:scale-105"
              >
                <FiRefreshCw className="w-4 h-4" />
                New Chat
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-slate-200/50 dark:border-gray-800/50 shadow-md"
        >
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length === 0
                  ? "Enter a prompt to optimize..."
                  : "Ask for refinements or enter a new prompt..."
              }
              className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       placeholder:text-slate-500 dark:placeholder:text-gray-500 transition-all duration-200"
              rows={1}
              disabled={!isApiKeyValid}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !isApiKeyValid}
              className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105
                       flex items-center gap-2 font-medium"
            >
              <FiSend className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          {!isApiKeyValid && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              API key required. Visit Settings to configure.
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
