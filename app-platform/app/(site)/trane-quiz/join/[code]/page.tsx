import { redirect } from "next/navigation";
import { normalizeTraneJoinCode } from "@/lib/trane-quiz/join-code";

type PageProps = {
  params: { code: string };
  searchParams?: { error?: string };
};

/**
 * Happy path: bounce straight into claim (sets cookie).
 * Error path: show message + retry.
 */
export default function TraneJoinPage({ params, searchParams }: PageProps) {
  const code = normalizeTraneJoinCode(params.code);
  const error = searchParams?.error;

  if (code.length === 6 && !error) {
    redirect(`/api/trane-quiz/join/${code}/claim`);
  }

  let message = "Could not join this knowledge check.";
  if (error === "not_found") message = "That join code was not found.";
  if (error === "closed") message = "This class quiz is closed.";
  if (error === "join_failed") message = "Could not join. Try again.";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 py-12 text-center">
      <h1 className="text-2xl text-trane-purple">{message}</h1>
      {code.length === 6 ? (
        <a
          href={`/api/trane-quiz/join/${code}/claim`}
          className="rounded-md bg-trane-purple px-6 py-3.5 text-base font-bold text-white"
        >
          Try again
        </a>
      ) : null}
    </main>
  );
}
