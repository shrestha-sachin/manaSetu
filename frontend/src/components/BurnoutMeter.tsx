import type { BurnoutZone } from "./CareerMap/burnout";

type BurnoutMeterProps = {
  score: number;
  zone: BurnoutZone;
};

const ZONE_CONFIG = {
  healthy: {
    label: "Healthy",
    color: "text-calm-mint",
    gradient: "from-calm-mint to-cyan-300",
    message: "You're in a great headspace. All career paths are open to you.",
    ringStroke: "#6ee7b7",
    ringStrokeEnd: "#5dd5a5",
    bgGlow: "rgba(110, 231, 183, 0.04)",
  },
  early_warning: {
    label: "Early Warning",
    color: "text-calm-amber",
    gradient: "from-calm-amber to-yellow-300",
    message: "Some stress detected. Consider pacing your goals this week.",
    ringStroke: "#fcd34d",
    ringStrokeEnd: "#f9d923",
    bgGlow: "rgba(252, 211, 77, 0.04)",
  },
  risk: {
    label: "Burnout Risk",
    color: "text-calm-coral",
    gradient: "from-calm-coral to-red-200",
    message: "High stress detected. We've simplified your roadmap to focus on small wins.",
    ringStroke: "#fca5a5",
    ringStrokeEnd: "#f87171",
    bgGlow: "rgba(252, 165, 165, 0.04)",
  },
};

export default function BurnoutMeter({ score, zone }: BurnoutMeterProps) {
  const config = ZONE_CONFIG[zone];
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="glass-card p-6 relative overflow-hidden">
      {/* Subtle zone-colored ambient glow */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full blur-[80px]"
        style={{ background: config.bgGlow }}
      />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Burnout Meter</h3>
          <span
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${config.color}`}
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130" className="rotate-[-90deg]">
              {/* Background ring */}
              <circle
                cx="65" cy="65" r="52"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="7"
              />
              {/* Colored ring */}
              <circle
                cx="65" cy="65" r="52"
                fill="none"
                stroke={`url(#gauge-grad-${zone})`}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out"
                style={{ filter: `drop-shadow(0 0 8px ${config.ringStroke}40)` }}
              />
              <defs>
                <linearGradient id={`gauge-grad-${zone}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={config.ringStroke} />
                  <stop offset="100%" stopColor={config.ringStrokeEnd} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold tabular-nums tracking-tight ${config.color}`}>{score}</span>
              <span className="text-[9px] uppercase tracking-[0.15em] text-slate-600 font-medium">/ 100</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm leading-relaxed text-slate-400">{config.message}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-1000 ease-out`}
                style={{
                  width: `${score}%`,
                  boxShadow: `0 0 12px -2px ${config.ringStroke}50`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
