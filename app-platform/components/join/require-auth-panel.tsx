export function RequireAuthPanel() {
  return (
    <div className="w-full max-w-md space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-unmute-navy">
          Sign in to join
        </h1>
        <p className="font-body text-lg text-slate">
          This team requires authentication. SSO will be available here soon.
        </p>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md border border-cloud-grey bg-cloud-grey/60 px-6 py-4 font-display text-lg font-semibold text-slate opacity-40"
        >
          Sign in with Google
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md border border-cloud-grey bg-cloud-grey/60 px-6 py-4 font-display text-lg font-semibold text-slate opacity-40"
        >
          Sign in with Microsoft
        </button>
      </div>

      <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
        Coming soon
      </p>
    </div>
  );
}
