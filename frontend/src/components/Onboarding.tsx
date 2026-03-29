import { useState, useEffect, useCallback } from "react";

type OnboardingProps = {
  onComplete: (userId: string) => void;
};

// Fallback suggestions (shown while AI loads or if Gemini fails)
const FALLBACK_SKILLS = [
  "Research", "Critical Thinking", "Communication", "Problem Solving",
  "Data Analysis", "Project Management", "Writing", "Teamwork",
  "Presentation", "Time Management", "Leadership", "Creativity",
];
const FALLBACK_INTERESTS = [
  "Industry Research", "Consulting", "Education", "Entrepreneurship",
  "Management", "Technical Specialist", "Policy Making", "Freelancing",
  "Graduate Studies", "Non-Profit Work",
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [major, setMajor] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [mode, setMode] = useState<"onboard" | "login">("onboard");
  const [loginId, setLoginId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI-generated suggestions
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>(FALLBACK_SKILLS);
  const [interestSuggestions, setInterestSuggestions] = useState<string[]>(FALLBACK_INTERESTS);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsSource, setSuggestionsSource] = useState<"fallback" | "gemini">("fallback");

  // Fetch AI suggestions when moving from step 0 → step 1
  const fetchSuggestions = useCallback(async (majorValue: string) => {
    setSuggestionsLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ major: majorValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.skills?.length) setSkillSuggestions(data.skills);
      if (data.interests?.length) setInterestSuggestions(data.interests);
      setSuggestionsSource(data.source === "gemini" ? "gemini" : "fallback");
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
      // Keep the fallback suggestions
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Trigger fetch when transitioning from step 0 to step 1
  const goToStep1 = useCallback(() => {
    setStep(1);
    void fetchSuggestions(major);
  }, [major, fetchSuggestions]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addCustom = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setClear: (v: string) => void,
  ) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
    setClear("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ major, skills, interests }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onComplete(data.user_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/profile/${loginId.trim()}`);
      if (!res.ok) throw new Error("Profile not found. Please check your ID.");
      onComplete(loginId.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = [major.trim().length > 0, skills.length >= 1, interests.length >= 1];

  return (
    <div className="relative flex min-h-full items-center justify-center p-4 overflow-hidden">
      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-calm-teal/6 blur-[120px] animate-float" />
        <div className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-calm-blue/5 blur-[100px] animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="mb-10 text-center animate-fade-up">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-calm-teal to-calm-blue shadow-2xl animate-pulse-glow">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-gradient">CareerPulse</span>
          </h1>
          <p className="mt-3 text-sm text-slate-500 font-medium">Navigate your future without burning out</p>
        </div>

        {/* Progress */}
        {mode === "onboard" && (
          <div className="mb-8 flex gap-2 animate-fade-up" style={{ animationDelay: "80ms" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                  i <= step
                    ? "bg-gradient-to-r from-calm-teal to-calm-cyan shadow-sm shadow-calm-teal/30"
                    : "bg-slate-800/60"
                }`}
              />
            ))}
          </div>
        )}

        {/* Card */}
        <div className="glass-card gradient-border p-7 animate-fade-up" style={{ animationDelay: "160ms" }}>
          
          {/* Login Mode */}
          {mode === "login" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-500">Paste your Secret Profile ID to access your career map.</p>
              </div>
              <input
                className="input-field font-mono text-xs"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoFocus
              />
              {error && (
                <div className="rounded-xl border border-calm-coral/40 bg-calm-coral/20 px-4 py-2.5 text-sm text-calm-coral">
                  {error}
                </div>
              )}
              <button 
                className="btn-primary w-full flex items-center justify-center gap-2" 
                disabled={!loginId.trim() || loading} 
                onClick={handleLogin}
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                ) : "Sign In"}
              </button>
              <button className="btn-secondary w-full" onClick={() => { setMode("onboard"); setError(null); }}>
                Create New Profile
              </button>
            </div>
          )}

          {/* Step 0: Major */}
          {mode === "onboard" && step === 0 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-calm-teal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-calm-cyan">
                  Step 1 of 3
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">What's your major?</h2>
                <p className="mt-2 text-sm text-slate-500">Tell us what you're studying or your field of work.</p>
              </div>
              <input
                id="onboard-major"
                className="input-field"
                placeholder="e.g. Computer Science, Business, Psychology..."
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canProceed[0] && goToStep1()}
                autoFocus
              />
              <button className="btn-primary w-full" disabled={!canProceed[0]} onClick={goToStep1}>
                Continue
              </button>
              
              <div className="pt-3 text-center border-t border-white/5">
                <button 
                  className="text-xs text-slate-500 hover:text-white transition-colors duration-300" 
                  onClick={() => { setMode("login"); setError(null); }}
                >
                  Already have an account? <span className="text-calm-cyan font-medium">Sign in</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Skills */}
          {mode === "onboard" && step === 1 && (
            <div className="space-y-6 animate-slide-in">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-calm-teal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-calm-cyan">
                  Step 2 of 3
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Your skills</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {suggestionsLoading 
                    ? `Generating skills for "${major}"...` 
                    : `Skills relevant to ${major}. Select or add your own.`}
                </p>
              </div>
              
              {suggestionsLoading ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="relative">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-calm-teal/30 border-t-calm-teal" />
                  </div>
                  <p className="text-xs text-slate-500">AI is generating skill suggestions...</p>
                </div>
              ) : (
                <>
                  {suggestionsSource === "gemini" && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-calm-teal/8 px-3 py-1.5 text-[10px] text-calm-cyan font-medium">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      AI-generated for {major}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {skillSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleItem(skills, setSkills, s)}
                        className={`chip ${skills.includes(s) ? "chip-active" : ""}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Add custom skill..."
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom(customSkill, skills, setSkills, setCustomSkill)}
                />
                <button className="btn-secondary !px-5" onClick={() => addCustom(customSkill, skills, setSkills, setCustomSkill)}>
                  Add
                </button>
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={() => setStep(0)}>Back</button>
                <button className="btn-primary flex-1" disabled={!canProceed[1]} onClick={() => setStep(2)}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 2: Interests */}
          {mode === "onboard" && step === 2 && (
            <div className="space-y-6 animate-slide-in">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-calm-blue/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-calm-cyan">
                  Step 3 of 3
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Career interests</h2>
                <p className="mt-2 text-sm text-slate-500">Career directions relevant to {major}. Pick at least one.</p>
              </div>

              {suggestionsSource === "gemini" && (
                <div className="flex items-center gap-1.5 rounded-lg bg-calm-blue/8 px-3 py-1.5 text-[10px] text-calm-cyan font-medium">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI-generated for {major}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {interestSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleItem(interests, setInterests, s)}
                    className={`chip ${interests.includes(s) ? "chip-accent" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Add custom interest..."
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom(customInterest, interests, setInterests, setCustomInterest)}
                />
                <button className="btn-secondary !px-5" onClick={() => addCustom(customInterest, interests, setInterests, setCustomInterest)}>
                  Add
                </button>
              </div>
              {error && (
                <div className="rounded-xl border border-calm-coral/40 bg-calm-coral/20 px-4 py-2.5 text-sm text-calm-coral">{error}</div>
              )}
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary flex-1" disabled={!canProceed[2] || loading} onClick={handleSubmit}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Launch CareerPulse
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-700 animate-fade-in" style={{ animationDelay: "400ms" }}>
          @Copyright Carrerplus 2026
        </p>
      </div>
    </div>
  );
}
