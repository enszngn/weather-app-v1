import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import WeatherWindow from './WeatherWindow';
import CitySearch from './CitySearch';
import { getSystemTheme } from '../utils/weatherLogic';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Module-level constants ────────────────────────────────────────────────────

const TOTAL_DAYS           = 8;
const ROTATION_PER_CARD    = 360 / TOTAL_DAYS; // 45° per card face
const ROTATION_SENSITIVITY = 0.15;             // px → degrees
const THRESHOLD_DEGREES    = 12;               // min drag to commit a slide
const WHEEL_THROTTLE_MS    = 800;              // ms between wheel-triggered slides
const CYLINDER_TRANSITION  = 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns today + next N days as YYYY-MM-DD strings. */
function buildDays(count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

/** Builds a normalised weather object from an Open-Meteo forecast API response. */
function normaliseMeteoData(data, dateStr, isToday, fallbackTitle) {
  const currentHour = new Date().getHours();
  return {
    temp:         isToday && data.current ? data.current.temperature_2m          : data.hourly.temperature_2m[currentHour],
    humidity:     isToday && data.current ? data.current.relative_humidity_2m    : (data.hourly.relative_humidity_2m?.[currentHour] ?? 50),
    windSpeed:    isToday && data.current ? data.current.wind_speed_10m           : (data.hourly.wind_speed_10m?.[currentHour] ?? 10),
    uvIndex:      data.daily.uv_index_max[0],
    weatherCode:  isToday && data.current ? data.current.weather_code            : data.hourly.weather_code[currentHour],
    hourly:       data.hourly,
    locationName: fallbackTitle || data.timezone.split('/').pop().replace(/_/g, ' '),
    lat:          data.latitude,
    lon:          data.longitude,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CylinderTimeline({ initialWeather }) {
  // ── Location & active day state ──────────────────────────────────────────────
  const [coords, setCoords] = useState({
    lat:   initialWeather?.lat          ?? 41.0082,
    lon:   initialWeather?.lon          ?? 28.9784,
    title: initialWeather?.locationName ?? 'Istanbul',
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // ── Day strings — memoized so array identity is stable across renders ─────────
  const days = useMemo(() => buildDays(TOTAL_DAYS), []);

  // ── Per-day weather cache — keyed by dateStr ──────────────────────────────────
  const [loadedData, setLoadedData] = useState(() => {
    if (!initialWeather) return {};
    return { [days[0]]: { loading: false, error: null, data: initialWeather } };
  });

  const activeFetches = useRef(new Set());

  // ── Cumulative rotation (fixes wrap-around bug) ───────────────────────────────
  //
  // Problem with the old approach: rotateY = activeIndex * -45°
  //   → jumping from index 7 back to 0 meant CSS went from -315° → 0°,
  //     which is a +315° rotation (7 steps backward) instead of -45° (1 step forward).
  //
  // Fix: accumulate rotations indefinitely. Never wrap/mod the CSS angle.
  //   e.g. 0 → -45 → -90 → ... → -315 → -360 (not 0!) → -405 ...
  //   The cylinder math still works because faces are periodic at 360°.
  //
  const cumulativeRotation = useRef(0); // total CSS degrees; grows without bound

  // ── DOM refs — transform written directly, bypassing React (FPS fix) ──────────
  //
  // dragOffset was previously useState → setDragOffset on every mousemove
  // triggered a full React re-render of all 8 cards (~60×/s = janky).
  // Now: we write directly to style.transform via cylinderRef — zero React renders.
  //
  const cylinderRef   = useRef(null); // ref to the rotating wrapper div
  const dragOffsetRef = useRef(0);    // current drag angle (degrees)
  const isDragging    = useRef(false);
  const startX        = useRef(0);
  const lastWheelTime = useRef(0);

  /**
   * Writes the current cumulative + drag rotation directly to the cylinder DOM node.
   * @param {boolean} animated - Whether to apply the CSS transition.
   */
  const applyTransform = useCallback((animated = true) => {
    if (!cylinderRef.current) return;
    const total = cumulativeRotation.current + dragOffsetRef.current;
    cylinderRef.current.style.transition = animated ? CYLINDER_TRANSITION : 'none';
    cylinderRef.current.style.transform  =
      `translateZ(calc(var(--card-width) * -1.207)) rotateY(${total}deg)`;
  }, []);

  // Initialise transform before first paint (no flash).
  useLayoutEffect(() => { applyTransform(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Navigate by a signed delta (e.g. +1 = next day, -1 = previous day).
   * Accumulates rotation so the cylinder always turns the short way.
   */
  const navigateBy = useCallback((delta) => {
    cumulativeRotation.current -= delta * ROTATION_PER_CARD;
    dragOffsetRef.current = 0;
    setActiveIndex((prev) => ((prev + delta) % TOTAL_DAYS + TOTAL_DAYS) % TOTAL_DAYS);
    applyTransform(true);
  }, [applyTransform]);

  /**
   * Navigate to a specific index via the shortest arc (for tab/dot clicks).
   * Picks −1 step rather than +7 when applicable.
   */
  const navigateTo = useCallback((targetIndex) => {
    const currentIndex =
      ((Math.round(-cumulativeRotation.current / ROTATION_PER_CARD)) % TOTAL_DAYS + TOTAL_DAYS) % TOTAL_DAYS;
    let delta = targetIndex - currentIndex;
    if (delta >  TOTAL_DAYS / 2) delta -= TOTAL_DAYS; // e.g. 7 → -1
    if (delta < -TOTAL_DAYS / 2) delta += TOTAL_DAYS; // e.g. -7 → +1
    cumulativeRotation.current -= delta * ROTATION_PER_CARD;
    dragOffsetRef.current = 0;
    setActiveIndex(targetIndex);
    applyTransform(true);
  }, [applyTransform]);

  /**
   * Commits the current drag to a navigation step or snaps back.
   * Shared by mouse and touch end handlers.
   */
  const commitDrag = useCallback(() => {
    const offset = dragOffsetRef.current;
    isDragging.current = false;
    document.body.style.userSelect = '';
    dragOffsetRef.current = 0;

    if (offset > THRESHOLD_DEGREES) {
      navigateBy(-1); // dragged right → previous day
    } else if (offset < -THRESHOLD_DEGREES) {
      navigateBy(1);  // dragged left  → next day
    } else {
      applyTransform(true); // below threshold → snap back
    }
  }, [navigateBy, applyTransform]);

  // ── Fetch weather for a specific day ─────────────────────────────────────────
  const fetchDataForDate = useCallback(async (dateStr, lat, lon) => {
    const fetchKey = `${dateStr}-${lat}-${lon}`;
    if (activeFetches.current.has(fetchKey)) return;
    activeFetches.current.add(fetchKey);

    setLoadedData((prev) => ({
      ...prev,
      [dateStr]: { loading: true, error: null, data: null },
    }));

    try {
      const url = [
        'https://api.open-meteo.com/v1/forecast',
        `?latitude=${lat}&longitude=${lon}`,
        '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
        '&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
        '&daily=uv_index_max&timezone=auto',
        `&start_date=${dateStr}&end_date=${dateStr}`,
      ].join('');

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const isToday = dateStr === days[0];

      setLoadedData((prev) => {
        // Discard stale responses if the user switched city mid-flight.
        if (prev[dateStr]?.loading === false && prev[dateStr]?.data) return prev;
        return {
          ...prev,
          [dateStr]: {
            loading: false,
            error:   null,
            data:    normaliseMeteoData(data, dateStr, isToday, coords.title),
          },
        };
      });
    } catch (err) {
      console.error(`Fetch failed for date ${dateStr}:`, err);
      setLoadedData((prev) => ({
        ...prev,
        [dateStr]: { loading: false, error: 'Failed to load weather data', data: null },
      }));
    } finally {
      activeFetches.current.delete(fetchKey);
    }
  }, [days, coords.title]);

  // ── Prefetch active + ±2 neighbour days on index/coord change ────────────────
  useEffect(() => {
    const neighbors = [
      activeIndex,
      (activeIndex - 1 + TOTAL_DAYS) % TOTAL_DAYS,
      (activeIndex + 1) % TOTAL_DAYS,
      (activeIndex - 2 + TOTAL_DAYS) % TOTAL_DAYS,
      (activeIndex + 2) % TOTAL_DAYS,
    ];
    neighbors.forEach((idx) => {
      const dateStr = days[idx];
      if (!loadedData[dateStr] || loadedData[dateStr].error) {
        fetchDataForDate(dateStr, coords.lat, coords.lon);
      }
    });
  }, [activeIndex, coords, days, fetchDataForDate, loadedData]);

  // ── Touch handlers ────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    startX.current     = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    dragOffsetRef.current = (e.touches[0].clientX - startX.current) * ROTATION_SENSITIVITY;
    applyTransform(false);
  }, [applyTransform]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    commitDrag();
  }, [commitDrag]);

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('input, button, a, select, option, ul, li')) return;
    startX.current                = e.clientX;
    isDragging.current            = true;
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    dragOffsetRef.current = (e.clientX - startX.current) * ROTATION_SENSITIVITY;
    applyTransform(false); // direct DOM write — zero React renders during drag
  }, [applyTransform]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    commitDrag();
  }, [commitDrag]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) commitDrag();
  }, [commitDrag]);

  // ── Scroll Wheel Navigation ───────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    const now = Date.now();
    if (now - lastWheelTime.current < WHEEL_THROTTLE_MS) return;
    if (e.target.closest('.overflow-x-auto, .overflow-y-auto, .custom-scrollbar')) return;

    if (Math.abs(e.deltaY) > 20 || Math.abs(e.deltaX) > 20) {
      lastWheelTime.current = now;
      navigateBy(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1);
    }
  }, [navigateBy]);

  // ── City selection ─────────────────────────────────────────────────────────────
  const handleSelectCity = useCallback((newCity) => {
    setCoords({ lat: newCity.lat, lon: newCity.lon, title: newCity.name });
    setLoadedData({});  // clear old city's cache
    navigateTo(0);       // reset to Today
  }, [navigateTo]);

  // ── Dynamic page background ───────────────────────────────────────────────────
  const activeWeather = loadedData[days[activeIndex]]?.data;
  const activeTheme   = activeWeather
    ? getSystemTheme(activeWeather.weatherCode)
    : 'from-slate-800 to-slate-950';

  return (
    <div
      className={`relative h-[100svh] w-full overflow-hidden bg-gradient-to-br ${activeTheme} transition-colors duration-1000 flex flex-col justify-between py-6 select-none`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      {/* ─ Top Header: City Search & Day Nav ─ */}
      <div className="w-full flex flex-col items-center gap-4 z-30 select-none">
        <CitySearch onSelectCity={handleSelectCity} />

        {/* Day selector tabs */}
        <div className="flex gap-2 justify-center max-w-full px-4 overflow-x-auto no-scrollbar">
          {days.map((dayStr, idx) => {
            const isActive = idx === activeIndex;
            const dateObj  = new Date(dayStr + 'T00:00:00');
            const dayName  = idx === 0
              ? 'TODAY'
              : dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

            return (
              <button
                key={dayStr}
                onClick={() => navigateTo(idx)}
                className={`px-3 py-1.5 text-[9px] tracking-widest font-light transition-all border ${
                  isActive
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 font-semibold'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
                } rounded-lg`}
              >
                {dayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─ 3D Cylinder Container ─ */}
      <div className="relative flex-1 w-full flex items-center justify-center perspective-1200 overflow-hidden select-none z-10">

        {/*
          Carousel Wheel.
          transform is controlled entirely via cylinderRef (DOM mutation),
          NOT via a React style prop. This gives zero React re-renders during drag.
          useLayoutEffect sets the initial transform before first paint.
        */}
        <div
          ref={cylinderRef}
          className="preserve-3d w-full h-[80vh] flex items-center justify-center"
          style={{
            // Provide a safe initial value; useLayoutEffect overrides before paint.
            transform: 'translateZ(calc(var(--card-width) * -1.207)) rotateY(0deg)',
          }}
        >
          {days.map((dayStr, idx) => {
            const isActive   = idx === activeIndex;
            const isNeighbor = idx === (activeIndex - 1 + TOTAL_DAYS) % TOTAL_DAYS
                            || idx === (activeIndex + 1) % TOTAL_DAYS;
            const weatherItem = loadedData[dayStr];

            return (
              <div
                key={dayStr}
                className="absolute w-full max-w-[var(--card-width)] h-[80vh] preserve-3d"
                style={{
                  transform: `rotateY(${idx * ROTATION_PER_CARD}deg) translateZ(calc(var(--card-width) * 1.207))`,
                }}
              >
                <WeatherWindow
                  title={coords.title}
                  dateStr={dayStr}
                  active={isActive}
                  visible={isActive || isNeighbor}
                  weatherData={weatherItem?.data}
                  loadingData={weatherItem?.loading}
                  errorData={weatherItem?.error}
                />
              </div>
            );
          })}
        </div>

        {/* ─ Side Arrow Controls ─ */}
        <button
          onClick={() => navigateBy(-1)}
          className="absolute left-4 p-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 rounded-full text-white backdrop-blur-md transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20 shrink-0"
          title="Previous Day"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={() => navigateBy(1)}
          className="absolute right-4 p-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 rounded-full text-white backdrop-blur-md transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20 shrink-0"
          title="Next Day"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
