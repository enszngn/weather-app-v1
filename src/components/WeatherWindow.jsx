import { useMemo, useEffect } from 'react';
import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import {
  Droplets,
  Wind,
} from 'lucide-react';
import {
  generateInsights,
  getSystemTheme,
  getWeatherIcon,
  getHeaderDateLabel,
} from '../utils/weatherLogic';
import usePointerSlider from '../hooks/usePointerSlider';

// ── Module-level constants & pure helpers ─────────────────────────────────────

// Card width (62px) + gap (8px) = 70px per slot.
const CARD_SLOT_W = 70;

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
 *  onSliderInteract  {function} - Callback when the slider drag starts/ends
 *  onHourChange  {function} - Callback when active card's hour changes
 */
export default function WeatherWindow({
  title,
  dateStr,
  active        = true,
  visible       = true,
  weatherData   = null,
  loadingData   = false,
  errorData     = null,
  onSliderInteract,
  onHourChange,
}) {

  // ── Derived values ────────────────────────────────────────────────────────────
  const themeGradient = weatherData
    ? getSystemTheme(weatherData.weatherCode)
    : 'from-slate-800 to-slate-950';

  const displayName = title || weatherData?.locationName || '';

  // ── Hourly data ───────────────────────────────────────────────────────────────
  const sortedHourly = useMemo(() => {
    if (!weatherData?.hourly) return [];

    const times     = weatherData.hourly.time                 || [];
    const temps     = weatherData.hourly.temperature_2m       || [];
    const codes     = weatherData.hourly.weather_code         || [];
    const humidity  = weatherData.hourly.relative_humidity_2m || [];
    const windSpeed = weatherData.hourly.wind_speed_10m       || [];

    // Collect all 24 hours that belong to this card's date (always 00:00 → 23:00).
    const dayHours = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i].startsWith(dateStr)) {
        dayHours.push({
          time:        times[i].split('T')[1], // "HH:MM"
          temp:        temps[i],
          weatherCode: codes[i],
          humidity:    humidity[i],
          windSpeed:   windSpeed[i],
        });
      }
    }

    return dayHours;
  }, [weatherData, dateStr]);

  // ── Transform-based hourly slider custom hook ──────────────────────────────
  const {
    selectedHourIndex,
    sliderContainerRef,
    sliderTrackRef,
    darkness,
    pointerHandlers,
  } = usePointerSlider({
    sortedHourlyLength: sortedHourly.length,
    active,
    dateStr,
    onSliderInteract,
    cardSlotWidth: CARD_SLOT_W,
  });

  // Notify parent (CylinderTimeline) whenever the active card's hour changes,
  // so the page-level background overlay can sync without a full React re-render.
  useEffect(() => {
    if (active) onHourChange?.(selectedHourIndex);
  }, [active, selectedHourIndex, onHourChange]);

  // The data for whichever hour-card is currently snapped to center.
  const selectedHourData = sortedHourly[selectedHourIndex] ?? null;

  // Insights: always reflect the selected hour's conditions.
  const insights = useMemo(() => {
    if (!weatherData) return [];
    return generateInsights(
      selectedHourData
        ? {
            ...weatherData,
            temp:        selectedHourData.temp,
            weatherCode: selectedHourData.weatherCode,
            humidity:    selectedHourData.humidity    ?? weatherData.humidity,
            windSpeed:   selectedHourData.windSpeed   ?? weatherData.windSpeed,
          }
        : weatherData
    );
  }, [weatherData, selectedHourData]);

  // ── Derived display values (reflect selected hour) ────────────────────────────
  const displayTemp = selectedHourData
    ? Math.round(selectedHourData.temp)
    : weatherData ? Math.round(weatherData.temp) : '--';

  const displayHumidity = selectedHourData?.humidity  ?? weatherData?.humidity;
  const displayWind     = selectedHourData?.windSpeed ?? weatherData?.windSpeed;

  const displayCode  = selectedHourData?.weatherCode ?? weatherData?.weatherCode ?? 0;
  const WeatherIcon  = getWeatherIcon(displayCode);

  // ── Card visibility class ─────────────────────────────────────────────────────
  const cardClass = active
    ? 'scale-100 opacity-100 filter-none pointer-events-auto'
    : visible
      ? 'scale-90 opacity-40 pointer-events-none'
      : 'scale-75 opacity-0 pointer-events-none';

  return (
    <div
      className={`relative h-[80vh] w-full max-w-[var(--card-width)] mx-auto overflow-hidden bg-gradient-to-br ${themeGradient} shadow-2xl transition-all duration-700 ease-out rounded-2xl ${cardClass}`}
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

            {/* ─ Hourly Forecast Slider ─ */}
            {sortedHourly.length > 0 && (
              <div className="absolute top-[56%] inset-x-0">
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/45 mb-2 select-none font-light px-4">
                  Hourly · 24h
                </p>

                {/*
                  Clip container: overflow:hidden hides off-screen cards.
                  The inner track is translated with CSS transform via pointerHandlers.
                */}
                <div
                  className="overflow-hidden py-2 cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'none', userSelect: 'none' }}
                  ref={sliderContainerRef}
                  {...pointerHandlers}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div
                    ref={sliderTrackRef}
                    className="flex"
                    style={{ gap: '8px', willChange: 'transform' }}
                  >
                    {sortedHourly.map((hourItem, i) => {
                      const IconComp   = getWeatherIcon(hourItem.weatherCode);
                      const isSelected = i === selectedHourIndex;
                      return (
                        <div
                          key={hourItem.time}
                          style={{ flexShrink: 0, width: '62px' }}
                          className={`flex flex-col items-center justify-between py-2 px-2 transition-all duration-200 ${
                            isSelected
                              ? 'bg-white/20 opacity-100 scale-105 shadow-[0_4px_12px_rgba(255,255,255,0.08)]'
                              : 'bg-white/5 opacity-40 scale-95'
                          } rounded-lg`}
                        >
                          <span className={`text-[9px] tracking-wider ${
                            isSelected ? 'text-white font-bold' : 'text-white/60 font-light'
                          }`}>
                            {hourItem.time}
                          </span>
                          <div className={`my-1 transition-opacity duration-200 ${isSelected ? 'text-white opacity-100' : 'text-white/50'}`}>
                            <IconComp size={15} strokeWidth={isSelected ? 2 : 1.5} />
                          </div>
                          <span className={`text-[11px] font-semibold transition-all duration-200 ${
                            isSelected ? 'text-white font-bold text-xs scale-105' : 'text-white/65'
                          }`}>
                            {Math.round(hourItem.temp)}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─ Metric Cards — at 80% vertical ─ */}
            <div className="absolute top-[80%] inset-x-4">
              <div className="grid grid-cols-2 gap-2 opacity-90">
                <MetricCard Icon={Droplets} label="Humidity" value={displayHumidity} unit="%" />
                <MetricCard Icon={Wind}     label="Wind"     value={displayWind != null ? Math.round(displayWind) : undefined} unit="km/h" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
