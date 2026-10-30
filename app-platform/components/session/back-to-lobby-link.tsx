import Link from "next/link";

type BackToLobbyLinkProps = {
  sessionId: string;
};

export function BackToLobbyLink({ sessionId }: BackToLobbyLinkProps) {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/session/${sessionId}/lobby`}
        className="inline-flex rounded-md border border-cloud-grey bg-transparent px-5 py-3 font-display text-base font-semibold text-unmute-navy shadow-sm transition hover:bg-cloud-grey/60"
      >
        Back to Lobby
      </Link>
    </div>
  );
}
