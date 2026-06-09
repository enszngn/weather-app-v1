import React, { useState, useEffect } from 'react';
import useWeather from './hooks/useWeather';
import WeatherWindow from './components/WeatherWindow';
import StatsPage from './components/StatsPage';

/**
 * App — Root orchestrator.
 *
 * Responsibilities:
 *  1. Client-side routing (/ vs /stats) via History API.
 *  2. Initial weather + location from the Cloudflare Worker (/api/weather).
 *  3. selectedLocation state — starts from server IP geolocation,
 *     updated by CitySearch when user picks a different city.
 *  4. Renders <CitySearch> (fixed at top) + <WeatherWindow> (full-screen).
 *
 * Note: All weather display logic, insight generation, and theme gradients
 * live inside WeatherWindow — App.jsx has no weather rendering responsibility.
 */
export default function App() {
  // ── Routing ───────────────────────────────────────────────────────────────────
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  // ── Weather & Location ────────────────────────────────────────────────────────
  // useWeather fetches GET /api/weather — server resolves location via request.cf.
  // The returned weather object includes lat/lon from the server response.
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

      {/* Full-screen weather display — location from server IP geolocation */}
      {weather && (
        <WeatherWindow
          lat={weather.lat}
          lon={weather.lon}
          title={weather.locationName}
          date="current"
          initialWeather={weather}
        />
      )}

      {/* Floating visitor statistics button */}
      <button
        onClick={() => navigate('/stats')}
        className="fixed bottom-4 right-4 z-40 p-3 bg-slate-900/60 hover:bg-slate-900/90 text-white rounded-full border border-slate-700/50 backdrop-blur-md shadow-lg transition-all duration-300 group cursor-pointer"
        title="Visitor Statistics"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 group-hover:scale-110 transition-transform duration-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
          />
        </svg>
      </button>
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