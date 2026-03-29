import { useState, useEffect } from "react";

type Milestone = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type MilestoneTrackerProps = {
  userId: string;
  onClose: () => void;
};

export default function MilestoneTracker({ userId, onClose }: MilestoneTrackerProps) {
  const storageKey = `manaSetuMilestones_${userId}`;
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newText, setNewText] = useState("");

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(milestones));
  }, [milestones, storageKey]);

  const addMilestone = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setMilestones((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: trimmed, done: false, createdAt: Date.now() },
    ]);
    setNewText("");
  };

  const toggleDone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, done: !m.done } : m))
    );
  };

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const doneCount = milestones.filter((m) => m.done).length;
  const totalCount = milestones.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a24]/85 backdrop-blur-xl animate-fade-in">
      <div className="glass-card w-full max-w-lg p-7 mx-4 gradient-border animate-fade-up max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Your Milestones</h2>
            <p className="mt-1 text-xs text-slate-600">
              {totalCount === 0
                ? "Add your first career milestone"
                : `${doneCount} of ${totalCount} completed`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-all duration-300 hover:bg-white/5 hover:text-white border border-white/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Progress</span>
              <span className="text-xs font-bold text-calm-cyan">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-calm-teal to-calm-blue transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Add new milestone */}
        <div className="flex gap-2 mb-5 flex-shrink-0">
          <input
            className="input-field flex-1 !py-3"
            placeholder="e.g. Complete React course, Update resume..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMilestone()}
            autoFocus
          />
          <button
            className="btn-primary !px-5 !py-3 flex items-center gap-1.5"
            disabled={!newText.trim()}
            onClick={addMilestone}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        </div>

        {/* Milestone list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {milestones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/3 border border-white/5">
                <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18m0-15l9 3-9 3m9-6l9 3-9 3" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">No milestones yet</p>
              <p className="mt-1 text-xs text-slate-600">Break your big career goals into achievable 2-week milestones.</p>
            </div>
          ) : (
            milestones.map((m, i) => (
              <div
                key={m.id}
                className={`group flex items-start gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 border ${m.done
                    ? "bg-calm-mint/5 border-calm-mint/10"
                    : "bg-white/2 border-white/3 hover:bg-white/4 hover:border-white/6"
                  }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(m.id)}
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all duration-300 ${m.done
                      ? "border-calm-mint/40 bg-calm-mint/20 text-calm-mint"
                      : "border-white/10 bg-white/3 text-transparent hover:border-calm-teal/30 hover:bg-calm-teal/10"
                    }`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Text */}
                <span
                  className={`flex-1 text-sm transition-all duration-300 ${m.done ? "text-slate-500 line-through" : "text-slate-300"
                    }`}
                >
                  {m.text}
                </span>

                {/* Delete */}
                <button
                  onClick={() => removeMilestone(m.id)}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-slate-700 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-calm-coral/10 hover:text-calm-coral"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {milestones.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5 text-center flex-shrink-0">
            <p className="text-[11px] text-slate-700">
              Milestones are saved locally on this device
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
