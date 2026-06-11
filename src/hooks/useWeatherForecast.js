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

/** Formats the server's 8-day forecast array and indexes by date string. */
function formatForecastData(forecastArray, days, fallbackTitle, lat, lon) {
  const result = {};

  days.forEach((dateStr, idx) => {
    const dayData = forecastArray?.[idx] || {};

    result[dateStr] = {
      loading: false,
      error: null,
      data: {
        temp:         dayData.temp,
        humidity:     dayData.humidity,
        windSpeed:    dayData.windSpeed,
        uvIndex:      dayData.uvIndex,
        weatherCode:  dayData.weatherCode,
        hourly:       dayData.hourly || [],
        locationName: fallbackTitle,
        lat:          lat,
        lon:          lon,
      }
    };
  });

  return result;
}

/**
 * useWeatherForecast — manages coordinates/city selections, active calendar index,
 * loaded weather data cache (per day), and fetching the full 8-day forecast on city changes.
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
    return formatForecastData(initialWeather.forecast, days, initialWeather.locationName, initialWeather.lat, initialWeather.lon);
  });

  const lastFetchedCoordsRef = useRef({
    lat: initialWeather?.lat ?? 41.0082,
    lon: initialWeather?.lon ?? 28.9784,
  });

  const selectCity = useCallback((newCity) => {
    setCoords({ lat: newCity.lat, lon: newCity.lon, title: newCity.name });
    setActiveIndex(0); // reset to Today
  }, []);

  // Fetch complete 8-day forecast when city/coords change
  useEffect(() => {
    const lastCoords = lastFetchedCoordsRef.current;
    const isDifferent =
      Math.abs(lastCoords.lat - coords.lat) > 0.001 ||
      Math.abs(lastCoords.lon - coords.lon) > 0.001;

    if (isDifferent) {
      lastFetchedCoordsRef.current = { lat: coords.lat, lon: coords.lon };

      const fetchForecast = async () => {
        // Set all days to loading state
        setLoadedData((prev) => {
          const loadingState = {};
          days.forEach((d) => {
            loadingState[d] = { loading: true, error: null, data: null };
          });
          return loadingState;
        });

        try {
          const res = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);
          if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Failed to fetch weather');

          const parsed = formatForecastData(data.weather.forecast, days, coords.title, coords.lat, coords.lon);
          setLoadedData(parsed);
        } catch (err) {
          console.error('Failed to fetch new city forecast:', err);
          setLoadedData((prev) => {
            const errorState = {};
            days.forEach((d) => {
              errorState[d] = { loading: false, error: 'Failed to load weather data', data: null };
            });
            return errorState;
          });
        }
      };

      fetchForecast();
    }
  }, [coords, days]);

  return {
    coords,
    activeIndex,
    setActiveIndex,
    days,
    loadedData,
    selectCity,
  };
}
