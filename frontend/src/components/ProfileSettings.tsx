import { useState, useEffect } from "react";

type ProfileSettingsProps = {
  userId: string;
  onClose: () => void;
  onProfileUpdated: () => void;
  onLogout: () => void;
};

export default function ProfileSettings({ userId, onClose, onProfileUpdated, onLogout }: ProfileSettingsProps) {
  
  // Profile state
  const [major, setMajor] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [sleepHours, setSleepHours] = useState("7");
  const [workHours, setWorkHours] = useState("8");
  const [restHours, setRestHours] = useState("4");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current profile
    const loadProfile = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "";
        const res = await fetch(`${base}/api/profile/${userId}`);
        if (!res.ok) throw new Error("Could not load profile");
        const data = await res.json();
        if (data.profile) {
          setMajor(data.profile.major || "");
          setSkills((data.profile.skills || []).join(", "));
          setInterests((data.profile.interests || []).join(", "));
          setSleepHours(String(data.profile.sleep_hours || 7));
          setWorkHours(String(data.profile.work_hours || 8));
          setRestHours(String(data.profile.rest_hours || 4));
          if (data.profile.email) setEmail(data.profile.email);
          if (data.profile.name) setName(data.profile.name);
        }
      } catch (err) {
        console.error("Profile load error", err);
      }
    };
    void loadProfile();
  }, [userId]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name,
          major,
          skills: skills.split(",").map(s => s.trim()).filter(Boolean),
          interests: interests.split(",").map(s => s.trim()).filter(Boolean),
          sleep_hours: parseInt(sleepHours) || 0,
          work_hours: parseInt(workHours) || 0,
          rest_hours: parseInt(restHours) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      setSuccessMsg("Profile updated successfully!");
      onProfileUpdated(); // triggers career map reload in Dashboard
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update password");
      }
      setSuccessMsg("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#0f1a24]/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="relative w-full max-w-md h-full bg-[#0f1a24] border-l border-white/10 shadow-2xl flex flex-col transform transition-transform animate-[slideInRight_0.3s_ease-out] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#0f1a24]/90 backdrop-blur-md px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">Profile & Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-10">

        {error && (
          <div className="mb-6 rounded-xl border border-calm-coral/40 bg-calm-coral/20 px-4 py-3 text-sm text-calm-coral">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 rounded-xl border border-calm-mint/40 bg-calm-mint/20 px-4 py-3 text-sm text-calm-mint">
            {successMsg}
          </div>
        )}

        {/* Profile Form */}
        <section>
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-4">Profile</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Full Name</label>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Major / Field</label>
              <input className="input-field" value={major} onChange={(e) => setMajor(e.target.value)} required />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Skills (comma separated)</label>
              <input className="input-field" value={skills} onChange={(e) => setSkills(e.target.value)} required />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Interests (comma separated)</label>
              <input className="input-field" value={interests} onChange={(e) => setInterests(e.target.value)} required />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Sleep Hrs</label>
                <input type="number" className="input-field text-center" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} min="1" max="24" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Work/Study</label>
                <input type="number" className="input-field text-center" value={workHours} onChange={(e) => setWorkHours(e.target.value)} min="1" max="24" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Rest Hrs</label>
                <input type="number" className="input-field text-center" value={restHours} onChange={(e) => setRestHours(e.target.value)} min="1" max="24" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </section>

        {/* Security Form */}
        <section className="pt-8 border-t border-white/5">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-4">Security</h3>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Current Password</label>
              <input type="password" placeholder="••••••••" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">New Password</label>
              <input type="password" placeholder="••••••••" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Confirm New Password</label>
              <input type="password" placeholder="••••••••" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>

            <button type="submit" disabled={loading || !currentPassword || !newPassword} className="btn-primary w-full mt-2">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* Account Settings */}
        <section className="pt-8 border-t border-white/5">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-4">Account</h3>
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Account Email</label>
              <input type="text" className="input-field bg-white/5 cursor-not-allowed text-slate-400" value={email || "Hidden"} disabled />
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4">
              <button 
                onClick={onLogout}
                className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-300 hover:bg-white/10 border border-white/5 hover:text-white"
              >
                Sign Out
              </button>
              <button 
                onClick={() => alert("During the hackathon demo, data deletion is disabled to preserve your map.")}
                className="w-full rounded-xl bg-transparent px-4 py-3 text-sm font-medium text-calm-coral/80 transition-all duration-300 hover:bg-calm-coral/10 hover:text-calm-coral border border-transparent"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>

        </div>
      </div>
    </div>
  );
}
