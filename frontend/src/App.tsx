import { useState } from "react";
import Onboarding from "./components/Onboarding";
import Dashboard from "./components/Dashboard";

type AppView = "onboarding" | "dashboard";

function App() {
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("manaSetuUserId"));
  const [view, setView] = useState<AppView>(userId ? "dashboard" : "onboarding");

  const handleOnboardComplete = (id: string) => {
    localStorage.setItem("manaSetuUserId", id);
    setUserId(id);
    setView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("manaSetuUserId");
    setUserId(null);
    setView("onboarding");
  };

  return (
    <>
      {view === "onboarding" && <Onboarding onComplete={handleOnboardComplete} />}
      {view === "dashboard" && userId && (
        <Dashboard userId={userId} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
