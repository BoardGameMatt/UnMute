"use client";

type PoweredByGiphyProps = {
  className?: string;
};

/**
 * Official-style Powered By GIPHY mark. Required wherever Giphy content is shown.
 * Tapping opens giphy.com; it must not search or advance the Moment.
 */
export const PoweredByGiphy = ({ className = "" }: PoweredByGiphyProps) => {
  return (
    <a
      href="https://giphy.com"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex justify-center ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/powered-by-giphy.svg"
        alt="Powered By GIPHY"
        width={160}
        height={29}
        className="h-7 w-auto"
      />
    </a>
  );
};
