type SessionLobbyPageProps = {
  params: { session_id: string };
};

export default function SessionLobbyPage({ params }: SessionLobbyPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-3xl font-bold text-unmute-navy">
          Lobby
        </h1>
        <p className="font-body text-slate">
          Session <span className="font-mono text-sm text-charcoal">{params.session_id}</span> — waiting room UI will go here.
        </p>
      </div>
    </main>
  );
}
