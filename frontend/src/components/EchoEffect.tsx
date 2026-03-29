import { useEffect, useState } from "react";

const COMMUNITY_STRINGS = [
  "142 other students are focusing on recovery today.",
  "45 people successfully pivoted from this step last month.",
  "You are not behind. 80% of users in your major are at this exact stage.",
  "Taking a break is also progress. 65% of peers took 2+ rest days this week.",
  "Your pace is uniquely yours. 120 colleagues are following a similar path.",
  "You're not alone in this—230 students are currently navigating similar career shifts."
];

export function EchoEffect() {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      // Start fade out
      setIsVisible(false);
      
      // After fade out completes (500ms), change text and fade in
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % COMMUNITY_STRINGS.length);
        setIsVisible(true);
      }, 500);
    }, 8000);

    return () => clearInterval(cycleInterval);
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div 
        className={`px-4 py-2 rounded-full bg-slate-900/40 backdrop-blur-md border border-white/5 shadow-lg transition-all duration-1000 ease-in-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <p className="text-[11px] font-medium text-slate-400 tracking-wide text-center flex items-center gap-2 whitespace-nowrap">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500/60"></span>
          </span>
          {COMMUNITY_STRINGS[index]}
        </p>
      </div>
    </div>
  );
}
