"use client";

import { useState } from "react";
import { KeywordPreset } from "@/lib/types";

interface KeywordPresetsProps {
  presets: KeywordPreset[];
  onLoad: (preset: KeywordPreset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function KeywordPresets({ presets, onLoad, onSave, onDelete }: KeywordPresetsProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setShowInput(false);
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-claude-secondary">Presets</span>
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="text-xs text-claude-accent hover:text-claude-accent-hover"
          >
            + Save Current as Preset
          </button>
        )}
      </div>

      {showInput && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSave())}
            placeholder="Preset name (e.g., PE Sales Focus)"
            autoFocus
            className="border border-claude-border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            onClick={() => { setShowInput(false); setName(""); }}
            className="px-3 py-1.5 text-sm text-claude-secondary hover:bg-claude-hover rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="inline-flex items-center gap-1">
              <button
                onClick={() => onLoad(preset)}
                className="px-3 py-1.5 text-sm rounded-lg border border-claude-border text-claude-secondary hover:bg-claude-accent hover:text-white hover:border-claude-accent transition-colors"
                title={`Title: ${preset.title_keywords.join(", ") || "none"}\nDescription: ${preset.description_keywords.join(", ") || "none"}\nExclude: ${preset.exclude_keywords.join(", ") || "none"}`}
              >
                {preset.name}
              </button>
              {deletingId === preset.id ? (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => { onDelete(preset.id); setDeletingId(null); }}
                    className="px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete?
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-1.5 py-1 text-xs text-claude-tertiary hover:bg-claude-hover rounded"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeletingId(preset.id)}
                  className="text-claude-tertiary hover:text-red-500 text-xs px-0.5"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-claude-tertiary">
          No presets saved. Save your current keyword combination for quick switching.
        </p>
      )}
    </div>
  );
}
