import Link from "next/link";

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-cloud-grey bg-warm-white px-5 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-slate">
          © {year} UnMute Labs Incorporated
        </p>
        <Link
          href="/privacy"
          className="font-mono text-xs text-slate transition hover:text-unmute-navy"
        >
          Privacy Notice
        </Link>
      </div>
    </footer>
  );
};
