import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Notice | UnMute Labs",
  description:
    "What UnMute Labs collects, why, and your choices for website visitors and Season participants.",
};

export default function PrivacyPage() {
  return (
    <main className="bg-warm-white px-5 py-12">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <h1 className="font-display text-4xl font-bold text-unmute-navy">
            Privacy Notice
          </h1>
          <p className="font-body text-base text-slate">
            Last updated: July 10, 2026
          </p>
        </header>

        <div className="space-y-8 font-body text-base leading-relaxed text-charcoal">
          <p>
            UnMute Labs Incorporated (&quot;UnMute,&quot; &quot;we,&quot;
            &quot;us&quot;) operates unmutelabs.com and app.unmutelabs.com. This
            notice explains what we collect, why, and your choices.
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Who this covers
            </h2>
            <p>
              This notice applies to visitors to our websites and to participants
              in an UnMute Season engagement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              What we collect
            </h2>
            <p>
              <span className="font-medium text-unmute-navy">Site visitors.</span>{" "}
              We use Vercel Analytics to understand site traffic. It collects
              aggregated usage data such as page views, referring pages, and
              general device and browser type. It does not use cookies to track
              you across other websites and does not build an individual
              advertising profile.
            </p>
            <p>
              <span className="font-medium text-unmute-navy">
                Season participants.
              </span>{" "}
              If you take part in a Season, we collect the survey responses you
              submit and basic information needed to run the engagement, such as
              your name and work email and the team you belong to. Survey
              responses are collected through our measurement partner, described
              below.
            </p>
            <p>
              <span className="font-medium text-unmute-navy">Contact.</span> If
              you email us, we keep your message and contact details to respond.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Why we collect it
            </h2>
            <p>
              We use this information to operate and improve our websites, to
              deliver the Season engagement you or your employer signed up for,
              to produce team-level measurement and reporting, and to communicate
              with you about the engagement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Our legal basis (for individuals in the EU/EEA and UK)
            </h2>
            <p>
              We process participant data to perform the engagement contracted
              with your employer and on the basis of our legitimate interest in
              delivering and improving that service. Where required, we rely on
              consent, which you may withdraw at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              How survey data is handled
            </h2>
            <p>
              Survey responses are collected and processed by our measurement
              partner, Evaluoi AI Oy, a company based in Finland. This means your
              survey responses are transferred to and stored in the European
              Union. Evaluoi processes this data on our behalf to run the
              diagnostic instrument and return team-level results. Evaluoi&apos;s
              own handling of this data is governed by{" "}
              <a
                href="https://www.evaluoi.ai/english-privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-unmute-navy underline decoration-cloud-grey underline-offset-4 transition hover:decoration-signal-amber"
              >
                https://www.evaluoi.ai/english-privacy-policy
              </a>
              .
            </p>
            <p>
              <span className="font-medium text-unmute-navy">
                Reporting to your employer.
              </span>{" "}
              UnMute delivers team-level results and patterns to your employer.
              We do not report your individual survey answers to your employer in
              a way that identifies you, except where a group is small enough
              that responses could reasonably be attributed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Service providers
            </h2>
            <p>We rely on a small number of providers to run our service:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Vercel — website hosting and analytics (United States)
              </li>
              <li>
                Supabase — database and application data storage (United States)
              </li>
              <li>
                Evaluoi AI Oy — survey collection and measurement (Finland/EU)
              </li>
              <li>
                Google Workspace — email and business operations (United States)
              </li>
            </ul>
            <p>
              These providers process data only to provide services to us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              International transfers
            </h2>
            <p>
              We operate in the United States and work with a partner in the
              European Union. Data may be transferred between the US and the EU.
              Where required by law, these transfers are covered by appropriate
              safeguards such as Standard Contractual Clauses.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              How long we keep it
            </h2>
            <p>
              We keep participant data for as long as needed to deliver the
              engagement and for a reasonable 24 month period afterward for
              reporting and records, then delete or de-identify it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Your rights
            </h2>
            <p>
              Depending on where you live, you may have the right to access,
              correct, delete, or receive a copy of your personal information,
              and to object to or restrict certain processing. EU/EEA and UK
              residents have these rights under GDPR. California residents have
              rights under the CCPA/CPRA, including the right to know, delete,
              and correct, and the right not to be discriminated against for
              exercising them. We do not sell your personal information and we do
              not share it for cross-context behavioral advertising.
            </p>
            <p>
              To exercise any right, contact us at{" "}
              <a
                href="mailto:privacy@unmutelabs.com"
                className="text-unmute-navy underline decoration-cloud-grey underline-offset-4 transition hover:decoration-signal-amber"
              >
                privacy@unmutelabs.com
              </a>
              . You may also have the right to lodge a complaint with your local
              data protection authority.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Children
            </h2>
            <p>
              Our services are for workplaces and are not directed to anyone under
              16. We do not knowingly collect data from children.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Changes
            </h2>
            <p>
              We will update this notice as our practices change and will revise
              the date above.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-unmute-navy">
              Contact
            </h2>
            <p>
              UnMute Labs Incorporated
              <br />
              Harleysville, PA
              <br />
              <a
                href="mailto:privacy@unmutelabs.com"
                className="text-unmute-navy underline decoration-cloud-grey underline-offset-4 transition hover:decoration-signal-amber"
              >
                privacy@unmutelabs.com
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
