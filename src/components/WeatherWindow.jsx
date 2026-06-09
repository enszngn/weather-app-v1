import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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
  CloudDrizzle,
} from 'lucide-react';
import { generateInsights, getSystemTheme } from '../utils/weatherLogic';

// ── Module-level constants & pure helpers ─────────────────────────────────────

const TOTAL_HOURS = 24;
// Card width (62px) + gap (8px) = 70px per slot.
// Used to compute which card is centered in the snap-slider.
const CARD_SLOT_W = 70;

/** Maps a WMO weather code to its Lucide icon component. */
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
 * Returns a human-readable date label for a card header.
 * Pure function — defined at module level to avoid re-creation on every render.
 */
function getHeaderDateLabel(dateString) {
  const dateObj  = new Date(dateString + 'T00:00:00');
  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (dateObj.toDateString() === today.toDateString())    return 'TODAY';
  if (dateObj.toDateString() === tomorrow.toDateString()) return 'TOMORROW';
  return dateObj
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

/**
 * Shared event handler props that stop touch/mouse/wheel propagation,
 * preventing swipe/drag conflicts between scrollable children and the
 * parent CylinderTimeline gesture handlers.
 */
const STOP_PROPAGATION = {
  onTouchStart: (e) => e.stopPropagation(),
  onTouchMove:  (e) => e.stopPropagation(),
  onTouchEnd:   (e) => e.stopPropagation(),
  onMouseDown:  (e) => e.stopPropagation(),
  onMouseMove:  (e) => e.stopPropagation(),
  onMouseUp:    (e) => e.stopPropagation(),
  onWheel:      (e) => e.stopPropagation(),
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * WeatherWindow — Renders a glassmorphic weather card with absolute layout.
 *
 * Props:
 *  dateStr       {string}  – YYYY-MM-DD representing the date of this card.
 *  title         {string}  – City name override.
 *  active        {boolean} – Whether this card is centered/active.
 *  visible       {boolean} – Whether this card is visible (active or neighbor).
 *  weatherData   {object}  – Parent-provided weather data.
 *  loadingData   {boolean} – Parent-provided loading state.
 *  errorData     {string}  – Parent-provided error state.
 */
export default function WeatherWindow({
  title,
  dateStr,
  active      = true,
  visible     = true,
  weatherData = null,
  loadingData = false,
  errorData   = null,
}) {
  // ── Time-based darkness overlay ───────────────────────────────────────────────
  const now          = new Date();
  const minutes      = now.getHours() * 60 + now.getMinutes();
  const diffFromNoon = Math.abs(minutes - 720);
  const darkness     = 0.2 + (diffFromNoon / 720) * 0.6; // 0.2 at noon → 0.8 at midnight

  // ── Derived values ────────────────────────────────────────────────────────────
  const themeGradient = weatherData
    ? getSystemTheme(weatherData.weatherCode)
    : 'from-slate-800 to-slate-950';

  const displayName = title || weatherData?.locationName || '';

  const insights = useMemo(
    () => generateInsights(weatherData),
    [weatherData]
  );

  // ── Hourly data ───────────────────────────────────────────────────────────────
  //
  // Active tab  (today's card) → reorder so current hour is first in the slider.
  // Inactive tabs              → always start from 00:00 (no reorder).
  //
  const sortedHourly = useMemo(() => {
    if (!weatherData?.hourly) return [];

    const currentHour = now.getHours();
    const times = weatherData.hourly.time           || [];
    const temps = weatherData.hourly.temperature_2m || [];
    const codes = weatherData.hourly.weather_code   || [];

    // Collect all 24 hours that belong to this card's date.
    const dayHours = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i].startsWith(dateStr)) {
        dayHours.push({
          time:        times[i].split('T')[1], // "HH:MM"
          temp:        temps[i],
          weatherCode: codes[i],
        });
      }
    }

    // Active card: reorder so the current hour comes first (wraps around midnight).
    // Inactive cards: keep natural 00:00 → 23:00 order.
    if (active && dayHours.length === TOTAL_HOURS) {
      return Array.from({ length: TOTAL_HOURS }, (_, i) => dayHours[(currentHour + i) % TOTAL_HOURS]);
    }
    return dayHours;
  }, [weatherData, dateStr, active]);

  // ── Snap-to-center slider state ────────────────────────────────────────────
  //
  // The slider uses CSS scroll-snap (x mandatory + snap-align:center on each card)
  // with symmetric left/right padding so that the first and last cards can also
  // reach the exact center of the container.
  //
  // Layout math:
  //   padding-left = padding-right = 50% - (cardWidth/2) = calc(50% - 31px)
  //   When scrollLeft = N * CARD_SLOT_W, card N is centered.
  //
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const sliderRef = useRef(null);

  // Reset slider to position 0 whenever new data loads or the card's active state
  // changes. For the active card sortedHourly[0] = currentHour; for inactive = 00:00.
  useEffect(() => {
    setSelectedHourIndex(0);
    if (sliderRef.current) {
      sliderRef.current.scrollLeft = 0;
    }
  }, [weatherData, active]);

  // Fired on every scroll tick. Computes which card is centered by dividing
  // scrollLeft by the per-slot width, then rounds to the nearest integer.
  const handleSliderScroll = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / CARD_SLOT_W);
    setSelectedHourIndex(Math.max(0, Math.min(idx, sortedHourly.length - 1)));
  }, [sortedHourly.length]);

  // The data for whichever hour-card is currently snapped to center.
  const selectedHourData = sortedHourly[selectedHourIndex] ?? null;

  // ── Derived display values (reflect selected hour) ────────────────────────────
  const displayTemp    = selectedHourData
    ? Math.round(selectedHourData.temp)
    : weatherData ? Math.round(weatherData.temp) : '--';

  const displayCode    = selectedHourData?.weatherCode ?? weatherData?.weatherCode ?? 0;
  const WeatherIcon    = getWeatherIcon(displayCode);

  // ── Card visibility class ─────────────────────────────────────────────────────
  const cardClass = active
    ? 'scale-100 opacity-100 filter-none pointer-events-auto'
    : visible
      ? 'scale-90 opacity-40 pointer-events-none'
      : 'scale-75 opacity-0 pointer-events-none';

  return (
    <div
      className={`relative h-[80vh] w-full max-w-[var(--card-width)] mx-auto overflow-hidden border border-white/20 bg-gradient-to-br ${themeGradient} shadow-2xl transition-all duration-700 ease-out rounded-2xl ${cardClass}`}
    >
      {/* ── Time-based darkness overlay ── */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-0 transition-opacity duration-1000"
        style={{ opacity: darkness }}
      />

      {/* ── Inactive blur overlay (prevents browser scroll compositing bugs) ── */}
      {!active && visible && (
        <div className="absolute inset-0 bg-slate-950/10 backdrop-blur-[3px] z-20 pointer-events-none" />
      )}

      {/* ── Content Layer ── */}
      <div className="absolute inset-0 z-10 p-4">

        {/* Loading state */}
        {loadingData && !weatherData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/50 tracking-[0.4em] font-light animate-pulse text-xs uppercase">
              Loading…
            </div>
          </div>
        )}

        {/* Error state */}
        {errorData && !weatherData && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-white/35 text-xs uppercase tracking-widest leading-relaxed">
              {errorData}
            </p>
          </div>
        )}

        {/* Weather details */}
        {weatherData && (
          <>
            {/* ─ City Header & Date ─ */}
            <div className="absolute top-[7%] inset-x-4 text-center select-none">
              <p className="text-[clamp(0.55rem,1.4vh,0.75rem)] uppercase tracking-[0.45em] text-white/50 leading-relaxed mb-0.5">
                {displayName}
              </p>
              <p className="text-[clamp(0.65rem,1.6vh,0.85rem)] uppercase tracking-[0.3em] font-medium text-cyan-300">
                {getHeaderDateLabel(dateStr)}
              </p>
              {loadingData && (
                <span className="text-[10px] text-white/30 uppercase tracking-wider animate-pulse block mt-0.5">
                  Updating…
                </span>
              )}
            </div>

            {/* ─ Temperature + selected-hour label ─ */}
            <div className="absolute top-[20%] inset-x-0 text-center pointer-events-none select-none">
              {/* Icon + temperature on the same baseline */}
              <div className="flex items-center justify-center gap-2">
                <WeatherIcon
                  size={28}
                  strokeWidth={1.5}
                  className="text-white/70 transition-all duration-300"
                />
                <h1 className="text-[clamp(3.5rem,14vh,6.5rem)] leading-none font-bold tracking-tighter italic text-white drop-shadow-2xl">
                  {displayTemp}°
                </h1>
              </div>
              {/* Hour label — shows which hour is currently selected in the slider */}
              <p className="text-[clamp(0.6rem,1.4vh,0.72rem)] text-cyan-300/70 tracking-[0.3em] mt-1 uppercase font-light transition-all duration-300">
                {selectedHourData ? selectedHourData.time : ''}
              </p>
            </div>

            {/* ─ Insight Cards — at 42% vertical ─ */}
            <div
              className="absolute top-[42%] inset-x-4 max-h-[10vh] overflow-y-auto custom-scrollbar space-y-1.5"
              {...STOP_PROPAGATION}
            >
              {insights.map((text) => (
                <InsightCard key={text} text={text} />
              ))}
            </div>

            {/* ─ Hourly Forecast Snap Slider ─ */}
            {sortedHourly.length > 0 && (
              <div className="absolute top-[56%] inset-x-0">
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/45 mb-2 select-none font-light px-4">
                  Hourly · 24h
                </p>

                {/*
                  Snap container:
                    - overflow-x: scroll  (native scroll, browser handles momentum)
                    - scroll-snap-type: x mandatory  (hard-snap to each card)
                    - padding: calc(50% - 31px) on both sides so card 0 and card 23
                      can both sit at the center of the container
                    - gap: 8px between cards
                  Each child:
                    - scroll-snap-align: center  (snap to this card's center)
                    - width: 62px  (fixed, enables exact CARD_SLOT_W = 70 math)
                */}
                <div
                  ref={sliderRef}
                  className="flex no-scrollbar py-2 touch-pan-x"
                  style={{
                    overflowX:           'scroll',
                    scrollSnapType:      'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    paddingLeft:  'calc(50% - 31px)',
                    paddingRight: 'calc(50% - 31px)',
                    gap:          '8px',
                  }}
                  onScroll={handleSliderScroll}
                  {...STOP_PROPAGATION}
                >
                  {sortedHourly.map((hourItem, i) => {
                    const IconComp  = getWeatherIcon(hourItem.weatherCode);
                    const isSelected = i === selectedHourIndex;
                    return (
                      <div
                        key={hourItem.time}
                        style={{ scrollSnapAlign: 'center', flexShrink: 0, width: '62px' }}
                        className={`flex flex-col items-center justify-between py-2 px-2 border transition-all duration-300 ${
                          isSelected
                            ? 'bg-cyan-500/25 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.25)] scale-105'
                            : 'bg-white/5 border-white/10 opacity-55 scale-95'
                        } rounded-lg backdrop-blur-sm`}
                      >
                        <span className={`text-[9px] tracking-wider ${isSelected ? 'text-cyan-300 font-semibold' : 'text-white/60 font-light'}`}>
                          {hourItem.time}
                        </span>
                        <div className="my-1 text-white/85">
                          <IconComp size={15} strokeWidth={1.5} />
                        </div>
                        <span className={`text-[11px] font-semibold ${isSelected ? 'text-white' : 'text-white/65'}`}>
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
                <MetricCard Icon={Droplets} label="Humidity" value={weatherData.humidity}  unit="%" />
                <MetricCard Icon={Wind}     label="Wind"     value={weatherData.windSpeed} unit="km/h" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
