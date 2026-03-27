type SessionPageProps = {
  params: { session_id: string };
};

export default function SessionPage({ params }: SessionPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 py-12">
      <p className="font-body text-lg text-charcoal">
        Session {params.session_id} — active
      </p>
    </main>
  );
}
