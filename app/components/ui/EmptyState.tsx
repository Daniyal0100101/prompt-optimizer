"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action, 
  className = "" 
}: EmptyStateProps) => {
  return (
    <div className={`text-center py-12 px-6 bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-gray-900/80 dark:to-gray-800/80 
                    rounded-2xl border border-dashed border-slate-300 dark:border-gray-700 backdrop-blur-sm ${className}`}>
      <div className="max-w-md mx-auto">
        {icon && (
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-3">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 leading-relaxed">
          {description}
        </p>
        {action && (
          <div className="flex justify-center">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
