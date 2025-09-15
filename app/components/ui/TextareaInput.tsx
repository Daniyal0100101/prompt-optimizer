"use client";

import { forwardRef, useState, useEffect } from "react";
import { FiSend } from "react-icons/fi";

interface TextareaInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
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
      maxLength = 1000,
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
    const isOverLimit = value.length > maxLength;

    return (
      <div
        className={`relative bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-gray-900/95 dark:to-gray-800/95 
                   rounded-2xl shadow-2xl backdrop-blur-sm transition-all duration-500 ease-out
                   ${
                     isFocused
                       ? "ring-2 ring-offset-2 ring-blue-500/50 shadow-2xl shadow-blue-500/20 dark:shadow-blue-400/10"
                       : "ring-1 ring-slate-200/80 dark:ring-gray-700/80 hover:ring-slate-300/80 dark:hover:ring-gray-600/80"
                   } ${className}`}
      >
        <div className="p-5">
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
              style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
              className="w-full p-5 pr-20 text-base bg-transparent border-none relative z-10
                       text-slate-900 dark:text-gray-100 transition-all duration-300 ease-out resize-none
                       placeholder:text-slate-500 dark:placeholder:text-gray-400 placeholder:font-medium
                       focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                       scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300/50 dark:scrollbar-thumb-gray-600/50
                       font-medium tracking-wide leading-relaxed"
            />

            {showSubmitButton && (
              <div className="absolute bottom-4 right-4 z-20">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className={`p-3.5 rounded-xl transition-all duration-300 transform
                    ${
                      canSubmit
                        ? "cursor-pointer bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
                      className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <FiSend className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-gray-400 font-medium">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/80 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                Press{" "}
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded-md text-xs font-mono font-bold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600">
                  Enter
                </kbd>{" "}
                to send
              </span>
            </div>
            <span
              className={`tabular-nums font-medium ${
                isOverLimit
                  ? "text-red-600 dark:text-red-400"
                  : value.length > maxLength * 0.8
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-600 dark:text-gray-400"
              }`}
            >
              {value.length}/{maxLength}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

TextareaInput.displayName = "TextareaInput";

export default TextareaInput;
