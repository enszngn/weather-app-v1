import { useState, useEffect, useCallback } from 'react';
import useWeather from './hooks/useWeather';
import CylinderTimeline from './components/CylinderTimeline';
import StatsPage from './components/StatsPage';

/**
 * App — Root orchestrator.
 *
 * Responsibilities:
 *  1. Client-side routing (/ vs /stats) via History API.
 *  2. Initial weather + location from the Cloudflare Worker (/api/weather).
 *  3. Renders <CylinderTimeline> (full-screen) + stats route.
 */
export default function App() {
  // ── Routing ───────────────────────────────────────────────────────────────────
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    setPath(to);
  }, []);

  // ── Weather & Location ────────────────────────────────────────────────────────
  const { weather, loading, error } = useWeather();

  // ── Stats page ────────────────────────────────────────────────────────────────
  if (path === '/stats' || path === '/stats/') {
    return <StatsPage navigate={navigate} />;
  }

  // ── Loading / error states ────────────────────────────────────────────────────
  if (loading && !weather) return <LoadingScreen />;
  if (error && !weather)   return <ErrorScreen message={error} />;

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {weather && <CylinderTimeline initialWeather={weather} />}
    </div>
  );
}

// ── State screens ─────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
    <div className="text-white tracking-[0.4em] font-light animate-pulse text-xl">SYNCING...</div>
  </div>
);

const ErrorScreen = ({ message }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-10 text-center">
    <div className="max-w-sm text-slate-500 text-sm leading-relaxed uppercase tracking-widest">{message}</div>
  </div>
);