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
  maxLength?: number;
  minHeight?: number;
  submitButtonText?: string;
}

export default forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  function TextareaInput(
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Enter your text here...",
      disabled = false,
      isLoading = false,
      maxLength = 2000,
      minHeight = 120,
      submitButtonText = "Submit",
    },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const [charCount, setCharCount] = useState(value.length);

    useEffect(() => {
      setCharCount(value.length);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        onChange(newValue);
        setCharCount(newValue.length);
      }
    };

    const handleSubmit = () => {
      if (onSubmit && value.trim() && !disabled && !isLoading) {
        onSubmit();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const isNearLimit = charCount > maxLength * 0.8;
    const isAtLimit = charCount >= maxLength;
    const canSubmit = value.trim() && !disabled && !isLoading;

    return (
      <div className="relative group">
        {/* Animated background glow */}
        <div className={`absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 rounded-3xl blur-xl transition-all duration-500 ${
          isFocused ? "opacity-100 scale-105" : "opacity-0 scale-95"
        }`} />
        
        <div
          className={`relative rounded-2xl border-2 backdrop-blur-sm transition-all duration-300 ${
            isFocused
              ? "border-blue-500 shadow-2xl shadow-blue-500/25 bg-white/95 dark:bg-gray-800/95"
              : "border-slate-200/80 dark:border-gray-700/80 hover:border-slate-300 dark:hover:border-gray-600 bg-white/90 dark:bg-gray-800/90 hover:bg-white/95 dark:hover:bg-gray-800/95"
          } ${disabled ? "opacity-60" : ""}`}
        >
          {/* Inner gradient border effect */}
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-indigo-500/10 transition-opacity duration-300 ${
            isFocused ? "opacity-100" : "opacity-0"
          }`} />
          
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={`relative w-full resize-none rounded-2xl bg-transparent px-4 sm:px-6 py-4 sm:py-5 pr-14 sm:pr-18 text-sm sm:text-base text-slate-900 dark:text-gray-100 placeholder:text-slate-500 dark:placeholder:text-gray-500 focus:outline-none transition-all duration-200 leading-relaxed`}
            style={{ minHeight: `${Math.max(minHeight, 120)}px` }}
            aria-label="Text input"
          />

          {onSubmit && (
            <div className="absolute bottom-4 sm:bottom-5 right-4 sm:right-5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`relative p-3 sm:p-3.5 rounded-xl transition-all duration-300 transform min-h-[48px] min-w-[48px] touch-manipulation group ${
                  canSubmit
                    ? "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-110 active:scale-95 focus:ring-2 focus:ring-blue-500/50"
                    : "bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 cursor-not-allowed"
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
                {/* Button glow effect */}
                {canSubmit && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400/50 to-indigo-400/50 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
                
                <div className="relative">
                  {isLoading ? (
                    <div
                      className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  )}
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 sm:mt-5 text-xs">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="inline-flex items-center gap-2 text-slate-600 dark:text-gray-400 font-medium bg-slate-50/80 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-gray-700/60 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/80 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="hidden xs:inline">Press</span>{" "}
              <kbd className="px-2 py-1 bg-gradient-to-b from-white to-slate-100 dark:from-gray-600 dark:to-gray-700 rounded-md text-xs font-mono font-bold text-slate-700 dark:text-gray-200 border border-slate-300 dark:border-gray-600 shadow-sm">
                Enter
              </kbd>{" "}
              <span className="hidden xs:inline">to send</span>
            </span>
          </div>
          <span
            className={`tabular-nums font-semibold px-3 py-1.5 rounded-full border backdrop-blur-sm ${
              isAtLimit
                ? "text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 border-red-200/60 dark:border-red-800/60"
                : isNearLimit
                ? "text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/60"
                : "text-slate-600 dark:text-gray-400 bg-slate-50/80 dark:bg-gray-800/50 border-slate-200/60 dark:border-gray-700/60"
            }`}
          >
            {value.length}/{maxLength}
          </span>
        </div>
      </div>
    );
  }
);
