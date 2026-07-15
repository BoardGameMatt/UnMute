import { EvaluoiSurvey } from "@/components/EvaluoiSurvey";

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
        </header>

        <EvaluoiSurvey />
      </div>
    </main>
  );
}
