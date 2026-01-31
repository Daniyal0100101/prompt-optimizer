import {
  useEffect,
  useRef,
  useState,
  useCallback,
  FormEvent,
  KeyboardEvent,
  useMemo,
  ComponentProps,
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
  Lightbulb,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSelectedModel, ModelId } from "../utils/modelConfig";
import { SECRET_KEY } from "../utils/config";
import { decryptSafe, getIV } from "../utils/cryptoUtils";
import { generateSessionName } from "../utils/sessionNaming";
import EmptyState from "./ui/EmptyState";
import SessionCard from "./ui/SessionCard";

if (
  !process.env.NEXT_PUBLIC_SECRET_KEY &&
  process.env.NODE_ENV !== "production"
) {
  console.warn(
    "NEXT_PUBLIC_SECRET_KEY is not defined in environment variables"
  );
}

// --- Type Definitions ---

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  explanations?: string[];
  suggestions?: string[];
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

// --- Coaching State Persistence ---

interface CoachingState {
  qaActive: boolean;
  qaQuestions: string[];
  qaAnswers: string[];
  qaSuggestion?: string;
}

const getCoachingStateKey = (sessionId: string) => `coaching:${sessionId}`;

const saveCoachingState = (sessionId: string, state: CoachingState) => {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    localStorage.setItem(getCoachingStateKey(sessionId), JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save coaching state", e);
  }
};

const loadCoachingState = (sessionId: string): CoachingState | null => {
  if (typeof window === "undefined" || !sessionId) return null;
  try {
    const raw = localStorage.getItem(getCoachingStateKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as CoachingState;
  } catch (e) {
    console.warn("Failed to load coaching state", e);
    return null;
  }
};

const clearCoachingState = (sessionId: string) => {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    localStorage.removeItem(getCoachingStateKey(sessionId));
  } catch (e) {
    console.warn("Failed to clear coaching state", e);
  }
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
    useState<ModelId>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState(apiKeyProp || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] =
    useState(false);
  // Clarify/Refine flow state
  const [qaActive, setQaActive] = useState(false);
  const [qaQuestions, setQaQuestions] = useState<string[]>([]);
  const [qaAnswers, setQaAnswers] = useState<string[]>([]);
  const [qaSuggestion, setQaSuggestion] = useState<string | undefined>(
    undefined
  );
  const [isClarifying, setIsClarifying] = useState(false);
  const [isRefiningWithAnswers, setIsRefiningWithAnswers] = useState(false);
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

  // Persist desktop sidebar collapsed state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("desktop_sidebar_collapsed");
      setIsDesktopSidebarCollapsed(saved === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "desktop_sidebar_collapsed",
        isDesktopSidebarCollapsed ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, [isDesktopSidebarCollapsed]);

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

        // Restore coaching state if present
        const coachingState = loadCoachingState(sessionId);
        if (coachingState) {
          setQaActive(coachingState.qaActive);
          setQaQuestions(coachingState.qaQuestions);
          setQaAnswers(coachingState.qaAnswers);
          setQaSuggestion(coachingState.qaSuggestion);
        }
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
        const title = firstUserMessage?.content 
          ? generateSessionName(firstUserMessage.content)
          : "New Chat";

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

          // Limit to 50 most recent sessions to prevent LocalStorage quota issues
          const MAX_SESSIONS = 50;
          const cleanedSessions = sorted.slice(0, MAX_SESSIONS);

          // Remove old session data from localStorage
          if (sorted.length > MAX_SESSIONS) {
            const removedSessions = sorted.slice(MAX_SESSIONS);
            removedSessions.forEach((session) => {
              try {
                localStorage.removeItem(`chat:${session.id}`);
                localStorage.removeItem(`coaching:${session.id}`);
              } catch (error) {
                console.error("Failed to remove old session", error);
              }
            });
          }

          localStorage.setItem(
            "chat_sessions",
            JSON.stringify(cleanedSessions)
          );
          return cleanedSessions;
        });
      } catch (e) {
        console.warn("Failed to save session data", e);
      }
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sessionId, messages, loadingSession]);

  // Auto-save coaching state whenever QA state changes
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId || loadingSession) return;

    const coachingState: CoachingState = {
      qaActive,
      qaQuestions,
      qaAnswers,
      qaSuggestion,
    };

    // Only save if there's active coaching state
    if (qaActive || qaQuestions.length > 0) {
      saveCoachingState(sessionId, coachingState);
    }
  }, [
    sessionId,
    qaActive,
    qaQuestions,
    qaAnswers,
    qaSuggestion,
    loadingSession,
  ]);

  const handleOptimize = async (
    isRefinement = false,
    instruction?: string,
    silent = false
  ) => {
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

    // Only add user message if not silent (silent mode is for applying suggestions directly)
    const currentMessages = silent
      ? messages
      : [...messages, { role: "user" as const, content }];

    if (!silent) {
      setMessages(currentMessages);
      setInput("");
    }

    try {
      const lastUser =
        [...messages].reverse().find((m) => m.role === "user")?.content ||
        input ||
        "";
      const previousPromptCandidate = (
        latestOptimizedPrompt ||
        lastUser ||
        ""
      ).trim();
      const isValidRefine = isRefinement && previousPromptCandidate.length > 0;

      const payload = isValidRefine
        ? {
            model: selectedModel,
            apiKey,
            refinementInstruction: content,
            previousPrompt: previousPromptCandidate,
          }
        : {
            model: selectedModel,
            apiKey,
            // Fall back to an initial optimize when we don't yet have a prior prompt
            prompt: isRefinement ? lastUser || content : content,
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
        suggestions: data.suggestions || [],
      };

      setMessages([...currentMessages, newAssistantMessage]);
      toast.success(
        silent
          ? "Suggestion applied successfully"
          : isRefinement
          ? "Prompt refined"
          : "Prompt optimized"
      );
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

  const handleSuggestionClick = async (suggestion: string) => {
    if (!suggestion?.trim()) return;
    if (!isApiKeyValid) {
      toast.error("Please configure your API key in Settings.");
      return;
    }
    if (isClarifying || isLoading) return; // prevent double-clicks while loading

    try {
      setIsClarifying(true);
      setQaActive(false);
      setQaQuestions([]);
      setQaAnswers([]);
      setQaSuggestion(suggestion);

      const lastUser =
        [...messages].reverse().find((m) => m.role === "user")?.content ||
        input ||
        "";
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "clarify",
          model: selectedModel,
          apiKey,
          prompt: lastUser,
          selectedSuggestion: suggestion,
          previousOptimizedPrompt: latestOptimizedPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "Failed to get clarifying questions.");
      const qs: string[] = Array.isArray(data?.questions)
        ? data.questions.slice(0, 4)
        : [];

      if (qs.length === 0) {
        // Clean up clarifying state BEFORE applying suggestion
        setIsClarifying(false);
        setQaSuggestion(undefined);

        // When no questions, apply the suggestion silently (no user message added)
        await handleOptimize(true, suggestion, true); // true = silent mode
        return;
      }

      setQaQuestions(qs);
      setQaAnswers(new Array(qs.length).fill(""));
      setQaActive(true);
    } catch (e) {
      const msg =
        (e as Error).message || "Unable to fetch clarifying questions.";
      console.warn(msg);
      toast.error(msg);
    } finally {
      // Only reset if we're showing the Q&A form (not if we applied silently)
      if (!isLoading) {
        setIsClarifying(false);
      }
    }
  };

  const handleRefineFromQA = async (
    providedAnswers?: Array<{ question: string; answer: string }>
  ) => {
    if (!isApiKeyValid) {
      toast.error("Please configure your API key in Settings.");
      return;
    }
    try {
      setIsRefiningWithAnswers(true);
      const pairs =
        providedAnswers ??
        qaQuestions.map((q, i) => ({
          question: q,
          answer: qaAnswers[i] || "",
        }));

      // Safety check: if no answers provided, don't proceed
      if (!pairs || pairs.length === 0) {
        throw new Error("Missing answers for refine task.");
      }

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "refine",
          model: selectedModel,
          apiKey,
          previousOptimizedPrompt: latestOptimizedPrompt,
          answers: pairs,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "Failed to refine with answers.");

      const newAssistantMessage: ChatMessage = {
        role: "assistant",
        content: data.optimizedPrompt || "",
        explanations: data.explanations || [],
        suggestions: data.suggestions || [],
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
      setQaActive(false);
      setQaQuestions([]);
      setQaAnswers([]);
      setQaSuggestion(undefined);

      // Clear coaching state from localStorage when user completes the refinement
      clearCoachingState(sessionId);

      toast.success("Refined with your details");
    } catch (e) {
      const msg = (e as Error).message || "Refinement failed.";
      console.error(msg);
      toast.error(msg);
    } finally {
      setIsRefiningWithAnswers(false);
    }
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

  const HistoryPanel = () => {
    const historyRef = useRef<HTMLDivElement | null>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const updateHistoryScrollState = useCallback(() => {
      const el = historyRef.current;
      if (!el) return;
      const up = el.scrollTop > 8;
      const down = el.scrollTop < el.scrollHeight - el.clientHeight - 8;
      setCanScrollUp(up);
      setCanScrollDown(down);
    }, []);

    useEffect(() => {
      updateHistoryScrollState();
    });

    const safeScrollTo = (top: number) => {
      const el = historyRef.current;
      if (!el) return;
      try {
        el.scrollTo({ top, behavior: "smooth" as ScrollBehavior });
      } catch {
        el.scrollTop = top;
      }
    };

    return (
      <aside
        className="relative flex flex-col h-screen max-h-screen overflow-hidden w-full max-w-sm 
                 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 shadow-lg"
      >
        <div className="p-2 border-b border-slate-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
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

        <div
          ref={historyRef}
          onScroll={updateHistoryScrollState}
          className="flex-1 overflow-y-auto scrollbar-thin pr-1 -mr-1"
          tabIndex={0}
          aria-label="Conversation history"
        >
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

        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col gap-2">
          {canScrollDown && (
            <button
              onClick={() =>
                safeScrollTo(historyRef.current?.scrollHeight || 0)
              }
              className="pointer-events-auto px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors"
              aria-label="Scroll to bottom"
            >
              Bottom
            </button>
          )}
          {canScrollUp && (
            <button
              onClick={() => safeScrollTo(0)}
              className="pointer-events-auto px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors"
              aria-label="Scroll to top"
            >
              Top
            </button>
          )}
        </div>
      </aside>
    );
  };

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isHistoryOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isHistoryOpen]);

  return (
    <div className="h-screen overflow-hidden flex bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300"
          onClick={() => setIsHistoryOpen(false)}
          aria-label="Close sidebar overlay"
          style={{
            opacity: isHistoryOpen ? 1 : 0,
            pointerEvents: isHistoryOpen ? "auto" : "none",
          }}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-[100svh] z-50 transition-all duration-300 ease-in-out lg:hidden will-change-transform ${
          isHistoryOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          boxShadow: isHistoryOpen ? "0 0 20px rgba(0, 0, 0, 0.1)" : "none",
        }}
      >
        <div className="w-72 sm:w-80 h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto overscroll-contain bg-white dark:bg-gray-900">
          <HistoryPanel />
        </div>
      </div>

      <div
        className={`hidden lg:flex h-full transition-all duration-300 ease-in-out ${
          isDesktopSidebarCollapsed ? "lg:w-0" : "lg:w-80"
        }`}
        aria-hidden={isDesktopSidebarCollapsed}
      >
        <div
          className={`relative w-full h-full ${
            isDesktopSidebarCollapsed
              ? "opacity-0 pointer-events-none -ml-2"
              : "opacity-100"
          } transition-all duration-300 ease-in-out`}
          style={{
            boxShadow: isDesktopSidebarCollapsed
              ? "none"
              : "4px 0 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <HistoryPanel />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <main className="flex-1 flex flex-col min-h-0 max-w-[2000px] w-full mx-auto">
          <header className="sticky top-0 z-30 flex items-center justify-between p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-gray-800/80 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200 active:scale-95 active:bg-slate-200 dark:active:bg-gray-700"
                onClick={() => setIsHistoryOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                className="hidden lg:inline-flex p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200"
                onClick={() => setIsDesktopSidebarCollapsed((v) => !v)}
                aria-label={
                  isDesktopSidebarCollapsed
                    ? "Expand sidebar"
                    : "Collapse sidebar"
                }
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

          <div
            className="flex-1 overflow-y-auto bg-gradient-to-b from-white/80 to-indigo-50 dark:from-gray-900/80 dark:to-gray-950 
                scroll-pb-28 sm:scroll-pb-32 scrollbar-thin px-4 sm:px-6 lg:px-8"
          >
            <div className="max-w-4xl mx-auto w-full">
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
                <div className="py-2 sm:py-3 space-y-3 sm:space-y-4">
                  {messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={`flex gap-2 px-2 sm:px-3 py-1.5 animate-slide-in ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {m.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <Cpu className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] rounded-xl px-3 sm:px-3 py-2.5 shadow-lg transition-all duration-300 hover:shadow-xl ${
                          m.role === "user"
                            ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white"
                            : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700"
                        }`}
                      >
                        <div className="text-sm leading-relaxed break-words">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: (props: ComponentProps<"p">) => (
                                <p className="mb-2" {...props} />
                              ),
                              ul: (props: ComponentProps<"ul">) => (
                                <ul
                                  className="list-disc pl-5 my-2 space-y-1"
                                  {...props}
                                />
                              ),
                              ol: (props: ComponentProps<"ol">) => (
                                <ol
                                  className="list-decimal pl-5 my-2 space-y-1"
                                  {...props}
                                />
                              ),
                              li: (props: ComponentProps<"li">) => (
                                <li
                                  className="marker:text-slate-400 dark:marker:text-gray-500"
                                  {...props}
                                />
                              ),
                              a: (props: ComponentProps<"a">) => (
                                <a
                                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  {...props}
                                />
                              ),
                              code: (
                                props: ComponentProps<"code"> & {
                                  inline?: boolean;
                                }
                              ) => {
                                if (props.inline) {
                                  return (
                                    <code
                                      className="px-1 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-[0.85em]"
                                      {...props}
                                    />
                                  );
                                }
                                return (
                                  <pre className="my-3">
                                    <code
                                      className="block p-3 rounded-lg bg-slate-950/90 text-slate-50 overflow-x-auto text-[0.85em]"
                                      {...props}
                                    />
                                  </pre>
                                );
                              },
                              h1: (props: ComponentProps<"h1">) => (
                                <h1
                                  className="text-lg font-semibold mt-2 mb-2"
                                  {...props}
                                />
                              ),
                              h2: (props: ComponentProps<"h2">) => (
                                <h2
                                  className="text-base font-semibold mt-2 mb-2"
                                  {...props}
                                />
                              ),
                              h3: (props: ComponentProps<"h3">) => (
                                <h3
                                  className="text-sm font-semibold mt-2 mb-1"
                                  {...props}
                                />
                              ),
                              blockquote: (
                                props: ComponentProps<"blockquote">
                              ) => (
                                <blockquote
                                  className="border-l-4 border-slate-300 dark:border-gray-600 pl-3 my-2 text-slate-700 dark:text-gray-300"
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        {m.role === "assistant" && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-gray-700">
                            <button
                              onClick={() =>
                                copyToClipboard(m.content, `msg-${i}`)
                              }
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
                        {m.suggestions && m.suggestions.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-gray-700">
                            <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                              SUGGESTED NEXT STEPS:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {m.suggestions.map((s, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSuggestionClick(s)}
                                  disabled={isClarifying}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 transition-colors ${
                                    isClarifying
                                      ? "opacity-60 cursor-not-allowed"
                                      : "hover:bg-slate-100 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                  <span className="line-clamp-1 max-w-[220px] sm:max-w-[300px] text-left">
                                    {s}
                                  </span>
                                </button>
                              ))}
                            </div>
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
                      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl px-4 py-3 w-full max-w-[80%]">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 mb-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          Optimizing your prompt...
                        </div>
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-3/5"></div>
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-11/12"></div>
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  {isClarifying && !qaActive && (
                    <div className="flex gap-3 px-2 sm:px-4 py-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Cpu className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl px-4 py-3 w-full max-w-[80%]">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 mb-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          Preparing clarifying questions...
                        </div>
                        <div className="space-y-3 animate-pulse">
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-2/3"></div>
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
                          <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  {qaActive && (
                    <div className="flex gap-3 px-2 sm:px-4 py-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Cpu className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl px-4 py-3 w-full max-w-[80%]">
                        <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                          Clarifying questions
                          {qaSuggestion ? ` for: "${qaSuggestion}"` : ""}
                        </h4>
                        <div className="space-y-3">
                          {qaQuestions.map((q, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="text-xs text-slate-700 dark:text-gray-300">
                                {q}
                              </div>
                              <input
                                type="text"
                                value={qaAnswers[idx] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQaAnswers((prev) => {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  });
                                }}
                                className="w-full rounded-md border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Your answer"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            disabled={
                              isRefiningWithAnswers || qaQuestions.length === 0
                            }
                            onClick={() => handleRefineFromQA()}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-indigo-800 transition-colors"
                          >
                            {isRefiningWithAnswers
                              ? "Refining..."
                              : "Refine Now"}
                          </button>
                          <button
                            disabled={isRefiningWithAnswers}
                            onClick={() => {
                              setQaActive(false);
                              setQaQuestions([]);
                              setQaAnswers([]);
                              setQaSuggestion(undefined);
                              // Clear coaching state from localStorage when user cancels
                              clearCoachingState(sessionId);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-700 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          </div>

          {latestOptimizedPrompt && (
            <div className="p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-slate-200/50 dark:border-gray-800/50 shadow-md">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    copyToClipboard(latestOptimizedPrompt, "latest")
                  }
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
            className="sticky bottom-0 z-30 p-2 sm:p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-slate-200/50 dark:border-gray-800/50 shadow-md pb-[calc(env(safe-area-inset-bottom)+0.5rem)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent overflow-hidden"
          >
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  messages.length === 0
                    ? "Enter a prompt to optimize..."
                    : "Ask for refinements..."
                }
                className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 sm:px-3 py-2.5 text-sm 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent overflow-y-auto max-h-32
                         placeholder:text-slate-500 dark:placeholder:text-gray-500 transition-all duration-200"
                rows={1}
                disabled={!isApiKeyValid}
                aria-label="Prompt input"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !isApiKeyValid}
                className="h-[42px] self-end px-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105
                         flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                aria-label="Send prompt"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            {!isApiKeyValid && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 px-1">
                API key required. Visit Settings to configure.
              </div>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}
