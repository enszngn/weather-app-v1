import { useState, useEffect, useRef } from 'react';
import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import { Droplets, Wind } from 'lucide-react';
import { generateInsights, getSystemTheme } from '../utils/weatherLogic';

/**
 * WeatherWindow — Self-sufficient weather display component.
 *
 * Props:
 *  lat           {number}  – Latitude to display weather for.
 *  lon           {number}  – Longitude to display weather for.
 *  title         {string}  – City name to display (overrides API-resolved name).
 *  date          {string}  – 'current' | 'YYYY-MM-DD' (future: historical support).
 *  initialWeather {object} – Pre-fetched weather object to skip the first fetch.
 *                            Pass null to always fetch immediately.
 *
 * Fetching behaviour:
 *  - On first render with initialWeather → uses provided data, no fetch.
 *  - On first render without initialWeather → fetches from Open-Meteo.
 *  - When lat/lon props change → always re-fetches (city search).
 *  - During re-fetch, keeps previous weather visible + shows "Updating…".
 *
 * Layout (Mathematical vh positioning):
 *  City name  →  top-[38vh]  (2/5 of screen height, bottom-anchored)
 *  Temperature → top-1/2     (exact viewport center)
 *  Insights   →  top-[60vh]  (between center and bottom zone)
 *  Metrics    →  bottom-[8vh] (bottom zone, above edge)
 */
export default function WeatherWindow({ lat, lon, title, date = 'current', initialWeather = null }) {
  const isFirstRender = useRef(true);
  const [weather, setWeather] = useState(initialWeather);
  const [loading, setLoading] = useState(initialWeather === null);
  const [error, setError] = useState(null);

  // ── Time-based algebraic darkness overlay ────────────────────────────────────
  // Noon (720 min from midnight) = lightest (0.2 opacity).
  // Midnight (0 min) = darkest (0.8 opacity).
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const diffFromNoon = Math.abs(minutes - 720);
  const ratio = diffFromNoon / 720;       // 0.0 at noon → 1.0 at midnight
  const darkness = 0.2 + ratio * 0.6;    // maps to 0.2 – 0.8

  // ── Weather data fetching ─────────────────────────────────────────────────────
  useEffect(() => {
    // On the very first render, if caller provided initialWeather, skip fetch.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialWeather !== null) return;
    }

    // Abort controller so rapid lat/lon changes don't cause stale state.
    const controller = new AbortController();

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
          `&daily=uv_index_max&timezone=auto`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
        const data = await res.json();

        setWeather({
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          uvIndex: data.daily.uv_index_max[0],
          weatherCode: data.current.weather_code,
          locationName: title || data.timezone.split('/').pop().replace(/_/g, ' '),
          lat,
          lon,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Could not load weather data.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchWeather();
    return () => controller.abort();
  }, [lat, lon]); // Re-fetch whenever coordinates change

  // ── Derived display values ───────────────────────────────────────────────────
  const themeGradient = weather
    ? getSystemTheme(weather.weatherCode)
    : 'from-slate-800 to-slate-950';
  const insights = weather ? generateInsights(weather) : [];
  const displayName = title || weather?.locationName || '';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative h-[100svh] w-full overflow-hidden transition-colors duration-1000 bg-gradient-to-br ${themeGradient}`}
    >
      {/* ── Time-based darkness overlay ── */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-0 transition-opacity duration-[60000ms]"
        style={{ opacity: darkness }}
      />

      {/* ── Full-screen content layer ── */}
      <div className="absolute inset-0 z-10">

        {/* Loading state (initial load only, no weather data yet) */}
        {loading && !weather && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/50 tracking-[0.4em] font-light animate-pulse text-base uppercase">
              Loading…
            </div>
          </div>
        )}

        {/* Error state (initial load failed) */}
        {error && !weather && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <p className="text-white/35 text-sm text-center uppercase tracking-widest leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* ── Weather content (shown once data is available) ── */}
        {weather && (
          <>
            {/* ─ City Header — bottom-anchored just above temperature ─ */}
            <div className="absolute top-[28vh] inset-x-4 text-center -translate-y-full pb-1 select-none">
              <p className="text-[clamp(0.65rem,1.6svh,0.85rem)] uppercase tracking-[0.45em] text-white/65 leading-relaxed">
                {displayName}
              </p>
              {loading && (
                <span className="text-[clamp(0.55rem,1.2svh,0.7rem)] text-white/30 uppercase tracking-wider">
                  Updating…
                </span>
              )}
            </div>

            {/* ─ Temperature — centered at the 2/5 mark (40vh) ─ */}
            <div className="absolute top-[40vh] inset-x-0 text-center -translate-y-1/2 pointer-events-none select-none">
              <h1 className="text-[clamp(5rem,22svh,13rem)] leading-none font-bold tracking-tighter italic text-white drop-shadow-2xl">
                {Math.round(weather.temp)}°
              </h1>
            </div>

            {/* ─ Insight Cards — at the 4/6 mark (~62vh) ─ */}
            <div className="absolute top-[62vh] inset-x-4 max-h-[14svh] overflow-y-auto custom-scrollbar space-y-[clamp(0.35rem,0.9svh,0.6rem)]">
              {insights.map((text, i) => (
                <InsightCard key={i} text={text} />
              ))}
            </div>

            {/* ─ Metric Cards — at the 5/6 mark (~80vh) ─ */}
            <div className="absolute top-[80vh] inset-x-4">
              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1.5svh,1rem)] opacity-85">
                <MetricCard Icon={Droplets} label="Humidity" value={weather.humidity} unit="%" />
                <MetricCard Icon={Wind}     label="Wind"     value={weather.windSpeed} unit="km/h" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
