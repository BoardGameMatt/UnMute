"use client";

import { useEffect, useState } from "react";

export function useDibeImage(sessionId: string, participantId: string, enabled: boolean) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSignedUrl(null);
      setImageName(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/dibe/image/${sessionId}?participantId=${encodeURIComponent(participantId)}`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Image fetch failed (${res.status})`);
        }
        const data = (await res.json()) as { signedUrl: string; name: string };
        if (!cancelled) {
          setSignedUrl(data.signedUrl);
          setImageName(data.name);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load image.");
          setSignedUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId, enabled]);

  return { signedUrl, imageName, error, loading };
}
