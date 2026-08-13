import clsx from 'clsx';

/**
 * Three meshed gears, turning — the in-app loading mark for everything except
 * the login/logout transition (which keeps the full-screen `BrandedLoader` and
 * its "e" mark).
 *
 * Drawn as one inline SVG rather than an image file so it inherits the app's
 * colours, stays crisp at any size, and costs no extra network request on a
 * phone. The outlines are stroked with round joins to match the flat
 * illustration style already used across the product.
 */

/** Palette pulled from the app's own scale: primary blue, warning amber, neutral grey. */
const GEARS = [
  { cx: 34, cy: 34, r: 24, teeth: 8, hole: 9.5, color: '#60A5FA', dir: 'cw' as const },
  { cx: 62, cy: 64, r: 17, teeth: 7, hole: 6.8, color: '#FBBF24', dir: 'ccw' as const },
  { cx: 80, cy: 40, r: 11, teeth: 6, hole: 4.4, color: '#9CA3AF', dir: 'cw' as const },
];

/**
 * Outline path for one gear.
 *
 * Per tooth: rise from the valley to the crown, arc across the crown, drop back
 * to the valley, then arc along the valley to the next tooth. Using real arcs
 * for the crown and the root — rather than chords between four points — is what
 * keeps the silhouette round instead of faceted at small sizes.
 */
function gearPath({ cx, cy, r, teeth }: { cx: number; cy: number; r: number; teeth: number }): string {
  const root = r * 0.76; // radius of the valley between two teeth
  const step = (Math.PI * 2) / teeth;
  const crownHalf = step * 0.2; // angular half-width of the tooth tip
  const rootHalf = step * 0.33; // angular half-width of the valley shoulder
  const at = (rad: number, a: number) =>
    `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;

  let d = '';
  for (let i = 0; i < teeth; i++) {
    // Start at -90° so a tooth points straight up; purely cosmetic.
    const a = i * step - Math.PI / 2;
    if (i === 0) d += `M${at(root, a - rootHalf)}`;
    d += `L${at(r, a - crownHalf)}`;
    // sweep-flag 1 = increasing angle, which is clockwise in SVG's y-down space
    d += `A${r},${r} 0 0 1 ${at(r, a + crownHalf)}`;
    d += `L${at(root, a + rootHalf)}`;
    d += `A${root},${root} 0 0 1 ${at(root, a + step - rootHalf)}`;
  }
  return `${d}Z`;
}

// Rendered and checked at each size: below ~64px the small grey gear's teeth
// stop resolving, so `sm` is 64 rather than the 56 it started at.
const SIZES = {
  sm: 'w-16 h-16',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

export default function GearLoader({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={clsx(SIZES[size], className)}
      role="img"
      aria-hidden="true"
      fill="none"
    >
      {GEARS.map(g => (
        <g
          key={g.color}
          // `transformOrigin` in user units keeps each gear spinning about its
          // own centre; without it they orbit the top-left of the viewBox.
          style={{
            transformOrigin: `${g.cx}px ${g.cy}px`,
            animationDuration: `${(g.teeth * 0.3).toFixed(2)}s`,
          }}
          className={clsx(
            g.dir === 'cw' ? 'animate-gear-cw' : 'animate-gear-ccw',
            // Vestibular safety: hold the gears still if the viewer asks for
            // reduced motion. The message beside them still says it's loading.
            'motion-reduce:animate-none'
          )}
          stroke={g.color}
          strokeWidth={Math.max(2.2, g.r * 0.14)}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={gearPath(g)} />
          <circle cx={g.cx} cy={g.cy} r={g.hole} />
        </g>
      ))}
    </svg>
  );
}
