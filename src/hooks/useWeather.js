import { useState, useEffect } from 'react';

/**
 * useWeather — fetches weather data from our Cloudflare Worker endpoint.
 *
 * The Worker handles everything server-side:
 *  - Location detection via request.cf (no browser permission prompt)
 *  - Cloudflare Cache API (15-minute TTL per location)
 *  - Open-Meteo API call (only on cache miss)
 *  - D1 visit logging (always, via waitUntil)
 *
 * This hook simply calls GET /api/weather and exposes the result.
 */
export default function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);

        const response = await fetch('/api/weather');

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Unknown error from weather API');
        }

        setWeather(data.weather);
      } catch (err) {
        console.error('Failed to fetch weather:', err);
        setError('Failed to fetch weather data');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  return { weather, loading, error };
}