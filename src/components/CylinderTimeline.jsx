import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import WeatherWindow from './WeatherWindow';
import CitySearch from './CitySearch';
import { getSystemTheme } from '../utils/weatherLogic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useWeatherForecast from '../hooks/useWeatherForecast';

// ── Module-level constants ────────────────────────────────────────────────────

const TOTAL_DAYS           = 8;
const ROTATION_PER_CARD    = 360 / TOTAL_DAYS; // 45° per card face
const ROTATION_SENSITIVITY = 0.15;             // px → degrees
const THRESHOLD_DEGREES    = 12;               // min drag to commit a slide
const WHEEL_THROTTLE_MS    = 800;              // ms between wheel-triggered slides
const CYLINDER_TRANSITION  = 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)';

// ── Component ─────────────────────────────────────────────────────────────────

export default function CylinderTimeline({ initialWeather }) {
  // ── Weather Forecast custom hook ───────────────────────────────────────────
  const {
    coords,
    activeIndex,
    setActiveIndex,
    days,
    loadedData,
    selectCity,
  } = useWeatherForecast(initialWeather);

  // ── Cumulative rotation (fixes wrap-around bug) ───────────────────────────────
  const cumulativeRotation = useRef(0); // total CSS degrees; grows without bound

  // ── DOM refs — transform written directly, bypassing React (FPS fix) ──────────
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
   * Locked while the user is interacting with the hourly slider inside a card.
   */
  const sliderLocked = useRef(false);
  const lockCylinder = useCallback((locked) => {
    sliderLocked.current = locked;
    if (locked && isDragging.current) {
      isDragging.current = false;
      dragOffsetRef.current = 0;
      applyTransform(true);
    }
  }, [applyTransform]);

  /**
   * Navigate by a signed delta (e.g. +1 = next day, -1 = previous day).
   */
  const navigateBy = useCallback((delta) => {
    cumulativeRotation.current -= delta * ROTATION_PER_CARD;
    dragOffsetRef.current = 0;
    setActiveIndex((prev) => ((prev + delta) % TOTAL_DAYS + TOTAL_DAYS) % TOTAL_DAYS);
    applyTransform(true);
  }, [applyTransform, setActiveIndex]);

  /**
   * Navigate to a specific index via the shortest arc (for tab/dot clicks).
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
  }, [applyTransform, setActiveIndex]);

  /**
   * Commits the current drag to a navigation step or snaps back.
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

  // ── Touch handlers ────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (sliderLocked.current) return; // slider has priority
    startX.current     = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (sliderLocked.current || !isDragging.current) return;
    dragOffsetRef.current = (e.touches[0].clientX - startX.current) * ROTATION_SENSITIVITY;
    applyTransform(false);
  }, [applyTransform]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    commitDrag();
  }, [commitDrag]);

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (sliderLocked.current) return; // slider has priority
    if (e.target.closest('input, button, a, select, option, ul, li')) return;
    startX.current                = e.clientX;
    isDragging.current            = true;
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (sliderLocked.current || !isDragging.current) return;
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
    if (sliderLocked.current) return; // slider has priority
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
    selectCity(newCity);
    navigateTo(0); // reset visual rotation to Today
  }, [selectCity, navigateTo]);

  // ── Dynamic page background ─────────────────────────────────────────────────────
  const activeWeather = loadedData[days[activeIndex]]?.data;
  const activeTheme   = activeWeather
    ? getSystemTheme(activeWeather.weatherCode)
    : 'from-slate-800 to-slate-950';

  /**
   * Page-level darkness overlay.
   * Updates via direct DOM mutation (bgDarknessRef) so the active card's slider
   * can drive the page brightness without triggering a React re-render chain.
   */
  const bgDarknessRef = useRef(null);
  const handleCardHourChange = useCallback((hour) => {
    if (!bgDarknessRef.current) return;
    const opacity = 0.1 + (Math.abs(hour - 12) / 12) * 0.45;
    bgDarknessRef.current.style.opacity = String(opacity);
  }, []);

  // Initial page darkness from current clock time.
  const initialPageDarkness = (() => {
    const h = new Date().getHours();
    return 0.1 + (Math.abs(h - 12) / 12) * 0.45;
  })();

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
      {/* ─ Page-level time-based darkness overlay ─ */}
      <div
        ref={bgDarknessRef}
        className="absolute inset-0 bg-black pointer-events-none z-0"
        style={{
          opacity: initialPageDarkness,
          transition: 'opacity 1s ease',
        }}
      />
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
                className={`px-3 py-1.5 text-[9px] tracking-widest font-light transition-all ${
                  isActive
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold'
                    : 'bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10'
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
          transform is controlled entirely via cylinderRef (DOM mutation).
        */}
        <div
          ref={cylinderRef}
          className="preserve-3d w-full h-[80vh] flex items-center justify-center"
          style={{
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
                  onSliderInteract={lockCylinder}
                  onHourChange={handleCardHourChange}
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
