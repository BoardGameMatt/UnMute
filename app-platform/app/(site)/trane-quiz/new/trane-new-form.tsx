"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type CourseOption = { slug: string; title: string };

type TraneNewFormProps = {
  courses: CourseOption[];
};

export function TraneNewForm({ courses }: TraneNewFormProps) {
  const router = useRouter();
  const [courseSlug, setCourseSlug] = useState(courses[0]?.slug ?? "");
  const [classDate, setClassDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!courseSlug && courses[0]) setCourseSlug(courses[0].slug);
  }, [courses, courseSlug]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/trane-quiz/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          classDate,
          label: label.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        hostToken?: string;
        error?: string;
      };
      if (!res.ok || !data.hostToken) {
        setError(data.error ?? "Could not create class");
        return;
      }
      router.push(`/trane-quiz/host/${data.hostToken}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-12">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-trane-deep">
          Product Management Training
        </p>
        <h1 className="text-3xl font-normal text-trane-purple">
          New knowledge check
        </h1>
        <p className="text-sm text-trane-gray">
          Creates a host link and participant QR for this class.
        </p>
      </header>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-trane-deep">Course</span>
        <select
          className="w-full rounded-md border border-[#DDD] bg-white px-3 py-3 text-base"
          value={courseSlug}
          onChange={(e) => setCourseSlug(e.target.value)}
          required
        >
          {courses.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-trane-deep">Class date</span>
        <input
          type="date"
          className="w-full rounded-md border border-[#DDD] bg-white px-3 py-3 text-base"
          value={classDate}
          onChange={(e) => setClassDate(e.target.value)}
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-trane-deep">
          Label <span className="font-normal text-trane-gray">(optional)</span>
        </span>
        <input
          type="text"
          className="w-full rounded-md border border-[#DDD] bg-white px-3 py-3 text-base"
          placeholder="e.g. Dublin cohort"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
        />
      </label>

      {error ? (
        <p className="text-sm text-trane-alert" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !courseSlug}
        className="rounded-md bg-trane-purple px-5 py-3.5 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Creating…" : "Create class"}
      </button>
    </form>
  );
}
