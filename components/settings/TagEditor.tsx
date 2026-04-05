"use client";

import { useState } from "react";

interface TagEditorProps {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}

export default function TagEditor({ label, tags, onAdd, onRemove, placeholder }: TagEditorProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInput("");
    }
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-claude-secondary mb-1.5">{label}</label>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-claude-hover text-claude-secondary text-sm px-2.5 py-1 rounded-lg"
          >
            {tag}
            <button
              onClick={() => onRemove(tag)}
              className="text-claude-tertiary hover:text-claude-secondary ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}...`}
          className="border border-claude-border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}
