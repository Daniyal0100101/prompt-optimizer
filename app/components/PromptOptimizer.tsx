import {
  useEffect,
  useRef,
  useState,
  useCallback,
  FormEvent,
  KeyboardEvent,
  useMemo,
} from "react";
import {
  Copy,
  CheckCircle,
  RefreshCw,
  Send,
  Plus,
  MessageSquare,
  User,
  Cpu,
  Menu,
  Home,
  Settings,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSelectedModel, ModelId } from "../utils/modelConfig";
import { SECRET_KEY } from "../utils/config";
import { decryptSafe, getIV } from "../utils/cryptoUtils";
import EmptyState from "./ui/EmptyState";
import SessionCard from "./ui/SessionCard";

if (!process.env.NEXT_PUBLIC_SECRET_KEY) {
  console.warn(
    "NEXT_PUBLIC_SECRET_KEY is not defined in environment variables"
  );
}

// --- Type Definitions ---

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  explanations?: string[];
}

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

interface PromptOptimizerProps {
  apiKey?: string;
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

export default function PromptOptimizer({
  apiKey: apiKeyProp,
}: PromptOptimizerProps) {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  // --- State Management ---
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [selectedModel, setSelectedModel] =
    useState<ModelId>("gemini-1.5-flash");
  const [apiKey, setApiKey] = useState(apiKeyProp || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  // Removed inline rename/delete state in favor of reusable SessionCard component

  // --- Refs ---
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Memoized Values ---
  const latestOptimizedPrompt = useMemo(
    () =>
      messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content ||
      "",
    [messages]
  );

  // --- Callbacks and Effects ---
  const loadSettingsFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const savedKey = localStorage.getItem("API_KEY");
      if (savedKey) {
        const iv = getIV(SECRET_KEY);
        const result = decryptSafe(savedKey, SECRET_KEY, iv);

        if (result.ok && result.plaintext) {
          setApiKey(result.plaintext);
          setIsApiKeyValid(true);
        } else {
          console.warn("Failed to decrypt API key");
          setIsApiKeyValid(false);
        }
      } else {
        console.warn("No API key found in localStorage");
        setIsApiKeyValid(false);
      }
      setSelectedModel(getSelectedModel());
    } catch (e) {
      console.error("Failed to load settings from storage", e);
      // Clear potentially corrupted key
      localStorage.removeItem("API_KEY");
      setIsApiKeyValid(false);
    }
  }, []);

  useEffect(() => {
    if (!apiKeyProp) {
      loadSettingsFromStorage();
    } else {
      setApiKey(apiKeyProp);
      setIsApiKeyValid(true);
    }
  }, [apiKeyProp, loadSettingsFromStorage]);

  // Load sessions and current chat from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawList = localStorage.getItem("chat_sessions");
      const listParsed: Session[] = rawList ? JSON.parse(rawList) : [];
      setSessions(listParsed);

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
    } catch (e) {
      console.warn("Failed to load session data", e);
    } finally {
      setLoadingSession(false);
    }
  }, [sessionId]);

  // Auto-save session to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId || loadingSession) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      if (messages.length === 0) return;

      try {
        const payload = { messages };
        localStorage.setItem(`chat:${sessionId}`, JSON.stringify(payload));

        const firstUserMessage = messages.find((m) => m.role === "user");
        const title = (firstUserMessage?.content || "New Chat").slice(0, 80);

        setSessions((prevSessions) => {
          const existingIndex = prevSessions.findIndex(
            (s) => s.id === sessionId
          );
          const newEntry: Session = {
            id: sessionId,
            title,
            updatedAt: Date.now(),
          };

          let updatedSessions;
          if (existingIndex >= 0) {
            updatedSessions = [...prevSessions];
            updatedSessions[existingIndex] = newEntry;
          } else {
            updatedSessions = [newEntry, ...prevSessions];
          }

          const sorted = updatedSessions.sort(
            (a, b) => b.updatedAt - a.updatedAt
          );
          localStorage.setItem("chat_sessions", JSON.stringify(sorted));
          return sorted;
        });
      } catch (e) {
        console.warn("Failed to save session data", e);
      }
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sessionId, messages, loadingSession]);

  const handleOptimize = async (isRefinement = false, instruction?: string) => {
    if (!isApiKeyValid) {
      toast.error("Please configure your API key in Settings.");
      return;
    }
    const content = (isRefinement ? instruction : input)?.trim();
    if (!content) {
      toast.error(
        isRefinement
          ? "Please enter refinement instructions."
          : "Please enter a prompt to optimize."
      );
      return;
    }

    setIsLoading(true);
    const userMessage: ChatMessage = { role: "user", content };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");

    try {
      const payload = {
        model: selectedModel,
        apiKey,
        ...(isRefinement
          ? {
              refinementInstruction: content,
              previousPrompt: latestOptimizedPrompt || input,
            }
          : { prompt: content }),
      };

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process your request.");
      }

      const newAssistantMessage: ChatMessage = {
        role: "assistant",
        content: data.optimizedPrompt || "",
        explanations: data.explanations || [],
      };

      setMessages([...currentMessages, newAssistantMessage]);
      toast.success(isRefinement ? "Prompt refined" : "Prompt optimized");
    } catch (error: unknown) {
      const errorMessage =
        (error as Error).message || "An unknown error occurred.";
      console.error("Optimization error:", errorMessage);
      toast.error(errorMessage);
      // Revert to previous state on error
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [id]: true }));
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied((prev) => ({ ...prev, [id]: false })), 2000);
    });
  };

  const startNewOptimization = () => {
    router.push(`/optimize/${newId()}`);
  };

  // Renaming and deletion are handled within SessionCard mapped items below

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 160; // 10rem
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
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <Home className="w-3 h-3" />
            Home
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <Settings className="w-3 h-3" />
            Settings
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sessions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-6 h-6 text-white" />}
            title="No conversations yet"
            description="Start a new optimization to see your chat history here."
            className="mt-8"
          />
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`${
                  s.id === sessionId
                    ? "ring-2 ring-blue-200 dark:ring-blue-800"
                    : ""
                }`}
              >
                <SessionCard
                  session={s}
                  viewMode="list"
                  onRename={(id, newTitle) => {
                    const title = newTitle.trim() || "Untitled Chat";
                    const updatedSessions = sessions.map((session) =>
                      session.id === id ? { ...session, title } : session
                    );
                    setSessions(updatedSessions);
                    try {
                      localStorage.setItem(
                        "chat_sessions",
                        JSON.stringify(updatedSessions)
                      );
                    } catch (e) {
                      console.warn("Error renaming session:", e);
                    }
                  }}
                  onDelete={(id) => {
                    const updatedSessions = sessions.filter(
                      (session) => session.id !== id
                    );
                    setSessions(updatedSessions);
                    try {
                      localStorage.setItem(
                        "chat_sessions",
                        JSON.stringify(updatedSessions)
                      );
                      localStorage.removeItem(`chat:${id}`);
                    } catch (e) {
                      console.warn("Error deleting session:", e);
                    }
                    if (id === sessionId) {
                      router.push("/");
                    }
                  }}
                  formatTime={formatRelativeTime}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100svh] sm:min-h-screen flex bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsHistoryOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <div
        className={`fixed top-0 left-0 h-[100svh] z-40 transition-transform duration-300 lg:hidden ${
          isHistoryOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="w-80 h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <HistoryPanel />
        </div>
      </div>

      <div className="hidden lg:flex lg:w-80">
        <HistoryPanel />
      </div>

      <main className="flex-1 flex flex-col min-h-0">
        <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-slate-200 dark:border-gray-800 shadow-md">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200"
              onClick={() => setIsHistoryOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
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
              <Settings className="w-3 h-3" />
              Setup Required
            </Link>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-white/80 to-indigo-50 dark:from-gray-900/80 dark:to-gray-950 scroll-pb-28 sm:scroll-pb-32">
          {loadingSession ? (
            <div className="flex justify-center items-center h-full text-slate-500 dark:text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading chat...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4 sm:px-6">
              <EmptyState
                icon={<MessageSquare className="w-8 h-8 text-white" />}
                title="Ready to Optimize"
                description="Enter a prompt below and let AI transform it into a high-performance instruction."
                className="max-w-md"
              />
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`flex gap-3 px-2 sm:px-4 py-2 animate-slide-in ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <Cpu className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-3 shadow-lg transition-all duration-300 hover:shadow-xl ${
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
                          onClick={() => copyToClipboard(m.content, `msg-${i}`)}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                        >
                          {copied[`msg-${i}`] ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copied[`msg-${i}`] ? "Copied" : "Copy"}
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
                              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-md">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-4 h-4 text-white" />
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
                onClick={() => copyToClipboard(latestOptimizedPrompt, "latest")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-all duration-200 transform hover:scale-105"
              >
                {copied["latest"] ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy Latest
              </button>
              <button
                onClick={startNewOptimization}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 transform hover:scale-105"
              >
                <RefreshCw className="w-4 h-4" />
                New Chat
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="sticky bottom-0 z-30 p-3 sm:p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-slate-200/50 dark:border-gray-800/50 shadow-md pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
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
              className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 sm:px-4 py-3 text-sm 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       placeholder:text-slate-500 dark:placeholder:text-gray-500 transition-all duration-200"
              rows={1}
              disabled={!isApiKeyValid}
              aria-label="Prompt input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !isApiKeyValid}
              className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105
                       flex items-center gap-2 font-medium"
              aria-label="Send prompt"
            >
              <Send className="w-4 h-4" />
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
