"use client";

interface QuickPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  className?: string;
}

const QuickPrompts = ({
  prompts,
  onSelect,
  className = "",
}: QuickPromptsProps) => {
  return (
    <div className={`flex flex-wrap gap-3 justify-center ${className}`}>
      {prompts.map((prompt, index) => (
        <button
          key={`${prompt}-${index}`}
          type="button"
          onClick={() => onSelect(prompt)}
          className="group relative px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-300 
                   bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-slate-200/80 dark:border-gray-700/80
                   hover:bg-white dark:hover:bg-gray-800 hover:border-slate-300 dark:hover:border-gray-600
                   hover:text-slate-900 dark:hover:text-gray-100 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-gray-900/50
                   transition-all duration-200 hover:scale-105 active:scale-95
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <span className="relative z-10">{prompt}</span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  );
};

export default QuickPrompts;
