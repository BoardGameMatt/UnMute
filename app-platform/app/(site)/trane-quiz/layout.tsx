import type { ReactNode } from "react";

/**
 * Trane-branded shell for the quiz side product.
 * Does not change global Unmute fonts outside this tree.
 */
export default function TraneQuizLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white font-trane text-[#111111] antialiased">
      {children}
    </div>
  );
}
