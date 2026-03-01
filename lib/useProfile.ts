"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Profile } from "@/lib/types";

const STORAGE_KEY = "activeProfileId";

export function useProfile() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileIdState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("profiles").select("*").order("type");
      if (data && data.length > 0) {
        setProfiles(data);
        const stored = localStorage.getItem(STORAGE_KEY);
        const valid = stored && data.some((p) => p.id === stored);
        setProfileIdState(valid ? stored : data[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  function setProfileId(id: string) {
    setProfileIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeProfile = profiles.find((p) => p.id === profileId) ?? null;
  const profileSlug = activeProfile?.name?.toLowerCase() ?? activeProfile?.type ?? "";

  return { profiles, profileId, setProfileId, activeProfile, profileSlug, loading };
}
