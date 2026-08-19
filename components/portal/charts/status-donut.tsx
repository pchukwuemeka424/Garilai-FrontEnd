/** Approval progress donut: filled arc = approved chapters %, remainder muted. */
export function StatusDonut({
  approved,
  inProgress,
  rejected,
  size = 96,
  labelClassName,
  trackColor = "hsl(var(--muted))",
}: {
  approved: number;
  inProgress: number;
  rejected: number;
  size?: number;
  labelClassName?: string;
  trackColor?: string;
}) {
  const total = approved + inProgress + rejected;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const centerPct = total === 0 ? 0 : Math.round((approved / total) * 100);
  const approvedLen = circumference * (centerPct / 100);

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="-rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth="10"
        />
        {centerPct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="hsl(var(--success))"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${approvedLen} ${circumference - approvedLen}`}
            strokeDashoffset={0}
          />
        )}
      </svg>
      <span
        className={`absolute text-xl font-bold tabular-nums ${labelClassName || "text-foreground"}`}
      >
        {centerPct}%
      </span>
    </div>
  );
}
