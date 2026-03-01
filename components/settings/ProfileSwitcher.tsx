"use client";

import { Profile } from "@/lib/types";

interface ProfileSwitcherProps {
  profiles: Profile[];
  activeProfileId: string;
  onSwitch: (profileId: string) => void;
}

export default function ProfileSwitcher({
  profiles,
  activeProfileId,
  onSwitch,
}: ProfileSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => onSwitch(p.id)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeProfileId === p.id
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {p.name ?? p.type}
        </button>
      ))}
    </div>
  );
}
