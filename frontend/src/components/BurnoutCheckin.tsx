import { useState } from "react";

type BurnoutCheckinProps = {
  userId: string;
  onComplete: (result: { score: number; zone: string }) => void;
  onClose: () => void;
};

const QUESTIONS = [
  { text: "How energized do you feel about your career goals this week?", low: "Very energized", high: "Completely drained" },
  { text: "How overwhelmed are you by your current workload?", low: "Very manageable", high: "Extremely overwhelmed" },
  { text: "How well have you been sleeping?", low: "Sleeping great", high: "Barely sleeping" },
  { text: "How anxious do you feel about the future?", low: "Calm and confident", high: "Very anxious" },
  { text: "How connected do you feel to the people around you?", low: "Very connected", high: "Isolated" },
];

export default function BurnoutCheckin({ userId, onComplete, onClose }: BurnoutCheckinProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAnswer = async (value: number) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setLoading(true);
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "";
        const res = await fetch(`${base}/api/burnout/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, answers: newAnswers }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        onComplete(data);
      } catch {
        const raw = newAnswers.reduce((a, b) => a + b, 0) / (newAnswers.length * 5);
        const score = Math.round(raw * 100);
        const zone = score <= 35 ? "healthy" : score <= 65 ? "early_warning" : "risk";
        onComplete({ score, zone });
      }
    }
  };

  const q = QUESTIONS[current];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a24]/85 backdrop-blur-xl animate-fade-in">
      <div className="glass-card w-full max-w-md p-7 mx-4 gradient-border animate-fade-up">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Weekly Check-in</h2>
            <p className="mt-1 text-xs text-slate-600">
              Question {current + 1} of {QUESTIONS.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-all duration-500 hover:bg-white/5 hover:text-white border border-white/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="mb-7 flex gap-1.5">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-700 ${i < current
                ? "bg-calm-teal"
                : i === current
                  ? "bg-gradient-to-r from-calm-teal to-calm-cyan shadow-sm shadow-calm-teal/30"
                  : "bg-white/5"
                }`}
            />
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-5 py-10">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-calm-teal/30 border-t-calm-teal" />
              <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-calm-blue/20 border-b-calm-blue" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <p className="text-sm text-slate-500 font-medium">Analyzing your responses...</p>
          </div>
        ) : (
          <div className="animate-slide-in" key={current}>
            <div className="mb-7 text-center px-2">
              <p className="text-base font-semibold text-white leading-relaxed">{q.text}</p>
            </div>

            <div className="mb-4 flex justify-between text-[10px] uppercase tracking-[0.15em] text-slate-600 font-medium px-1">
              <span>{q.low}</span>
              <span>{q.high}</span>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleAnswer(val)}
                  className="group relative flex h-16 items-center justify-center rounded-2xl border border-white/5 bg-white/3 text-lg font-bold text-slate-500 transition-all duration-500 hover:scale-105 hover:border-calm-teal/30 hover:bg-calm-teal/15 hover:text-white hover:shadow-lg hover:shadow-calm-teal/10 active:scale-95"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
