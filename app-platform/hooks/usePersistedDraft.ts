"use client";

import { useCallback, useEffect, useState } from "react";

const readDraft = (key: string) => {
  try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
};

/** Persist on input. Keys include participant and round/phase, so a refresh
 * retains text and a different round never receives the old draft.
 */
export const usePersistedDraft = (key: string) => {
  const [saved, setSaved] = useState({ key, value: "" });
  useEffect(() => { setSaved({ key, value: readDraft(key) }); }, [key]);
  const setDraft = useCallback((value: string) => {
    setSaved({ key, value });
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch { /* Keep the in-memory draft usable when storage is blocked. */ }
  }, [key]);
  return [saved.key === key ? saved.value : readDraft(key), setDraft] as const;
};
