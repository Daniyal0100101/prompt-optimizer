"use client";

import { forwardRef, useState, useEffect } from "react";
import { Send } from "lucide-react";

interface TextareaInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingStage?: string;
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  className?: string;
}

const TextareaInput = forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Enter your text here...",
      disabled = false,
      isLoading = false,
      loadingStage,
      minHeight = 64,
      maxHeight = 200,
      showSubmitButton = true,
      submitButtonText = "Send",
      className = "",
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (ref && typeof ref === "object" && ref.current) {
        const textarea = ref.current;
        textarea.style.height = "auto";
        const newHeight = Math.min(
          Math.max(textarea.scrollHeight, minHeight),
          maxHeight
        );
        textarea.style.height = `${newHeight}px`;
      }
    }, [value, minHeight, maxHeight, ref]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    };

    const canSubmit = value.trim() && !disabled && !isLoading;

    return (
      <div
        className={`relative bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-gray-900/95 dark:to-gray-800/95
                   rounded-2xl shadow-xl backdrop-blur-sm transition-all duration-200 ease-out
                   ${
                     isFocused
                       ? "ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/10 dark:shadow-blue-400/5"
                       : "ring-1 ring-slate-200/80 dark:ring-gray-700/80 hover:ring-slate-300/80 dark:hover:ring-gray-600/80"
                   } ${className}`}
      >
        {isLoading && loadingStage && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5 dark:from-blue-400/10 dark:via-purple-400/10 dark:to-indigo-400/10 rounded-2xl z-30 backdrop-blur-[2px] animate-pulse">
            <div className="flex items-center justify-center h-full">
              <div className="bg-white/95 dark:bg-gray-800/95 rounded-xl px-6 py-4 shadow-2xl border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-6 h-6 border-3 border-blue-500/30 dark:border-blue-400/30 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-6 h-6 border-3 border-transparent border-t-purple-500/40 dark:border-t-purple-400/40 rounded-full animate-spin-reverse"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900 dark:text-gray-100 animate-pulse">
                      {loadingStage}
                    </span>
                    <div className="flex gap-1 mt-1">
                      <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce-delay-0"></span>
                      <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce-delay-150"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce-delay-300"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="relative">
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              style={{
                minHeight: `${minHeight}px`,
                maxHeight: `${maxHeight}px`,
              }}
              className="w-full p-4 pr-16 text-base bg-transparent border-none relative z-10
                       text-slate-900 dark:text-gray-100 transition-all duration-200 ease-out resize-none
                       placeholder:text-slate-500/90 dark:placeholder:text-gray-500/90 placeholder:font-normal
                       focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                       scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300/50 dark:scrollbar-thumb-gray-600/50
                       font-medium tracking-wide leading-relaxed"
            />

            {showSubmitButton && (
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 transform
                    ${
                      canSubmit
                        ? "cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                        : "bg-slate-100/80 dark:bg-gray-800/80 text-slate-400 dark:text-gray-600 cursor-not-allowed"
                    }`}
                  aria-label={isLoading ? "Loading..." : submitButtonText}
                  title={
                    disabled
                      ? "Please complete setup first"
                      : !value.trim()
                      ? "Enter text to continue"
                      : submitButtonText
                  }
                >
                  {isLoading ? (
                    <div
                      className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-gray-500 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/80 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
              </span>
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700/80 rounded text-[0.7rem] font-mono font-medium text-slate-700 dark:text-gray-200 border border-slate-200/80 dark:border-gray-600/80">
                Enter
              </kbd>{" "}
              to send
            </span>
          </div>
        </div>
      </div>
    );
  }
);

TextareaInput.displayName = "TextareaInput";

export default TextareaInput;
