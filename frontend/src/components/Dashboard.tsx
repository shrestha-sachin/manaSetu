import { useCallback, useEffect, useState } from "react";
import CareerMap from "./CareerMap/CareerMap";
import EnergyPulse from "./EnergyPulse";
import CapacityCheckin from "./CapacityCheckin";
import ProfileSettings from "./ProfileSettings";
import MilestoneTracker from "./MilestoneTracker";
import type { BurnoutZone } from "./CareerMap/burnout";
import type { CareerMapPayload } from "../types/careerMap";
import { EchoEffect } from "./EchoEffect";

type DashboardProps = {
  userId: string;
  onLogout: () => void;
};

export default function Dashboard({ userId, onLogout }: DashboardProps) {
  const [payload, setPayload] = useState<CareerMapPayload | null>(null);
  const [energy, setEnergy] = useState({ score: 0, zone: "healthy" as BurnoutZone });
  const [showCheckin, setShowCheckin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [breakSuggestion, setBreakSuggestion] = useState<string | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapSource, setMapSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showMilestones, setShowMilestones] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [criticalResources, setCriticalResources] = useState<{ label: string, url: string }[]>([]);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadCareerMap = useCallback(async (broaden = false) => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/career-map/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, broaden }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPayload({ nodes: data.nodes, edges: data.edges });
      if (data.burnout) setEnergy(data.burnout);
      setMapSource(data.source || "");
    } catch (e) {
      if (e instanceof Error && e.message.includes("429")) {
        setError("AI Rate Limit exceeded. Waiting a few seconds before retrying...");
        setTimeout(() => loadCareerMap(), 5000 + Math.random() * 5000); // Retry automatically after 5-10s
      } else {
        setError(e instanceof Error ? e.message : "Failed to load career map");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadCareerMap();
  }, [loadCareerMap]);

  const handleCheckinComplete = (result: { score: number; zone: string }) => {
    setEnergy({ score: result.score, zone: result.zone as BurnoutZone });
    setShowCheckin(false);
    void loadCareerMap();
  };

  const handleGetBreakSuggestion = async () => {
    setBreakLoading(true);
    setBreakSuggestion(null);
    setIsCritical(false);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/break-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setBreakSuggestion(data.suggestion);
      if (data.is_critical) {
        setIsCritical(true);
        setCriticalResources(data.resources || []);
      }
    } catch (e) {
      console.error(e);
      setBreakSuggestion("Take 5 minutes to hum a single deep note and feel the vibration in your chest.");
    } finally {
      setBreakLoading(false);
    }
  };

  const handleMilestoneUpdate = async (nodeId: string, completed: boolean, itemsCompleted: string[]) => {
    // 1. Optimistic UI update
    if (payload) {
      const updatedNodes = payload.nodes.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: { ...n.data, completed, items_completed: itemsCompleted }
          };
        }
        return n;
      });
      setPayload({ ...payload, nodes: updatedNodes });
    }

    // 2. Persist to DB
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      await fetch(`${base}/api/milestones/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          node_id: nodeId,
          completed,
          items_completed: itemsCompleted
        }),
      });
    } catch (e) {
      console.error("Failed to sync milestone:", e);
    }
  };

  const zoneMessage = {
    risk: "Your capacity is prioritized for essentials. Take it one step at a time.",
    early_warning: "Adjusting your energy rhythm. Focus on the highlights for now.",
    healthy: "Energy index is high. All horizons are clear.",
  }[energy.zone];

  return (
    <div className={`flex min-h-full flex-col transition-all duration-[3000ms] ease-in-out relative ${
      energy.zone === "risk" ? "bg-[#1a1614]" : "bg-[#0f1a24]"
    }`}>
      {/* Dynamic Ambient Warmth Overlay */}
      <div className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-[3000ms] ${
        energy.zone === "risk" ? "opacity-100" : "opacity-0"
      }`}>
        <div className="absolute -top-[20%] -left-[10%] h-[60%] w-[60%] rounded-full bg-calm-amber/5 blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-calm-coral/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-full">
      {/* Nav */}
      <nav className={`sticky top-0 z-40 border-b border-white/5 backdrop-blur-2xl transition-all duration-[3000ms] ${
        energy.zone === "risk" ? "bg-[#1a1614]/80" : "bg-[#0f1a24]/80"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <button 
            onClick={() => window.location.reload()}
            className="group flex items-center gap-3 outline-none transition-all hover:opacity-80 active:scale-95"
            title="Refresh Oasis"
          >
            <img 
              src="/manasetu-logo-transparent.png" 
              alt="ManaSetu Logo" 
              className={`h-8 w-8 transition-all duration-[3000ms] ${
                energy.zone === "risk" ? "drop-shadow-[0_0_15px_rgba(252,211,77,0.5)]" : "drop-shadow-[0_0_10px_rgba(74,155,142,0.4)]"
              }`} 
            />
            <span className="text-xl font-bold tracking-tight text-white">
              ManaSetu
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsBreathing(true)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-[3000ms] border border-white/5 ${
                energy.zone === "risk" 
                ? "bg-calm-amber/10 text-calm-amber hover:bg-calm-amber/20 shadow-[0_0_15px_rgba(252,211,77,0.15)]" 
                : "bg-calm-mint/10 text-calm-mint hover:bg-calm-mint/20 border-calm-mint/10"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${energy.zone === "risk" ? "bg-calm-amber" : "bg-calm-mint"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${energy.zone === "risk" ? "bg-calm-amber" : "bg-calm-mint"}`} />
              </span>
              Restorative Reset
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`group relative h-9 w-9 overflow-hidden rounded-full border transition-all duration-[3000ms] ${
                energy.zone === "risk" ? "border-calm-amber/40 hover:ring-calm-amber/30" : "border-white/10 hover:border-calm-mint/50 hover:ring-calm-mint/20"
              } hover:ring-2`}
              title="Profile Settings"
            >
              <img
                src="/avatar.png"
                alt="Profile"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-8">
        {/* Top row */}
        <div className="grid gap-6 lg:grid-cols-3 animate-fade-up">
          <div className="lg:col-span-2 space-y-6">
            <EnergyPulse score={energy.score} zone={energy.zone} />

            {/* Zen Wisdom Widget - Moved Below Meter */}
            <div className={`relative overflow-hidden rounded-2xl p-6 border group animate-fade-up transition-all duration-[3000ms] ${
              energy.zone === "risk" 
              ? "bg-gradient-to-br from-calm-amber/12 to-calm-coral/5 border-calm-amber/10" 
              : "bg-gradient-to-br from-calm-teal/8 to-calm-blue/3 border-white/5"
            }`} style={{ animationDelay: "100ms" }}>
              <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition-all duration-[3000ms] group-hover:scale-150 ${
                energy.zone === "risk" ? "bg-calm-amber/20" : "bg-calm-teal/10"
              }`} />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <h4 className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors duration-[3000ms] ${
                    energy.zone === "risk" ? "text-calm-amber" : "text-calm-cyan"
                  }`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Strategic Zen Wisdom
                  </h4>
                  <p className="text-base italic text-slate-200 leading-relaxed font-serif max-w-2xl">
                    {breakSuggestion ? (
                      <div className="animate-fade-in space-y-3">
                        <span className={`${isCritical ? "text-calm-coral font-bold" : "text-calm-mint"} not-italic font-sans text-sm font-medium`}>
                          {isCritical ? "Critical Support Required: " : "Focused Reset: "} {breakSuggestion}
                        </span>
                        {isCritical && criticalResources && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {criticalResources.map((res, i) => (
                              <a
                                key={i}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-calm-teal/20 transition-all"
                              >
                                {res.label}
                                <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={2.5} /></svg>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      isZenMode
                        ? "The roots of the great tree anchor deep in silence. Focus on your foundation, and the sky will wait for your rise."
                        : "Growth is not a race, but a rhythm. Your path is uniquely yours; speed is secondary to the quality of your peace."
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[140px]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{breakSuggestion ? "Restored?" : "AI Guidance"}</span>
                  <button
                    onClick={handleGetBreakSuggestion}
                    disabled={breakLoading}
                    className="group flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-[10px] font-extrabold text-calm-cyan uppercase tracking-wider transition-all duration-500 hover:bg-calm-teal/20 hover:border-calm-teal/30 hover:scale-[1.02] disabled:opacity-50"
                  >
                    {breakLoading ? (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3 transition-transform duration-500 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {breakLoading ? "Thinking..." : "Ask for a break"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-card flex flex-col justify-center p-6 bg-gradient-to-b from-white/3 to-transparent border-t border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all duration-1000">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Utilities / Focus</h3>
            <div className="space-y-2.5">
              <ActionButton
                icon={<LeafIcon />}
                title="Restorative Reset"
                sub="Find your center instantly"
                onClick={() => setIsBreathing(true)}
                isAtRisk={energy.zone === "risk"}
              />
              <ActionButton
                icon={<CompassIcon />}
                title="Zen Reflection"
                sub="Align your daily intention"
                onClick={() => setIsReflecting(true)}
                isAtRisk={energy.zone === "risk"}
              />
              <ActionButton
                icon={<RefreshIcon />}
                title="Refresh Map"
                sub="Sync with your current rhythm"
                onClick={() => void loadCareerMap()}
                isAtRisk={energy.zone === "risk"}
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
                    {mapSource === "gemini" || mapSource === "xai" ? "AI Generated" : "Sample Map"}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setIsZenMode(!isZenMode)}
              className={`group flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-500 border ${isZenMode
                  ? "bg-calm-teal/20 text-calm-cyan border-calm-teal/40 shadow-[0_0_20px_rgba(74,155,142,0.2)]"
                  : "bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300"
                }`}
            >
              <svg className={`h-4 w-4 transition-transform duration-700 ${isZenMode ? "rotate-[360deg] scale-110" : "rotate-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {isZenMode ? "Zenith Mode Active" : "Zenith Mode"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-calm-amber/30 bg-calm-amber/10 px-5 py-3.5 text-sm text-calm-amber/90 backdrop-blur">
              {error.includes("AI Rate Limit") ? (
                <span>
                  <span className="font-medium animate-pulse">Wait a moment:</span> {error}
                </span>
              ) : (
                <span>
                  <span className="font-medium">Connection issue:</span> {error} — make sure the backend is running.
                </span>
              )}
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
            <div className={`transition-all duration-1000 ${isZenMode ? "opacity-100" : ""}`}>
              <CareerMap
                onNodeClick={setSelectedNodeId}
                burnoutZone={energy.zone}
                isAtRisk={energy.score > 80 || isZenMode}
                focusTrigger={focusTrigger}
                nodes={payload.nodes}
                edges={payload.edges}
              />
            </div>
          ) : null}
        </div>

        {/* Tips */}
        <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="glass-card p-6">
            <h3 className={`mb-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-[3000ms] ${energy.zone === "risk" ? "text-calm-amber" : "text-slate-600"}`}>
              {energy.zone === "risk" ? "Restoration Tips" : "Momentum Tips"}
            </h3>
            {/* Restoration Tips */}
            <div className="grid gap-4 sm:grid-cols-3">
              {energy.zone === "risk" ? (
                <>
                  <TipCard 
                    icon={<LeafIcon />} 
                    title="Take a Break" 
                    text="Step away for 15 minutes. A short walk resets your focus." 
                    onClick={() => setIsBreathing(true)} 
                    isAtRisk={true}
                  />
                  <TipCard 
                    icon={<TargetIcon />} 
                    title="Smallest Step" 
                    text="Pick one item from the highlighted nodes. That's today's win." 
                    onClick={() => {
                      setFocusTrigger(p => p + 1);
                      window.scrollTo({ top: 400, behavior: "smooth" });
                    }} 
                    isAtRisk={true}
                  />
                  <TipCard 
                    icon={<ChatIcon />} 
                    title="Talk to Someone" 
                    text="Reach out to a friend, mentor, or counselor today." 
                    onClick={() => setShowSupport(true)} 
                    isAtRisk={true}
                  />
                </>
              ) : (
                <>
                  <TipCard icon={<FlagIcon />} title="Set Milestones" text="Break big goals into sprints for steady progress." onClick={() => setShowMilestones(true)} />
                  <TipCard icon={<ChartIcon />} title="Energy Pulse" text="Check in weekly to keep your capacity high." onClick={() => setShowCheckin(true)} />
                  <TipCard icon={<CompassIcon />} title="Explore Broadly" text="Try paths outside your comfort zone." onClick={() => void loadCareerMap(true)} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breathing Oasis Modal */}
      {isBreathing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#0d141a]/98 backdrop-blur-[40px] animate-in fade-in duration-1000">
          <div className="flex flex-col items-center text-center space-y-16 max-w-sm">
            <div className="relative flex items-center justify-center h-64 w-64">
              {/* Outer soft glow */}
              <div className="absolute h-full w-full rounded-full bg-calm-mint/5 animate-pulse-slow blur-2xl" />
              {/* Pulsing core layer 1 */}
              <div className="absolute h-48 w-48 rounded-full border border-calm-mint/20 animate-breath opacity-40 shadow-[0_0_50px_rgba(110,231,183,0.1)]" />
              {/* Pulsing core layer 2 */}
              <div className="absolute h-40 w-40 rounded-full bg-calm-mint/10 animate-breath-delayed shadow-[inset_0_0_30px_rgba(110,231,183,0.1)]" />
              {/* Center dot */}
              <div className="relative h-4 w-4 rounded-full bg-calm-mint/40 shadow-[0_0_20px_rgba(110,231,183,0.5)]" />
            </div>
            
            <div className="space-y-6 animate-fade-up">
              <h2 className="text-3xl font-light text-white/90 tracking-[0.2em] uppercase">Oasis Breath</h2>
              <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-[280px]">
                Inhale with the rise,<br />exhale with the fall.
              </p>
            </div>
            
            <button 
              onClick={() => setIsBreathing(false)}
              className="group relative rounded-full border border-white/5 bg-white/3 px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 hover:bg-white/10 hover:text-white transition-all duration-700 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">Return to Oasis</span>
              <div className="absolute inset-0 rounded-full bg-calm-mint/5 blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      )}

      {/* Zen Reflection Modal */}
      {isReflecting && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#0d141a]/98 backdrop-blur-[40px] animate-in fade-in duration-1000">
          <div className="flex flex-col items-center text-center space-y-12 max-w-lg">
            <div className="h-1 bg-calm-teal/20 w-32 rounded-full overflow-hidden">
              <div className="h-full bg-calm-teal animate-pulse-slow shadow-[0_0_10px_rgba(74,155,142,0.5)]" />
            </div>
            
            <div className="space-y-6">
              <h2 className="text-3xl font-light text-white/90 tracking-[0.2em] uppercase">Zen Reflection</h2>
              <div className="relative group">
                <textarea 
                  autoFocus
                  placeholder="In one breath, what is your intention today?"
                  className="w-full bg-transparent border-none text-xl text-slate-300 placeholder:text-slate-600 focus:ring-0 text-center resize-none h-32 leading-relaxed font-medium"
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-24 bg-gradient-to-r from-transparent via-calm-teal/30 to-transparent transition-all duration-1000 group-hover:w-full" />
              </div>
            </div>

            <p className="text-xs text-slate-600 max-w-sm italic">
              "When you know your 'why', you can survive any 'how'."
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setIsReflecting(false)}
                className="group relative rounded-full border border-white/5 bg-white/3 px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 hover:bg-white/10 hover:text-white transition-all duration-700 hover:scale-105"
              >
                Save Intention
              </button>
            </div>
          </div>
        </div>
      )}
      {showSupport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0d141a]/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="absolute inset-0" onClick={() => setShowSupport(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/5 bg-[#1a1a1a] p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Supportive Connections</h3>
            <div className="grid gap-4">
              {[
                { label: "Counseling Services", desc: "Speak with a professional mentor.", icon: <PhoneIcon />, url: "https://www.psychologytoday.com/us/therapists" },
                { label: "Peer Support Circle", desc: "Connect with students on a similar path.", icon: <UserGroupIcon />, url: "https://www.7cups.com/" },
                { label: "Crisis Support (988)", desc: "24/7 immediate assistance and talk.", icon: <LifebuoyIcon />, url: "tel:988" }
              ].map((s, i) => (
                <a 
                  key={i} 
                  href={s.url}
                  target={s.url.startsWith("http") ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-2xl bg-white/3 border border-white/5 p-5 text-left hover:bg-white/5 transition-all group no-underline"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-400 group-hover:bg-calm-teal/20 group-hover:text-calm-cyan transition-all">
                    {s.icon}
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200">{s.label}</span>
                    <span className="text-xs text-slate-500">{s.desc}</span>
                  </div>
                </a>
              ))}
            </div>
            <button 
              onClick={() => setShowSupport(false)}
              className="mt-8 w-full rounded-full bg-white/3 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 pt-10 pb-12 animate-fade-in" style={{ animationDelay: "300ms" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 opacity-60">
                <img src="/manasetu-logo-transparent.png" alt="ManaSetu" className="h-6 w-6" />
                <span className="text-sm font-bold tracking-tight text-white uppercase italic">ManaSetu</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                © {new Date().getFullYear()} ManaSetu AI. All rights reserved.
              </p>
            </div>

            <div className="max-w-xl">
              <p className="text-[10px] leading-[1.7] text-slate-600 font-medium text-left md:text-right">
                <strong className="text-slate-500 uppercase tracking-widest mr-2 inline-block mb-1 border-b border-white/5 pb-0.5">Medical & AI Disclaimer</strong><br />
                ManaSetu is an AI-powered guidance tool. All wellbeing and career suggestions are generated by AI for informational purposes only and do not constitute professional mental health, medical, or legal advice. If you are experiencing a crisis, please contact professional emergency services immediately.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {showCheckin && (
        <CapacityCheckin userId={userId} onComplete={handleCheckinComplete} onClose={() => setShowCheckin(false)} />
      )}

      {showMilestones && (
        <MilestoneTracker userId={userId} onClose={() => setShowMilestones(false)} />
      )}

      {showSettings && (
        <ProfileSettings
          userId={userId}
          onClose={() => setShowSettings(false)}
          onProfileUpdated={() => loadCareerMap()}
          onLogout={onLogout}
        />
      )}

      {/* Community Validation Echo */}
      <EchoEffect />

      {/* Global Milestone Details Modal */}
      {selectedNodeId && payload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[32px] bg-[#121212]/70 animate-in fade-in duration-700">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedNodeId(null)}
          />
          <div className="relative w-full max-w-2xl rounded-[1.25rem] border border-white/5 bg-[#1a1a1a]/70 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5 animate-in zoom-in-95 duration-500 overflow-hidden backdrop-blur-xl">
            {/* Soft Ambient Glows */}
            <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-calm-amber/5 blur-[80px]" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-calm-teal/5 blur-[80px]" />

            <button
              onClick={() => setSelectedNodeId(null)}
              className="absolute right-8 top-8 z-50 flex h-12 w-12 items-center justify-center rounded-3xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all duration-500 border border-white/5 hover:scale-110"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {(() => {
              const node = payload.nodes.find(n => n.id === selectedNodeId);
              if (!node) return null;
              const data = node.data;
              const checklist = (data.checklist as string[]) ?? [];
              const itemsCompleted = (data.items_completed as string[]) ?? [];
              const resources = (data.resources as { label: string, url: string }[]) ?? [];
              const completed = Boolean(data.completed);

              return (
                <div className="relative">
                  <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div className="max-w-2xl space-y-4">
                      <div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] transform-gpu ring-1 transition-all duration-700 ${completed ? "bg-calm-mint/15 text-calm-mint ring-calm-mint/40 shadow-[0_0_20px_rgba(110,231,183,0.15)]" : "bg-calm-teal/10 text-calm-cyan ring-calm-teal/20"
                        }`}>
                        {completed ? (
                          <>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Goal Achieved
                          </>
                        ) : (
                          `${String(data.stressLevel || "Low")} Energy Phase`
                        )}
                      </div>

                      <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-snug">
                        {String(data.label || "Strategic Step")}
                      </h3>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Timeframe</span>
                      <span className="text-lg font-bold text-white">
                        {Number(data.timelineMonths) === 0 ? "Strategic Start" : `${data.timelineMonths} Months`}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-3">Guidance</span>
                        <p className="text-base leading-relaxed text-slate-400 font-medium border-l-2 border-calm-amber/20 pl-6 py-0">
                          "{String(data.description || "In silence, we find the clarity to grow.")}"
                        </p>
                      </div>

                      {checklist.length > 0 && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-3">Milestone Steps</span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-32 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full bg-calm-mint transition-all duration-1000"
                                  style={{ width: `${(itemsCompleted.length / checklist.length) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-black text-calm-teal tracking-widest">
                                {Math.round((itemsCompleted.length / checklist.length) * 100)}%
                              </span>
                            </div>
                          </div>

                          <div className="grid gap-3 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
                            {checklist.map((item, idx) => {
                              const isDone = itemsCompleted.includes(item);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const newCompleted = isDone
                                      ? itemsCompleted.filter(i => i !== item)
                                      : [...itemsCompleted, item];
                                    const isNowComplete = newCompleted.length === checklist.length && checklist.length > 0;
                                    handleMilestoneUpdate(selectedNodeId, isNowComplete, newCompleted);
                                  }}
                                  className={`group flex w-full items-center gap-6 rounded-xl border p-5 px-6 text-left transition-all duration-700 ${isDone
                                      ? "border-calm-teal/5 bg-calm-teal/2 text-slate-500"
                                      : "border-white/[0.03] bg-white/[0.01] text-slate-400 hover:bg-white/[0.04] hover:border-white/[0.08]"
                                    }`}
                                >
                                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-1000 ${isDone ? "bg-calm-mint/20 border-calm-mint/40 text-calm-mint scale-105" : "border-white/10 bg-transparent group-hover:border-white/20"
                                    }`}>
                                    {isDone && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}><path d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <span className={`text-[14px] font-medium leading-tight transition-all duration-500 ${isDone ? "line-through opacity-40 italic" : ""}`}>{item}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-10">
                      {resources.length > 0 && (
                        <div className="space-y-5">
                          <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-3">Resource Depth</span>
                          <div className="grid grid-cols-1 gap-3">
                            {resources.map((res, idx) => (
                              <a
                                key={idx}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center justify-between rounded-2xl bg-white/3 border border-white/3 p-5 hover:bg-white/5 hover:border-white/8 transition-all duration-500 hover:translate-x-1 shadow-sm"
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="text-[14px] font-semibold text-slate-300 group-hover:text-white transition-colors">{res.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-1 w-1 rounded-full bg-calm-mint" />
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Verified Link</span>
                                  </div>
                                </div>
                                <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-calm-cyan group-hover:bg-calm-teal/20 transition-all focus:ring-0">
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl bg-white/[0.02] p-8 border border-white/[0.04] space-y-6 relative overflow-hidden backdrop-blur-sm shadow-sm transition-all duration-700 hover:bg-white/[0.03]">
                        <div className="absolute top-0 right-0 h-24 w-24 bg-calm-amber/5 blur-3xl opacity-20" />
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-3 text-left">Summary</h4>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            Steady momentum builds from these quiet wins. You are exactly where you need to be.
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedNodeId(null)}
                          className="w-full rounded-full bg-calm-amber/5 border border-calm-amber/10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-calm-amber/60 hover:bg-calm-amber/10 hover:text-calm-amber transition-all duration-700"
                        >
                          I'm Resting Here
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function ActionButton({ icon, title, sub, onClick, isAtRisk }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; isAtRisk?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-[3000ms] ${
        isAtRisk 
        ? "bg-calm-amber/5 border-calm-amber/10 text-calm-amber/80 hover:bg-calm-amber/15 hover:border-calm-amber/20" 
        : "bg-white/3 border-white/3 text-slate-400 hover:bg-white/6 hover:text-white hover:border-white/8"
      }`}
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-[3000ms] ${
        isAtRisk 
        ? "bg-calm-amber/10 text-calm-amber group-hover:bg-calm-amber/20" 
        : "bg-white/5 text-slate-500 group-hover:text-white group-hover:bg-calm-teal/15"
      }`}>
        {icon}
      </span>
      <div>
        <span className={`font-semibold transition-colors duration-[3000ms] ${isAtRisk ? "text-calm-amber" : "text-slate-300 group-hover:text-white"}`}>{title}</span>
        <p className={`text-[11px] transition-colors duration-[3000ms] ${isAtRisk ? "text-calm-amber/40" : "text-slate-600"}`}>{sub}</p>
      </div>
    </button>
  );
}

function TipCard({ icon, title, text, onClick, isAtRisk }: { icon: React.ReactNode; title: string; text: string; onClick?: () => void; isAtRisk?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-2xl border p-5 transition-all duration-[3000ms] text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
        isAtRisk 
        ? "bg-calm-amber/5 border-calm-amber/10 hover:bg-calm-amber/10 hover:border-calm-amber/20 hover:shadow-calm-amber/5" 
        : "bg-white/3 border-white/3 hover:bg-white/5 hover:border-white/8 hover:shadow-calm-teal/5"
      }`}
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-[3000ms] ${
        isAtRisk 
        ? "bg-calm-amber/10 text-calm-amber group-hover:bg-calm-amber/20" 
        : "bg-calm-teal/10 text-calm-cyan group-hover:bg-calm-teal/15"
      }`}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className={`mt-1.5 text-xs leading-relaxed transition-colors duration-[3000ms] ${isAtRisk ? "text-calm-amber/60" : "text-slate-500"}`}>{text}</p>
      <div className={`mt-3 flex items-center gap-1 text-[10px] font-medium transition-colors duration-[3000ms] ${
        isAtRisk ? "text-calm-amber/60 group-hover:text-calm-amber" : "text-calm-cyan/60 group-hover:text-calm-cyan"
      }`}>
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


function RefreshIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function PhoneIcon() {
  return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 013.06 2L6.06 2a2 2 0 012 1.72 12.81 12.81 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>;
}

function UserGroupIcon() {
  return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m15-9a4 4 0 00-4-4H9a4 4 0 00-4 4v2m15-9a4 4 0 00-4-4H9a4 4 0 00-4 4v2m15-9a4 4 0 00-4-4H9a4 4 0 00-4 4v2" /></svg>;
}

function LifebuoyIcon() {
  return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M14.83 9.17l4.34-4.34M9.17 14.83l-4.34 4.34M9.17 9.17L4.83 4.83m10.34 10.34l4.34 4.34" /></svg>;
}
