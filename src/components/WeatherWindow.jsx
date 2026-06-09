import { useState, useEffect, useRef } from 'react';
import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import { 
  Droplets, 
  Wind, 
  Sun, 
  Cloud, 
  CloudRain, 
  Snowflake, 
  CloudLightning, 
  CloudFog, 
  CloudDrizzle 
} from 'lucide-react';
import { generateInsights, getSystemTheme } from '../utils/weatherLogic';

// Helper to map WMO weather codes to Lucide icons
function getWeatherIcon(code) {
  if (code === 0) return Sun;
  if ([1, 2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return Snowflake;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

/**
 * WeatherWindow — Renders a glassmorphic weather card with absolute layout.
 *
 * Props:
 *  lat           {number}  – Latitude to display weather for.
 *  lon           {number}  – Longitude to display weather for.
 *  title         {string}  – City name.
 *  dateStr       {string}  – YYYY-MM-DD representing the date of this card.
 *  initialWeather {object} – Pre-fetched weather object as fallback.
 *  active        {boolean} – Whether this card is centered/active.
 *  weatherData   {object}  – Parent-provided weather data (for prefetching).
 *  loadingData   {boolean} – Parent-provided loading state.
 *  errorData     {string}  – Parent-provided error state.
 */
export default function WeatherWindow({
  lat,
  lon,
  title,
  dateStr,
  initialWeather = null,
  active = true,
  visible = true,
  weatherData = null,
  loadingData = false,
  errorData = null,
}) {
  const isFirstRender = useRef(true);
  const [weather, setWeather] = useState(initialWeather);
  const [loading, setLoading] = useState(initialWeather === null);
  const [error, setError] = useState(null);

  // ── Time-based algebraic darkness overlay ────────────────────────────────────
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const diffFromNoon = Math.abs(minutes - 720);
  const ratio = diffFromNoon / 720;       // 0.0 at noon → 1.0 at midnight
  const darkness = 0.2 + ratio * 0.6;    // maps to 0.2 – 0.8

  // ── Standalone weather data fetching fallback ────────────────────────────────
  useEffect(() => {
    // If data is provided by parent (CylinderTimeline), skip self-fetching
    if (weatherData !== null) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialWeather !== null) return;
    }

    const controller = new AbortController();

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
          `&hourly=temperature_2m,weather_code` +
          `&daily=uv_index_max&timezone=auto` +
          `&start_date=${dateStr}&end_date=${dateStr}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
        const data = await res.json();

        const currentHour = now.getHours();
        
        // Check if the date corresponds to local today
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const localTodayStr = `${year}-${month}-${day}`;
        const isToday = dateStr === localTodayStr;

        setWeather({
          temp: isToday && data.current ? data.current.temperature_2m : data.hourly.temperature_2m[currentHour],
          humidity: isToday && data.current ? data.current.relative_humidity_2m : (data.hourly.relative_humidity_2m?.[currentHour] ?? 50),
          windSpeed: isToday && data.current ? data.current.wind_speed_10m : (data.hourly.wind_speed_10m?.[currentHour] ?? 10),
          uvIndex: data.daily.uv_index_max[0],
          weatherCode: isToday && data.current ? data.current.weather_code : data.hourly.weather_code[currentHour],
          hourly: data.hourly,
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
  }, [lat, lon, dateStr, weatherData]);

  // Resolve active displays
  const displayWeather = weatherData || weather;
  const displayLoading = weatherData ? loadingData : loading;
  const displayError = weatherData ? errorData : error;

  const themeGradient = displayWeather
    ? getSystemTheme(displayWeather.weatherCode)
    : 'from-slate-800 to-slate-950';
  const insights = displayWeather ? generateInsights(displayWeather) : [];
  const displayName = title || displayWeather?.locationName || '';

  // Calculate 24h hourly forecast starting from current hour
  const currentHour = now.getHours();
  const sortedHourly = [];
  if (displayWeather?.hourly) {
    const times = displayWeather.hourly.time || [];
    const temps = displayWeather.hourly.temperature_2m || [];
    const codes = displayWeather.hourly.weather_code || [];

    // Filter items matching local date prefix YYYY-MM-DD
    const localHourly = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i].startsWith(dateStr)) {
        const timeVal = times[i].split('T')[1]; // "HH:MM"
        localHourly.push({
          time: timeVal,
          temp: temps[i],
          weatherCode: codes[i],
        });
      }
    }

    // Reorder to start from currentHour (wrap around 24 hours)
    if (localHourly.length === 24) {
      for (let i = 0; i < 24; i++) {
        const idx = (currentHour + i) % 24;
        if (localHourly[idx]) {
          sortedHourly.push(localHourly[idx]);
        }
      }
    } else {
      sortedHourly.push(...localHourly);
    }
  }

  // Format date display for header card (e.g. "Tomorrow", "9 Jun")
  const getHeaderDateLabel = (dateString) => {
    const dateObj = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return 'TODAY';
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
      return 'TOMORROW';
    } else {
      return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    }
  };

  let cardClass = '';
  if (active) {
    cardClass = 'scale-100 opacity-100 filter-none pointer-events-auto';
  } else if (visible) {
    cardClass = 'scale-90 opacity-40 pointer-events-none';
  } else {
    cardClass = 'scale-75 opacity-0 pointer-events-none';
  }

  return (
    <div
      className={`relative h-[80vh] w-full max-w-[var(--card-width)] mx-auto overflow-hidden border border-white/20 bg-gradient-to-br ${themeGradient} shadow-2xl transition-all duration-700 ease-out rounded-2xl ${cardClass}`}
    >
      {/* ── Time-based darkness overlay ── */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-0 transition-opacity duration-1000"
        style={{ opacity: darkness }}
      />

      {/* ── Inactive Card Blur Overlay (prevents browser scroll compositing bugs) ── */}
      {!active && visible && (
        <div className="absolute inset-0 bg-slate-950/10 backdrop-blur-[3px] z-20 pointer-events-none" />
      )}

      {/* ── Content Layer ── */}
      <div className="absolute inset-0 z-10 p-4">
        {/* Loading state */}
        {displayLoading && !displayWeather && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/50 tracking-[0.4em] font-light animate-pulse text-xs uppercase">
              Loading…
            </div>
          </div>
        )}

        {/* Error state */}
        {displayError && !displayWeather && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-white/35 text-xs uppercase tracking-widest leading-relaxed">
              {displayError}
            </p>
          </div>
        )}

        {/* Weather details */}
        {displayWeather && (
          <>
            {/* ─ City Header & Date ─ */}
            <div className="absolute top-[7%] inset-x-4 text-center select-none">
              <p className="text-[clamp(0.55rem,1.4vh,0.75rem)] uppercase tracking-[0.45em] text-white/50 leading-relaxed mb-0.5">
                {displayName}
              </p>
              <p className="text-[clamp(0.65rem,1.6vh,0.85rem)] uppercase tracking-[0.3em] font-medium text-cyan-300">
                {getHeaderDateLabel(dateStr)}
              </p>
              {displayLoading && (
                <span className="text-[10px] text-white/30 uppercase tracking-wider animate-pulse block mt-0.5">
                  Updating…
                </span>
              )}
            </div>

            {/* ─ Temperature — centered at 22% vertical ─ */}
            <div className="absolute top-[22%] inset-x-0 text-center pointer-events-none select-none">
              <h1 className="text-[clamp(3.5rem,15vh,7rem)] leading-none font-bold tracking-tighter italic text-white drop-shadow-2xl">
                {Math.round(displayWeather.temp)}°
              </h1>
            </div>

            {/* ─ Insight Cards — at 40% vertical ─ */}
            <div 
              className="absolute top-[40%] inset-x-4 max-h-[10vh] overflow-y-auto custom-scrollbar space-y-1.5"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              {insights.map((text, i) => (
                <InsightCard key={i} text={text} />
              ))}
            </div>

            {/* ─ Hourly Forecast Horizontal Slider — at 54% vertical ─ */}
            {sortedHourly.length > 0 && (
              <div className="absolute top-[54%] inset-x-4">
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/45 mb-1.5 select-none font-light">
                  Hourly Forecast (24h)
                </p>
                <div 
                  className="flex overflow-x-auto gap-2 py-1.5 no-scrollbar scroll-smooth touch-pan-x"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseMove={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {sortedHourly.map((hourItem, idx) => {
                    const IconComp = getWeatherIcon(hourItem.weatherCode);
                    const isCurrent = parseInt(hourItem.time.split(':')[0]) === currentHour;
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-between py-2 px-2.5 min-w-[62px] border transition-all duration-300 ${
                          isCurrent
                            ? 'bg-cyan-500/25 border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.25)]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        } rounded-lg backdrop-blur-sm`}
                      >
                        <span className={`text-[9px] tracking-wider font-light ${isCurrent ? 'text-cyan-300 font-normal' : 'text-white/60'}`}>
                          {hourItem.time}
                        </span>
                        <div className="my-1 text-white/90">
                          <IconComp size={15} strokeWidth={1.5} />
                        </div>
                        <span className="text-[11px] font-semibold text-white">
                          {Math.round(hourItem.temp)}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─ Metric Cards — at 80% vertical ─ */}
            <div className="absolute top-[80%] inset-x-4">
              <div className="grid grid-cols-2 gap-2 opacity-90">
                <MetricCard Icon={Droplets} label="Humidity" value={displayWeather.humidity} unit="%" />
                <MetricCard Icon={Wind} label="Wind" value={displayWeather.windSpeed} unit="km/h" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
