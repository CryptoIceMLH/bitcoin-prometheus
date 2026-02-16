import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSetup().then((data) => {
      if (data.firstRun && data.password) {
        setFirstRun(true);
        setGeneratedPassword(data.password);
      }
    }).catch(() => {});
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = firstRun ? generatedPassword : password;
    if (!pw.trim()) return;

    setLoading(true);
    setError("");
    try {
      const { token } = await api.login(pw);
      setToken(token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #FF4500, #FF8C00, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpg" alt="Prometheus" className="w-16 h-16 mb-4 rounded-full" />
          <h1 className="text-2xl font-bold text-fire-amber">Prometheus</h1>
          <p className="text-xs text-gray-500 mt-1">Sovereign Bitcoin Node</p>
        </div>

        {/* First-run: show generated password */}
        {firstRun ? (
          <div className="bg-surface rounded-xl p-6 border border-surface-light/20">
            <h2 className="text-sm font-semibold text-fire-amber mb-2">Welcome — First Time Setup</h2>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Your dashboard password has been generated. Save it somewhere safe — you'll need it to log in.
            </p>

            <div className="flex items-center gap-2 mb-4 bg-surface-dark rounded-lg p-3 border border-surface-light/10">
              <code className="flex-1 text-sm text-white font-mono tracking-wider select-all">
                {generatedPassword}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium rounded bg-surface-light/20 text-gray-300 hover:text-white hover:bg-surface-light/30 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 font-semibold rounded-lg transition-colors text-sm ${
                loading
                  ? "bg-gray-600 text-gray-400 cursor-wait"
                  : "bg-fire-amber text-black hover:bg-fire-gold"
              }`}
            >
              {loading ? "Authenticating..." : "I've Saved It — Continue"}
            </button>
          </div>
        ) : (
          /* Normal login form */
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl p-6 border border-surface-light/20">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dashboard Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              className="input-field w-full mb-4"
            />

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className={`w-full py-3 font-semibold rounded-lg transition-colors text-sm ${
                loading
                  ? "bg-gray-600 text-gray-400 cursor-wait"
                  : "bg-fire-amber text-black hover:bg-fire-gold"
              }`}
            >
              {loading ? "Authenticating..." : "Unlock"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
