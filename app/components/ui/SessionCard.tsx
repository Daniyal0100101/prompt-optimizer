"use client";

import Link from "next/link";
import { useState } from "react";
import { FiEdit2, FiTrash2, FiClock } from "react-icons/fi";

interface Session {
  id: string;
  title: string;
  updatedAt: number;
}

interface SessionCardProps {
  session: Session;
  viewMode: "grid" | "list";
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  formatTime: (timestamp: number) => string;
}

const SessionCard = ({
  session,
  viewMode,
  onRename,
  onDelete,
  formatTime,
}: SessionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);

  const handleSaveRename = () => {
    onRename(session.id, editTitle.trim() || "Untitled");
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(session.title);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(session.id);
    setIsDeleting(false);
  };

  if (isEditing) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 
                      shadow-sm hover:shadow-md transition-all duration-200 ${
                        viewMode === "grid" ? "p-4" : "p-3"
                      }`}
      >
        <div className="space-y-3">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveRename();
              if (e.key === "Escape") handleCancelEdit();
            }}
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveRename}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg 
                       hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 
                       bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-800 
                      shadow-sm ${viewMode === "grid" ? "p-4" : "p-3"}`}
      >
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
            Delete &quot;{session.title}&quot;?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg 
                       hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              Delete
            </button>
            <button
              onClick={() => setIsDeleting(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 
                       bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800
                    hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg
                    transition-all duration-200 overflow-hidden ${
                      viewMode === "grid" ? "p-4" : "p-3"
                    }`}
    >
      {/* Hover accent line */}
      <div
        className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 
                     opacity-0 group-hover:opacity-100 transition-opacity"
      />

      <Link href={`/optimize/${session.id}`} className="block">
        <h3
          className="font-semibold text-slate-900 dark:text-gray-100 line-clamp-2 mb-2 
                     group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors 
                     text-sm leading-relaxed"
        >
          {session.title || "Untitled Session"}
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
          <FiClock className="w-3 h-3" />
          <span className="font-medium">{formatTime(session.updatedAt)}</span>
        </div>
      </Link>

      {/* Action buttons */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 
                     transition-opacity duration-200"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-slate-100 dark:hover:bg-gray-700 
                   transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
          aria-label="Rename session"
        >
          <FiEdit2 className="w-3 h-3 text-slate-600 dark:text-gray-400" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDeleting(true);
          }}
          className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-red-50 dark:hover:bg-red-900/20 
                   text-red-600 dark:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm"
          aria-label="Delete session"
        >
          <FiTrash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default SessionCard;
