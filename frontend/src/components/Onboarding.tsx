import { useState, useCallback } from "react";

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
  const [sleepHours, setSleepHours] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [restHours, setRestHours] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [mode, setMode] = useState<"onboard" | "login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  
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
      setSuggestionsSource(data.source === "gemini" || data.source === "xai" ? "gemini" : "fallback");
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

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
        body: JSON.stringify({ 
          name,
          major, 
          skills, 
          interests,
          sleep_hours: parseInt(sleepHours) || 0,
          work_hours: parseInt(workHours) || 0,
          rest_hours: parseInt(restHours) || 0,
          user_id: authUserId || undefined,
        }),
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
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const authRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.detail || "Invalid email or password.");
      
      const activeUserId = authData.user_id;
      const res = await fetch(`${base}/api/profile/${activeUserId}`);
      if (!res.ok) {
        setAuthUserId(activeUserId);
        setMode("onboard");
      } else {
        onComplete(activeUserId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const authRes = await fetch(`${base}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.detail || "Could not sign up.");
      
      setAuthUserId(authData.user_id);
      setMode("onboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign up.");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = [
    major.trim().length > 0, 
    skills.length >= 1, 
    interests.length >= 1,
    !!sleepHours && !!workHours && !!restHours
  ];

  return (
    <div className="relative flex flex-col min-h-screen overflow-x-hidden overflow-y-auto bg-surface-0">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-calm-teal/5 blur-[120px] animate-float opacity-30" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-calm-blue/5 blur-[100px] animate-float opacity-20" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        
          {/* Left Side: Pitch */}
          <div className="hidden lg:flex flex-col justify-center animate-fade-up">
            <div className="mb-8 flex items-center gap-4">
              <img src="/manasetu-logo-transparent.png" alt="ManaSetu" className="h-14 w-14 drop-shadow-[0_0_20px_rgba(74,155,142,0.6)]" />
              <h1 className="text-3xl font-extrabold tracking-tight text-white">ManaSetu</h1>
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              Redefining Career Growth for <span className="text-transparent bg-clip-text bg-gradient-to-r from-calm-teal to-calm-cyan">Mental Wellbeing.</span>
            </h2>
            <div className="space-y-6 text-slate-300">
              <p className="text-base leading-relaxed">
                <strong className="text-calm-cyan font-semibold block mb-1 uppercase tracking-widest text-xs">The Problem</strong> Over 70% of students experience severe burnout. Traditional tools ignore human limits.
              </p>
              <p className="text-base leading-relaxed">
                <strong className="text-calm-mint font-semibold block mb-1 uppercase tracking-widest text-xs">Our Solution</strong> ManaSetu factors in your sleep and stress for a forgiving career path.
              </p>
            </div>
          </div>

          {/* Right Side: Wizard */}
          <div className="w-full max-w-md mx-auto relative">
            {/* Progress */}
            {mode === "onboard" && (
              <div className="mb-8 flex gap-2 animate-fade-up">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-700 ${i <= step ? "bg-gradient-to-r from-calm-teal to-calm-cyan" : "bg-slate-800/60"}`} />
                ))}
              </div>
            )}

            <div className="glass-card gradient-border p-7 animate-fade-up">
              {/* Auth Mode */}
              {mode === "signup" && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-bold text-white">Create Account</h2>
                  <div className="space-y-4">
                    <input className="input-field" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="input-field" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className="input-field" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <button className="btn-primary w-full" onClick={handleSignup} disabled={loading}>Sign Up</button>
                  <p className="text-center text-xs text-slate-400">
                    Already have an account? <button onClick={() => setMode("login")} className="text-calm-cyan">Log in</button>
                  </p>
                </div>
              )}

              {mode === "login" && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                  <div className="space-y-4">
                    <input className="input-field" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className="input-field" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <button className="btn-primary w-full" onClick={handleLogin} disabled={loading}>Log In</button>
                  <p className="text-center text-xs text-slate-400">
                    New to ManaSetu? <button onClick={() => setMode("signup")} className="text-calm-cyan">Create account</button>
                  </p>
                </div>
              )}

              {/* Onboarding Steps */}
              {mode === "onboard" && (
                <div className="animate-fade-in">
                  {step === 0 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-white">What's your major?</h2>
                      <input className="input-field" placeholder="e.g. Computer Science" value={major} onChange={(e) => setMajor(e.target.value)} />
                      <button className="btn-primary w-full" onClick={goToStep1} disabled={!canProceed[0]}>Continue</button>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-white">Your skills</h2>
                      <div className="flex flex-wrap gap-2">
                        {skillSuggestions.map(s => (
                          <button key={s} onClick={() => toggleItem(skills, setSkills, s)} className={`chip ${skills.includes(s) ? "chip-active" : ""}`}>{s}</button>
                        ))}
                      </div>
                      <button className="btn-primary w-full" onClick={() => setStep(2)} disabled={!canProceed[1]}>Continue</button>
                    </div>
                  )}
                  {step === 2 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-white">Interests</h2>
                      <div className="flex flex-wrap gap-2">
                        {interestSuggestions.map(s => (
                          <button key={s} onClick={() => toggleItem(interests, setInterests, s)} className={`chip ${interests.includes(s) ? "chip-accent" : ""}`}>{s}</button>
                        ))}
                      </div>
                      <button className="btn-primary w-full" onClick={() => setStep(3)} disabled={!canProceed[2]}>Continue</button>
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-white">Daily routine</h2>
                      <div className="space-y-4">
                        <input className="input-field" type="number" placeholder="Hours slept" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
                        <input className="input-field" type="number" placeholder="Hours worked" value={workHours} onChange={(e) => setWorkHours(e.target.value)} />
                        <input className="input-field" type="number" placeholder="Hours rested" value={restHours} onChange={(e) => setRestHours(e.target.value)} />
                      </div>
                      <button className="btn-primary w-full" onClick={handleSubmit} disabled={loading}>Launch ManaSetu</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 w-full border-t border-white/5 bg-black/10 backdrop-blur-sm py-10 mt-auto">
        <div className="mx-auto max-w-6xl px-8 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <img src="/manasetu-logo-transparent.png" alt="ManaSetu" className="h-5 w-5 grayscale opacity-50" />
              <span className="text-xs font-bold tracking-widest text-white uppercase italic">ManaSetu</span>
            </div>
            <p className="text-[10px] text-slate-600 font-medium">© {new Date().getFullYear()} ManaSetu AI.</p>
          </div>
          <div className="max-w-xl text-center md:text-right">
            <p className="text-[10px] leading-relaxed text-slate-600 font-medium italic">
              <strong className="text-slate-500 uppercase tracking-widest mr-2 not-italic">Medical & AI Disclaimer:</strong>
              ManaSetu is an AI tool. Suggestions are for informational purposes only and do not constitute professional mental health or medical advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
