"use client";

import { useCallback, useEffect, useState } from "react";
import ApiKeyInput from "../components/ApiKeyInput";
import { useRouter } from "next/navigation";
import { useTheme, ThemeMode } from "../components/ThemeProvider";
import {
  FiSun,
  FiMoon,
  FiMonitor,
  FiCheck,
  FiKey,
  FiDroplet,
  FiArrowLeft,
  FiZap,
  FiInfo,
  FiExternalLink,
} from "react-icons/fi";

export default function SettingsPage() {
  const router = useRouter();
  const { themeMode, setTheme, mounted } = useTheme();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing API key on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("API_KEY");
      setHasApiKey(!!saved);

      // Get selected model
      const savedModel = localStorage.getItem("selected-model");
      setSelectedModel(savedModel || "gemini-2.5-flash");
    } catch {
      setHasApiKey(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleVerified = useCallback((ok: boolean) => {
    setHasApiKey(ok);
    if (ok) {
      // Don't auto-redirect, let user choose
      console.log("API key verified successfully");
    }
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  const themeOptions = [
    {
      value: "system" as ThemeMode,
      label: "System",
      icon: FiMonitor,
      description: "Follow system preference",
    },
    {
      value: "light" as ThemeMode,
      label: "Light",
      icon: FiSun,
      description: "Always use light mode",
    },
    {
      value: "dark" as ThemeMode,
      label: "Dark",
      icon: FiMoon,
      description: "Always use dark mode",
    },
  ];

  // Model info for display
  const modelInfo = {
    "gemini-1.5-flash": {
      name: "Gemini 1.5 Flash",
      description: "Fast and versatile for diverse tasks",
      features: ["1M context", "8K output", "Multimodal"],
    },
    "gemini-2.0-flash": {
      name: "Gemini 2.0 Flash",
      description: "Next-gen with superior speed",
      features: ["1M context", "8K output", "Tool use", "Live API"],
    },
    "gemini-2.5-flash": {
      name: "Gemini 2.5 Flash",
      description: "Best price-performance with thinking",
      features: ["1M context", "64K output", "Thinking", "Best value"],
    },
  };

  if (!mounted || isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-600 dark:text-gray-400">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Loading settings...
          </div>
        </div>
      </main>
    );
  }

  const currentModelInfo =
    modelInfo[selectedModel as keyof typeof modelInfo] ||
    modelInfo["gemini-2.5-flash"];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 
                       hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors text-slate-600 dark:text-gray-400
                       hover:text-slate-900 dark:hover:text-gray-100"
              aria-label="Go back"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-gray-100">
                Settings
              </h1>
              <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                Configure your API key, model preferences, and theme
              </p>
            </div>
          </div>

          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border transition-all duration-200 ${
              hasApiKey
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  hasApiKey
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-amber-100 dark:bg-amber-900/30"
                }`}
              >
                {hasApiKey ? (
                  <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <FiInfo className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <p
                  className={`font-medium text-sm ${
                    hasApiKey
                      ? "text-green-800 dark:text-green-200"
                      : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {hasApiKey ? "Ready to optimize" : "API key required"}
                </p>
                <p
                  className={`text-xs ${
                    hasApiKey
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {hasApiKey
                    ? "Your API key is configured and ready to use"
                    : "Add your Gemini API key to start optimizing prompts"}
                </p>
              </div>
            </div>
          </div>

          {/* API Configuration Section */}
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <FiKey className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                    API Configuration
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Set up your Gemini API key and choose your preferred model
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <ApiKeyInput
                onKeyVerified={handleVerified}
                onModelChange={handleModelChange}
              />

              {/* Current Model Display */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Selected Model:
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full">
                        {currentModelInfo.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                      {currentModelInfo.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentModelInfo.features.map((feature) => (
                        <span
                          key={feature}
                          className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md border border-gray-200 dark:border-gray-600"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* API Key Info */}
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 shadow-sm">
                <div className="flex gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex-shrink-0 h-fit">
                    <FiInfo className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Get your free API key
                    </p>
                    <p className="text-blue-800/90 dark:text-blue-200/90 mb-3">
                      Visit Google AI Studio to get your Gemini API key. It&apos;s
                      free with generous limits.
                    </p>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-colors px-3 py-1.5 bg-white dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800/50 hover:shadow-sm"
                    >
                      Get API Key
                      <FiExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Theme Configuration Section */}
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <FiDroplet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                    Appearance
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Choose how the app looks on your device
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = themeMode === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value)}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group hover:scale-[1.02]
                        ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md"
                            : "border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`p-2 rounded-lg flex items-center justify-center transition-all duration-200
                          ${
                            isSelected
                              ? "bg-blue-500 text-white shadow-sm"
                              : "bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-medium ${
                                isSelected
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-slate-900 dark:text-gray-100"
                              }`}
                            >
                              {option.label}
                            </span>
                            {isSelected && (
                              <div className="p-1 bg-blue-500 rounded-full">
                                <FiCheck className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <p
                        className={`text-xs ${
                          isSelected
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 dark:text-gray-500"
                        }`}
                      >
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push("/")}
              className="flex-1 px-6 py-3 text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 
                       border border-slate-200 dark:border-gray-700 rounded-xl 
                       hover:bg-slate-50 dark:hover:bg-gray-750 transition-all duration-200 
                       font-medium hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to Home
            </button>

            <button
              onClick={() => router.push(hasApiKey ? "/optimize" : "/")}
              disabled={!hasApiKey}
              className={`flex-1 px-6 py-3 rounded-xl transition-all duration-200 font-medium
                       hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2
                       ${
                         hasApiKey
                           ? "text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                           : "text-slate-400 dark:text-gray-600 bg-slate-100 dark:bg-gray-800 cursor-not-allowed border border-slate-200 dark:border-gray-700"
                       }`}
            >
              <FiZap className="w-4 h-4" />
              {hasApiKey ? "Start Optimizing" : "Add API Key First"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
