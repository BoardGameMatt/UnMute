import { PIECE_FILL, PIECE_OUTLINE, type PieceColor, type TileId } from "../config";

type Props = {
  tile: TileId;
  color: PieceColor;
  className?: string;
};

const TRIANGLE: Record<"tri_ll" | "tri_lr" | "tri_ul" | "tri_ur", string> = {
  tri_ll: "0,0 0,100 100,100",
  tri_lr: "100,0 100,100 0,100",
  tri_ul: "0,0 100,0 0,100",
  tri_ur: "0,0 100,0 100,100",
};

/**
 * A single arc of exactly 180° collapses to a line in browsers.
 * Two cubic quarters (kappa ≈ 0.5523) keep the flat edge on the named side.
 */
const HALF: Record<"half_bottom" | "half_top" | "half_left" | "half_right", string> = {
  half_bottom: "M0 100 C0 72.39 22.39 50 50 50 C77.61 50 100 72.39 100 100 Z",
  half_top: "M0 0 C0 27.61 22.39 50 50 50 C77.61 50 100 27.61 100 0 Z",
  half_left: "M0 0 C27.61 0 50 22.39 50 50 C50 77.61 27.61 100 0 100 Z",
  half_right: "M100 0 C72.39 0 50 22.39 50 50 C50 77.61 72.39 100 100 100 Z",
};

export function OtspTile({ tile, color, className = "" }: Props) {
  const fill = PIECE_FILL[color];
  const shared = {
    fill,
    stroke: PIECE_OUTLINE,
    strokeWidth: 1,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {tile === "square" ? <rect x="0" y="0" width="100" height="100" {...shared} /> : null}
      {tile === "porthole" ? (
        <path
          fillRule="evenodd"
          d="M0 0 H100 V100 H0 Z M15 50 a35 35 0 1 0 70 0 a35 35 0 1 0 -70 0"
          {...shared}
        />
      ) : null}
      {tile in TRIANGLE ? <polygon points={TRIANGLE[tile as keyof typeof TRIANGLE]} {...shared} /> : null}
      {tile in HALF ? <path d={HALF[tile as keyof typeof HALF]} {...shared} /> : null}
    </svg>
  );
}
