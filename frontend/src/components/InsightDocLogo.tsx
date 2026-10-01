type InsightDocLogoProps = {
  compact?: boolean;
  light?: boolean;
};

export function InsightDocLogo({
  compact = false,
  light = false,
}: InsightDocLogoProps) {
  return (
    <div
      className={`insight-logo${compact ? " insight-logo-compact" : ""}${light ? " insight-logo-light" : ""}`}
      aria-label="InsightDoc"
    >
      <span className="insight-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="insight-doc-gradient" x1="7" y1="5" x2="42" y2="43">
              <stop offset="0%" stopColor="#6CC0FF" />
              <stop offset="52%" stopColor="#2F7CF6" />
              <stop offset="100%" stopColor="#1657D8" />
            </linearGradient>
          </defs>

          <path
            d="M14 6.5h14.2L38 16.3V38a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10.5a4 4 0 0 1 4-4Z"
            fill="url(#insight-doc-gradient)"
          />

          <path
            d="M28 6.5v8.2a2.1 2.1 0 0 0 2.1 2.1H38"
            fill="none"
            stroke="rgba(255,255,255,.75)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M23.7 18.1l1.5 4.2 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3-4.3-1.5 4.3-1.5 1.5-4.2Z"
            fill="#FFFFFF"
          />

          <path
            d="M18 33h12M18 36.5h8"
            stroke="rgba(255,255,255,.72)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {!compact && (
        <span className="insight-logo-wordmark">
          Insight<span>Doc</span>
        </span>
      )}
    </div>
  );
}
