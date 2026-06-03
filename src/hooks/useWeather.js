import { useState, useEffect } from 'react';

export default function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const CACHE_KEY = 'weather_dashboard_cache';
  const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

  const fetchWeather = async (lat, lon) => {
    try {
      setLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=uv_index_max&timezone=auto`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('API connection failed');
      
      const data = await response.json();

      const newWeatherData = {
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        uvIndex: data.daily.uv_index_max[0],
        weatherCode: data.current.weather_code,
        locationName: data.timezone.split('/')[1]?.replace('_', ' ') || data.timezone,
        timestamp: Date.now(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(newWeatherData));
      setWeather(newWeatherData);
    } catch (err) {
      setError('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      if (Date.now() - parsedCache.timestamp < CACHE_EXPIRY) {
        setWeather(parsedCache);
        setLoading(false);
        return;
      }
    }
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        setError('Location access denied');
        setLoading(false);
      }
    );
  }, []);

  return { weather, loading, error };
}