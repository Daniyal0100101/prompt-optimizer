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
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import * as CryptoJS from "crypto-js";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  const [apiKey, setApiKey] = useState(apiKeyProp || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState(false);
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
      if (!saved) return;
      const decrypted = CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(
        CryptoJS.enc.Utf8
      );
      if (decrypted) setApiKey(decrypted);
    } catch (e) {
      console.error("Failed to load API key from storage", e);
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

  // Debounced session saving
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
    if (!isApiKeyValid) return toast.error("Please enter a valid API key");
    if (!isRefinement && !input.trim())
      return toast.error("Please enter a prompt to optimize");
    if (isRefinement && !(instruction || "").trim())
      return toast.error("Please enter refinement instructions");

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
        model: FIXED_BACKEND_MODEL,
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

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startNewOptimization = () => {
    const hasContent = messages.length > 0;
    if (!hasContent && sessionId) {
      toast("Compose your first message to start this chat");
      textareaRef.current?.focus();
      return;
    }
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
      const maxHeight = 200;
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

  // --- Render Components ---

  const HistoryPanel = () => (
    <aside className="flex flex-col h-full w-full max-w-sm p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-r border-slate-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">History</h2>
        <button
          onClick={startNewOptimization}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          aria-label="New Optimization"
        >
          <FiPlus /> New
        </button>
      </div>
      {sessions.length === 0 ? (
        <div className="text-center text-sm text-gray-400 mt-8">
          No past chats yet.
        </div>
      ) : (
        <ul className="space-y-2 overflow-y-auto flex-1">
          {sessions.map((s) => (
            <li key={s.id} className="group relative">
              <Link
                href={`/optimize/${s.id}`}
                className={`block w-full text-left p-3 rounded-lg transition-colors ${
                  s.id === sessionId
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                {editingId === s.id ? (
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveRename(s.id);
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => saveRename(s.id)}
                    autoFocus
                    className="w-full bg-transparent border-b border-blue-400 focus:outline-none"
                  />
                ) : (
                  <>
                    <p className="font-medium truncate text-sm">
                      {s.title || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </>
                )}
              </Link>
              {editingId !== s.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {confirmDeleteId === s.id ? (
                    <>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 text-xs"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-2 rounded-md bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-xs"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditingTitle(s.title || "Untitled");
                        }}
                        className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-700"
                        title="Rename"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="p-2 rounded-md text-red-500 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-zinc-900 dark:text-white">
      {/* Mobile History Drawer */}
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity lg:hidden ${
          isHistoryOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsHistoryOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 h-full z-40 transition-transform lg:hidden ${
          isHistoryOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <HistoryPanel />
      </div>

      {/* Desktop History Panel */}
      <div className="hidden lg:flex lg:w-80 xl:w-96">
        <HistoryPanel />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen">
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-600">
            Prompt Optimizer
          </h1>
          <button
            className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"
            onClick={() => setIsHistoryOpen(true)}
            aria-label="Open history"
          >
            <FiMenu />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {loadingSession ? (
            <div className="flex justify-center items-center h-full text-gray-400">
              Loading...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 h-full flex flex-col justify-center items-center">
              <FiMessageSquare className="w-12 h-12 text-gray-500 mb-4" />
              <h2 className="text-lg font-medium">Start a new optimization</h2>
              <p>Enter your initial prompt below to begin.</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`flex items-start gap-3 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shrink-0">
                      <FiCpu className="w-5 h-5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-100"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans">
                      {m.content}
                    </pre>
                    {m.explanations && m.explanations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-zinc-700/50">
                        <h3 className="text-xs font-semibold mb-2 text-slate-600 dark:text-zinc-400">
                          IMPROVEMENTS
                        </h3>
                        <ul className="space-y-2">
                          {m.explanations.map((ex, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-slate-700 dark:text-gray-200"
                            >
                              <FiCheckCircle className="shrink-0 text-green-400 mt-0.5" />
                              <span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white shrink-0">
                      <FiUser className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shrink-0">
                    <FiCpu className="w-5 h-5" />
                  </div>
                  <div className="px-4 py-3 rounded-xl text-sm bg-white border border-slate-200 text-slate-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-100">
                    Optimizing...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {latestOptimizedPrompt && (
          <div className="p-4 flex gap-2 border-t border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg">
            <button
              onClick={() => copyToClipboard(latestOptimizedPrompt)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors text-sm"
            >
              {copied ? <FiCheckCircle /> : <FiCopy />}
              {copied ? "Copied" : "Copy Optimized Prompt"}
            </button>
            <button
              onClick={() => handleOptimize(true, input)}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
            >
              <FiRefreshCw /> Refine Again
            </button>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt to optimize..."
              className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <FiSend /> Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
