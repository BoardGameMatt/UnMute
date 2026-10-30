"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SayLessLobbyFooter() {
  const params = useParams();
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/say-less/session/${sessionId}/play`);
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { state?: { categories?: { label: string }[] } };
      const next = body.state?.categories?.map((item) => item.label) ?? [];
      if (!cancelled) setLabels(next);
    };
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);

  if (labels.length !== 2) return null;

  return (
    <p className="px-5 pb-10 text-center font-body text-sm text-slate">
      Today&apos;s categories: {labels[0]} + {labels[1]}
    </p>
  );
}
