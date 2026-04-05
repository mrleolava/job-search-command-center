"use client";

import { useState } from "react";

interface TagEditorProps {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  bankKeywords?: string[];
  onBankClick?: (keyword: string) => void;
  onSaveToBank?: (keyword: string) => void;
}

export default function TagEditor({
  label,
  tags,
  onAdd,
  onRemove,
  placeholder,
  bankKeywords,
  onBankClick,
  onSaveToBank,
}: TagEditorProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      onSaveToBank?.(trimmed);
      setInput("");
    }
  }

  // Bank keywords not currently active
  const availableBank = (bankKeywords ?? []).filter(
    (kw) => !tags.some((t) => t.toLowerCase() === kw.toLowerCase())
  );

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
          placeholder={placeholder ?? `Add ${label.toLowerCase() || "keyword"}...`}
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

      {/* Keyword Bank */}
      {availableBank.length > 0 && onBankClick && (
        <div className="mt-3 pt-3 border-t border-claude-border">
          <span className="text-xs text-claude-tertiary block mb-1.5">
            Keyword Bank (click to add):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {availableBank.map((kw) => (
              <button
                key={kw}
                onClick={() => onBankClick(kw)}
                className="inline-flex items-center text-xs px-2.5 py-1 rounded-lg border border-dashed border-claude-border text-claude-tertiary hover:border-claude-accent hover:text-claude-accent transition-colors cursor-pointer"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
