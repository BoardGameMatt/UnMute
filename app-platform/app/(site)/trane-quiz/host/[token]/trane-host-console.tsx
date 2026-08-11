"use client";

import { SessionJoinQr } from "@/components/session/session-join-qr";
import { useCallback, useEffect, useState } from "react";

type HostStatus = {
  phase: string;
  joined: number;
  preCompleted: number;
  postCompleted: number;
  paired: number;
  endOnly: number;
};

type TraneHostConsoleProps = {
  hostToken: string;
  courseTitle: string;
  classDate: string;
  label: string | null;
  joinCode: string;
  joinUrl: string;
  hostUrl: string;
  initialPhase: string;
};

const PHASE_ACTIONS: Record<
  string,
  { label: string; next: string }[]
> = {
  waiting: [{ label: "Start beginning quiz", next: "pre_open" }],
  pre_open: [
    { label: "Close beginning quiz", next: "pre_closed" },
    { label: "Open end quiz", next: "post_open" },
  ],
  pre_closed: [{ label: "Open end quiz", next: "post_open" }],
  post_open: [{ label: "Close session", next: "closed" }],
  closed: [],
};

export function TraneHostConsole({
  hostToken,
  courseTitle,
  classDate,
  label,
  joinCode,
  joinUrl,
  hostUrl,
  initialPhase,
}: TraneHostConsoleProps) {
  const [status, setStatus] = useState<HostStatus>({
    phase: initialPhase,
    joined: 0,
    preCompleted: 0,
    postCompleted: 0,
    paired: 0,
    endOnly: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/trane-quiz/host/${hostToken}/status`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Status refresh failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as HostStatus;
      setStatus(data);
      setError(null);
    } catch {
      setError("Could not reach status API — is the dev server running?");
    }
  }, [hostToken]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const setPhase = async (next: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trane-quiz/host/${hostToken}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: next }),
      });
      const data = (await res.json()) as { phase?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not change phase");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyHost = async () => {
    try {
      await navigator.clipboard.writeText(hostUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy host link");
    }
  };

  const actions = PHASE_ACTIONS[status.phase] ?? [];
  const designation = label
    ? `${courseTitle} · ${classDate} · ${label}`
    : `${courseTitle} · ${classDate}`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
          Facilitator console
        </p>
        <h1 className="text-2xl text-trane-purple sm:text-3xl">{designation}</h1>
        <p className="text-sm text-trane-gray">
          Phase: <span className="font-bold text-[#111]">{status.phase}</span>
        </p>
      </header>

      <section className="rounded-lg border border-[#EEE] bg-white p-6">
        <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-trane-deep">
          Participant join — project this QR
        </p>
        <SessionJoinQr joinUrl={joinUrl} />
        <p className="mt-2 text-center font-mono text-2xl tracking-widest text-trane-deep">
          {joinCode}
        </p>
        <p className="mt-2 break-all text-center text-xs text-trane-gray">
          {joinUrl}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Joined", status.joined],
          ["Beginning done", status.preCompleted],
          ["End done", status.postCompleted],
          ["Paired", status.paired],
          ["End only", status.endOnly],
        ].map(([labelText, value]) => (
          <div
            key={labelText as string}
            className="rounded-lg border border-[#EEE] px-3 py-4 text-center"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-trane-deep">
              {labelText}
            </p>
            <p className="mt-1 text-2xl font-bold text-trane-purple">{value}</p>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={() => void refresh()}
        className="text-sm text-trane-deep underline"
      >
        Refresh counts now
      </button>

      <section className="flex flex-col gap-3">
        {actions.map((a) => (
          <button
            key={a.next}
            type="button"
            disabled={busy}
            onClick={() => void setPhase(a.next)}
            className="rounded-md bg-trane-purple px-5 py-3.5 text-base font-bold text-white disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
        <a
          href={`/api/trane-quiz/host/${hostToken}/report.pdf`}
          className="rounded-md border-2 border-trane-deep px-5 py-3.5 text-center text-base font-bold text-trane-deep"
        >
          Download PDF report
        </a>
        <button
          type="button"
          onClick={() => void copyHost()}
          className="rounded-md border border-[#DDD] px-5 py-3 text-sm text-trane-deep"
        >
          {copied ? "Host link copied" : "Copy host link (keep private)"}
        </button>
      </section>

      {error ? (
        <p className="text-center text-sm text-trane-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
