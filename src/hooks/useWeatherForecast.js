import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const TOTAL_DAYS = 8;

/** Returns today + next N days as YYYY-MM-DD strings (local timezone). */
function buildDays(count) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

/**
 * useWeatherForecast — manages coordinates/city selections, active calendar index,
 * loaded weather data cache (per day), and prefetching of neighbor days.
 */
export default function useWeatherForecast(initialWeather) {
  const [coords, setCoords] = useState({
    lat:   initialWeather?.lat          ?? 41.0082,
    lon:   initialWeather?.lon          ?? 28.9784,
    title: initialWeather?.locationName ?? 'Istanbul',
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // Day strings - memoized so array identity is stable
  const days = useMemo(() => buildDays(TOTAL_DAYS), []);

  // Per-day weather cache - keyed by dateStr
  const [loadedData, setLoadedData] = useState(() => {
    if (!initialWeather) return {};
    return { [days[0]]: { loading: false, error: null, data: initialWeather } };
  });

  const activeFetches = useRef(new Set());

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

      const cooldowns = [1000, 2000, 4000];
      const maxAttempts = 4;
      let data = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.json();
          break;
        } catch (err) {
          if (attempt === maxAttempts) {
            throw err;
          }
          const delayMs = cooldowns[attempt - 1] || 1000;
          console.warn(`Fetch attempt ${attempt} failed for date ${dateStr}. Retrying in ${delayMs}ms...`, err);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      const isToday = dateStr === days[0];

      setLoadedData((prev) => {
        // Discard stale responses if user switched city mid-flight
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
      console.error(`Fetch failed for date ${dateStr} after 4 attempts:`, err);
      setLoadedData((prev) => ({
        ...prev,
        [dateStr]: { loading: false, error: 'Failed to load weather data', data: null },
      }));
    } finally {
      activeFetches.current.delete(fetchKey);
    }
  }, [days, coords.title]);

  // Prefetch active + neighbor days on index/coord change
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
      if (!loadedData[dateStr]) {
        fetchDataForDate(dateStr, coords.lat, coords.lon);
      }
    });
  }, [activeIndex, coords, days, fetchDataForDate, loadedData]);

  const selectCity = useCallback((newCity) => {
    setCoords({ lat: newCity.lat, lon: newCity.lon, title: newCity.name });
    setLoadedData({}); // clear cache
    setActiveIndex(0); // reset to Today
  }, []);

  return {
    coords,
    activeIndex,
    setActiveIndex,
    days,
    loadedData,
    selectCity,
  };
}
