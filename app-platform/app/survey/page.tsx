import { EvaluoiSurvey } from "@/components/EvaluoiSurvey";

const FALLBACK_URL = "https://survey.evaluoi.app";

export default function SurveyPage() {
  return (
    <main className="min-h-screen bg-warm-white px-5 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-steel-blue">
            Survey
          </p>
          <h1 className="font-display text-4xl font-bold text-unmute-navy">
            Unmute Labs
          </h1>
          <p className="font-body text-lg text-charcoal">
            Enter your access code when prompted.
          </p>
        </header>

        <EvaluoiSurvey />

        <p className="font-body text-base text-slate">
          Prefer the direct link?{" "}
          <a
            href={FALLBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-unmute-navy underline decoration-cloud-grey underline-offset-4 transition hover:decoration-signal-amber"
          >
            Open survey at survey.evaluoi.app
          </a>
        </p>
      </div>
    </main>
  );
}
