/**
 * Nova — brand mark. A gradient rounded tile with a four-point nova star,
 * an orbital ring and a twinkle accent.
 */
export default function NovaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="nova-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#nova-g)" />
      <g transform="rotate(-22 20 20)">
        <ellipse
          cx="20"
          cy="20"
          rx="14.5"
          ry="6.8"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
        />
      </g>
      <path
        d="M20 10 C21.2 15 24.9 18.7 30 20 C24.9 21.3 21.2 25 20 30 C18.8 25 15.1 21.3 10 20 C15.1 18.7 18.8 15 20 10 Z"
        fill="#fff"
      />
      <circle cx="20" cy="20" r="2.6" fill="#fff" />
      <circle cx="27.5" cy="11.5" r="1.5" fill="#fff" opacity="0.9" />
    </svg>
  );
}
