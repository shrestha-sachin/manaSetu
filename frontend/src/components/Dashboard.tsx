import { useCallback, useEffect, useState } from "react";
import CareerMap from "./CareerMap/CareerMap";
import BurnoutMeter from "./BurnoutMeter";
import BurnoutCheckin from "./BurnoutCheckin";
import MilestoneTracker from "./MilestoneTracker";
import type { BurnoutZone } from "./CareerMap/burnout";
import type { CareerMapPayload } from "../types/careerMap";

type DashboardProps = {
  userId: string;
  onLogout: () => void;
};

export default function Dashboard({ userId, onLogout }: DashboardProps) {
  const [payload, setPayload] = useState<CareerMapPayload | null>(null);
  const [burnout, setBurnout] = useState({ score: 0, zone: "healthy" as BurnoutZone });
  const [showCheckin, setShowCheckin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapSource, setMapSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  const loadCareerMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/career-map/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPayload({ nodes: data.nodes, edges: data.edges });
      if (data.burnout) setBurnout(data.burnout);
      setMapSource(data.source || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load career map");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadCareerMap();
  }, [loadCareerMap]);

  const handleCheckinComplete = (result: { score: number; zone: string }) => {
    setBurnout({ score: result.score, zone: result.zone as BurnoutZone });
    setShowCheckin(false);
    void loadCareerMap();
  };

  const copyProfileId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const zoneMessage = {
    risk: "High-stress paths are dimmed. Focus on manageable, short-term actions.",
    early_warning: "Some high-effort paths are de-prioritized to help you pace yourself.",
    healthy: "All paths are available. Explore freely.",
  }[burnout.zone];

  return (
    <div className="flex min-h-full flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#0f1a24]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-calm-teal to-calm-blue shadow-lg shadow-calm-teal/20">
              <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <span className="text-base font-bold text-gradient">
              CareerPulse
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCheckin(true)}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 transition-all duration-500 hover:bg-white/10 border border-white/5"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-calm-mint opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-calm-mint" />
              </span>
              Check-in
            </button>
            <button
              onClick={() => void loadCareerMap()}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/5 text-slate-400 transition-all duration-500 hover:bg-white/10 hover:text-white border border-white/5"
              title="Regenerate map"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={copyProfileId}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition-all duration-500 border border-white/5 ${copied
                ? "bg-calm-mint/15 text-calm-mint border-calm-mint/20"
                : "bg-white/5 text-calm-cyan hover:bg-white/10"
                }`}
              title="Copy Profile ID"
            >
              {copied ? "Copied!" : "Copy ID"}
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl px-3 py-2 text-xs text-slate-600 transition-colors duration-500 hover:text-slate-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-8">
        {/* Top row */}
        <div className="grid gap-6 lg:grid-cols-3 animate-fade-up">
          <div className="lg:col-span-2">
            <BurnoutMeter score={burnout.score} zone={burnout.zone} />
          </div>
          <div className="glass-card flex flex-col justify-center p-6">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Quick Actions</h3>
            <div className="space-y-2.5">
              <ActionButton
                icon={<ClipboardIcon />}
                title="Take Check-in"
                sub="Update your burnout score"
                onClick={() => setShowCheckin(true)}
              />
              <ActionButton
                icon={<RefreshIcon />}
                title="Refresh Map"
                sub="Generate new AI paths"
                onClick={() => void loadCareerMap()}
              />
            </div>
          </div>
        </div>

        {/* Career Map */}
        <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Your Career Roadmap</h2>
              <p className="mt-1 text-xs text-slate-600 max-w-xl">
                {zoneMessage}
                {mapSource && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-calm-teal/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-calm-cyan font-semibold">
                    <span className="h-1 w-1 rounded-full bg-calm-cyan" />
                    {mapSource === "gemini" ? "AI Generated" : "Sample Map"}
                  </span>
                )}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-calm-amber/30 bg-calm-amber/10 px-5 py-3.5 text-sm text-calm-amber/90 backdrop-blur">
              <span className="font-medium">Connection issue:</span> {error} — make sure the backend is running.
            </div>
          )}

          {loading ? (
            <div className="glass-card flex h-[500px] items-center justify-center">
              <div className="flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-calm-teal/30 border-t-calm-teal" />
                  <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-calm-blue/20 border-b-calm-blue" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Generating your career map</p>
                  <p className="mt-1 text-xs text-slate-600">This may take a moment...</p>
                </div>
              </div>
            </div>
          ) : payload ? (
            <CareerMap nodes={payload.nodes} edges={payload.edges} burnoutZone={burnout.zone} />
          ) : null}
        </div>

        {/* Tips */}
        <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="glass-card p-6">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              {burnout.zone === "risk" ? "Self-Care Tips" : "Pro Tips"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {burnout.zone === "risk" ? (
                <>
                  <TipCard icon={<LeafIcon />} title="Take a Break" text="Step away for 15 minutes. A short walk resets your focus." />
                  <TipCard icon={<TargetIcon />} title="Smallest Step" text="Pick one item from the highlighted nodes. That's today's win." />
                  <TipCard icon={<ChatIcon />} title="Talk to Someone" text="Reach out to a friend, mentor, or counselor today." />
                </>
              ) : (
                <>
                  <TipCard icon={<FlagIcon />} title="Set Milestones" text="Break big goals into 2-week sprints for steady progress." onClick={() => setShowMilestones(true)} />
                  <TipCard icon={<ChartIcon />} title="Track Progress" text="Check in weekly to keep your burnout score low." onClick={() => setShowCheckin(true)} />
                  <TipCard icon={<CompassIcon />} title="Explore Broadly" text="Try paths outside your comfort zone while energy is high." onClick={() => void loadCareerMap()} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/3 py-5 text-center text-[11px] text-slate-700">
        @Copyright Carrerplus 2026
      </footer>

      {showCheckin && (
        <BurnoutCheckin userId={userId} onComplete={handleCheckinComplete} onClose={() => setShowCheckin(false)} />
      )}

      {showMilestones && (
        <MilestoneTracker userId={userId} onClose={() => setShowMilestones(false)} />
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function ActionButton({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-xl bg-white/3 px-4 py-3.5 text-left text-sm text-slate-400 transition-all duration-300 hover:bg-white/6 hover:text-white border border-white/3 hover:border-white/8"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-500 transition-colors group-hover:text-white group-hover:bg-calm-teal/15">
        {icon}
      </span>
      <div>
        <span className="font-semibold text-slate-300 group-hover:text-white transition-colors">{title}</span>
        <p className="text-[11px] text-slate-600">{sub}</p>
      </div>
    </button>
  );
}

function TipCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl bg-white/3 p-5 transition-all duration-500 hover:bg-white/5 border border-white/3 hover:border-white/8 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-calm-teal/5"
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-calm-teal/10 text-calm-cyan transition-colors group-hover:bg-calm-teal/15">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{text}</p>
      <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-calm-cyan/60 group-hover:text-calm-cyan transition-colors">
        <span>Click to start</span>
        <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function LeafIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9c-2.12 0-4.07-.74-5.6-1.97M12 3C7.03 3 3 7.03 3 12c0 2.12.74 4.07 1.97 5.6M12 3v9m0 0l-4.6 4.6" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12c0-4.97 4.37-9 9.75-9s9.75 4.03 9.75 9c0 1.77-.58 3.42-1.57 4.77L21 21l-4.73-.84A10.3 10.3 0 0112 21c-5.38 0-9.75-4.03-9.75-9z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18m0-15l9 3-9 3m9-6l9 3-9 3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
