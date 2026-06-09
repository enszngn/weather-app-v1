import React, { useState, useEffect, useRef } from 'react';
import WeatherWindow from './WeatherWindow';
import CitySearch from './CitySearch';
import { getSystemTheme } from '../utils/weatherLogic';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CylinderTimeline({ initialWeather }) {
  // ── Coordinates and City Title state ──────────────────────────────────────────
  const [coords, setCoords] = useState({
    lat: initialWeather?.lat ?? 41.0082,
    lon: initialWeather?.lon ?? 28.9784,
    title: initialWeather?.locationName ?? 'Istanbul',
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // Generate date strings for Today + 7 days (8 days total)
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // ── Prefetch & Lazy Load state management ─────────────────────────────────────
  // Keyed by dateStr: { loading, error, data }
  const [loadedData, setLoadedData] = useState(() => {
    const initialData = {};
    if (initialWeather) {
      const todayStr = days[0];
      initialData[todayStr] = {
        loading: false,
        error: null,
        data: initialWeather,
      };
    }
    return initialData;
  });

  const activeFetches = useRef(new Set());

  // Function to fetch weather for a specific day
  const fetchDataForDate = async (dateStr, lat, lon) => {
    const fetchKey = `${dateStr}-${lat}-${lon}`;
    if (activeFetches.current.has(fetchKey)) return;
    activeFetches.current.add(fetchKey);

    setLoadedData((prev) => ({
      ...prev,
      [dateStr]: { loading: true, error: null, data: null },
    }));

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=uv_index_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const now = new Date();
      const currentHour = now.getHours();
      const isToday = dateStr === days[0];

      setLoadedData((prev) => {
        // Discard if coordinates have changed since the fetch started
        if (coords.lat !== lat || coords.lon !== lon) return prev;

        return {
          ...prev,
          [dateStr]: {
            loading: false,
            error: null,
            data: {
              temp: isToday && data.current ? data.current.temperature_2m : data.hourly.temperature_2m[currentHour],
              humidity: isToday && data.current ? data.current.relative_humidity_2m : (data.hourly.relative_humidity_2m?.[currentHour] ?? 50),
              windSpeed: isToday && data.current ? data.current.wind_speed_10m : (data.hourly.wind_speed_10m?.[currentHour] ?? 10),
              uvIndex: data.daily.uv_index_max[0],
              weatherCode: isToday && data.current ? data.current.weather_code : data.hourly.weather_code[currentHour],
              hourly: data.hourly,
              locationName: coords.title || data.timezone.split('/').pop().replace(/_/g, ' '),
              lat,
              lon,
            },
          },
        };
      });
    } catch (err) {
      console.error(`Fetch failed for date ${dateStr}:`, err);
      setLoadedData((prev) => {
        if (coords.lat !== lat || coords.lon !== lon) return prev;
        return {
          ...prev,
          [dateStr]: {
            loading: false,
            error: 'Failed to load weather data',
            data: null,
          },
        };
      });
    } finally {
      activeFetches.current.delete(fetchKey);
    }
  };

  // Prefetch active index, immediate neighbors, and +2/-2 buffer cards on index/coordinates change
  useEffect(() => {
    const neighbors = [
      activeIndex,
      (activeIndex - 1 + 8) % 8,
      (activeIndex + 1) % 8,
      (activeIndex - 2 + 8) % 8,
      (activeIndex + 2) % 8,
    ];

    neighbors.forEach((idx) => {
      const dateStr = days[idx];
      // Fetch if not already loaded or loading
      if (!loadedData[dateStr] || loadedData[dateStr].error) {
        fetchDataForDate(dateStr, coords.lat, coords.lon);
      }
    });
  }, [activeIndex, coords]);

  // ── Drag / Swipe handler state ────────────────────────────────────────────────
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const lastWheelTime = useRef(0);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - startX.current;
    
    // Convert swipe pixels to rotation degrees
    const rotationSensitivity = 0.15;
    setDragOffset(diffX * rotationSensitivity);
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const thresholdDegrees = 12;
    if (dragOffset > thresholdDegrees) {
      // Swiped right → show previous day
      setActiveIndex((prev) => (prev - 1 + 8) % 8);
    } else if (dragOffset < -thresholdDegrees) {
      // Swiped left → show next day
      setActiveIndex((prev) => (prev + 1) % 8);
    }

    setDragOffset(0);
  };

  // Desktop Mouse Dragging Handlers
  const handleMouseDown = (e) => {
    // Prevent dragging when clicking buttons, inputs, links, or lists
    if (e.target.closest('input, button, a, select, option, ul, li')) return;
    
    startX.current = e.clientX;
    isDragging.current = true;
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const currentX = e.clientX;
    const diffX = currentX - startX.current;
    
    const rotationSensitivity = 0.15;
    setDragOffset(diffX * rotationSensitivity);
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.userSelect = '';

    const thresholdDegrees = 12;
    if (dragOffset > thresholdDegrees) {
      setActiveIndex((prev) => (prev - 1 + 8) % 8);
    } else if (dragOffset < -thresholdDegrees) {
      setActiveIndex((prev) => (prev + 1) % 8);
    }

    setDragOffset(0);
  };

  const handleMouseLeave = () => {
    if (isDragging.current) {
      handleMouseUp();
    }
  };

  // Scroll Wheel Navigation (with overflow scroll protection)
  const handleWheel = (e) => {
    const now = Date.now();
    // Throttle scroll events (800ms spacing between transitions)
    if (now - lastWheelTime.current < 800) return;
    
    // Ignore wheel events inside scrollable hourly forecast or insights lists
    if (e.target.closest('.overflow-x-auto, .overflow-y-auto, .custom-scrollbar')) return;

    if (Math.abs(e.deltaY) > 20 || Math.abs(e.deltaX) > 20) {
      lastWheelTime.current = now;
      if (e.deltaY > 0 || e.deltaX > 0) {
        setActiveIndex((prev) => (prev + 1) % 8);
      } else {
        setActiveIndex((prev) => (prev - 1 + 8) % 8);
      }
    }
  };

  // ── City selection callback ──────────────────────────────────────────────────
  const handleSelectCity = (newCity) => {
    setCoords({
      lat: newCity.lat,
      lon: newCity.lon,
      title: newCity.name,
    });
    setLoadedData({}); // clear old city's cache
    setActiveIndex(0); // reset view to Today
  };

  // ── Dynamic page background theme ─────────────────────────────────────────────
  const activeDateStr = days[activeIndex];
  const activeWeather = loadedData[activeDateStr]?.data;
  const activeTheme = activeWeather
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

        {/* Horizontal Navigation indicators */}
        <div className="flex gap-2 justify-center max-w-full px-4 overflow-x-auto no-scrollbar">
          {days.map((dayStr, idx) => {
            const isActive = idx === activeIndex;
            const dateObj = new Date(dayStr + 'T00:00:00');
            const dayName = idx === 0 ? 'TODAY' : dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            
            return (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
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
        
        {/* Carousel Wheel */}
        <div
          className="preserve-3d w-full h-[80vh] flex items-center justify-center transition-transform duration-700 cubic-bezier(0.25, 1, 0.5, 1)"
          style={{
            transform: `translateZ(calc(var(--card-width) * -1.207)) rotateY(${(-activeIndex * 45) + dragOffset}deg)`,
          }}
        >
          {days.map((dayStr, idx) => {
            const isActive = idx === activeIndex;
            const isNeighbor = idx === (activeIndex - 1 + 8) % 8 || idx === (activeIndex + 1) % 8;
            const weatherItem = loadedData[dayStr];
            
            return (
              <div
                key={idx}
                className="absolute w-full max-w-[var(--card-width)] h-[80vh] preserve-3d"
                style={{
                  transform: `rotateY(${idx * 45}deg) translateZ(calc(var(--card-width) * 1.207))`,
                }}
              >
                <WeatherWindow
                  lat={coords.lat}
                  lon={coords.lon}
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

        {/* ─ Side Arrows (Desktop/Tapping Controls) ─ */}
        <button
          onClick={() => setActiveIndex((prev) => (prev - 1 + 8) % 8)}
          className="absolute left-4 p-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 rounded-full text-white backdrop-blur-md transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20 shrink-0"
          title="Previous Day"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={() => setActiveIndex((prev) => (prev + 1) % 8)}
          className="absolute right-4 p-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 rounded-full text-white backdrop-blur-md transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20 shrink-0"
          title="Next Day"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
