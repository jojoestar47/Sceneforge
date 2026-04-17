// Reusable app icon — the gold arch with stars
export default function AppIcon({ size = 24, opacity = 1, style }: { size?: number; opacity?: number; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 56 56"
      fill="none"
      style={{ flexShrink: 0, opacity, ...style }}
    >
      {/* Outer arch */}
      <path d="M12 40 L12 24 Q12 10 28 10 Q44 10 44 24 L44 40" stroke="#c9a84c" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Inner arch */}
      <path d="M17 40 L17 25 Q17 15 28 15 Q39 15 39 25 L39 40" stroke="#8b9fe8" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      {/* Stars */}
      <circle cx="28" cy="21" r="2"    fill="#e4c86a"/>
      <circle cx="21" cy="27" r="1.1"  fill="#e4c86a" opacity="0.65"/>
      <circle cx="35" cy="26" r="1.1"  fill="#e4c86a" opacity="0.65"/>
      <circle cx="25" cy="32" r="0.85" fill="#e4c86a" opacity="0.45"/>
      <circle cx="31" cy="33" r="0.85" fill="#e4c86a" opacity="0.45"/>
      <circle cx="28" cy="38" r="0.7"  fill="#e4c86a" opacity="0.3"/>
      {/* Base line */}
      <line x1="9" y1="41.5" x2="47" y2="41.5" stroke="#c9a84c" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
    </svg>
  )
}
