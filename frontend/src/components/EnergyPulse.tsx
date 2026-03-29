import type { BurnoutZone } from "./CareerMap/burnout";

type EnergyPulseProps = {
  score: number;
  zone: BurnoutZone;
};

const ZONE_CONFIG = {
  healthy: {
    label: "Zen Flow",
    color: "text-calm-mint",
    gradient: "from-calm-mint to-cyan-300",
    message: "You're in a perfect rhythm. Your capacity for growth is high.",
    ringStroke: "#6ee7b7",
    ringStrokeEnd: "#5dd5a5",
    bgGlow: "rgba(110, 231, 183, 0.04)",
  },
  early_warning: {
    label: "Pacing Mode",
    color: "text-calm-amber",
    gradient: "from-calm-amber to-yellow-300",
    message: "Energy levels are shifting. Consider prioritizing your essentials.",
    ringStroke: "#fcd34d",
    ringStrokeEnd: "#f9d923",
    bgGlow: "rgba(252, 211, 77, 0.04)",
  },
  risk: {
    label: "Recharge Needed",
    color: "text-rose-400",
    gradient: "from-rose-400 to-rose-200",
    message: "Capacity is limited. Focus on small, restorative steps today.",
    ringStroke: "#fb7185",
    ringStrokeEnd: "#fda4af",
    bgGlow: "rgba(251, 113, 133, 0.04)",
  },
};

export default function EnergyPulse({ score, zone }: EnergyPulseProps) {
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
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Energy Pulse</h3>
          <span
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${config.color}`}
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {config.label}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative flex-shrink-0 mx-auto sm:mx-0">
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

          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
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
