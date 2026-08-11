import Link from "next/link";

/** Fallback when someone hits /trane-quiz/join with no code. */
export default function TraneJoinIndexPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <h1 className="text-2xl text-trane-purple">Missing join code</h1>
      <p className="text-sm text-trane-gray">
        Scan the QR code from your facilitator, or enter the six-character code
        they shared.
      </p>
      <Link href="/trane-quiz/new" className="text-sm text-trane-deep underline">
        Facilitator? Create a class
      </Link>
    </main>
  );
}
