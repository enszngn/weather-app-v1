import React from 'react';
import useWeather from './hooks/useWeather';
import { generateInsights, getSystemTheme } from './utils/weatherLogic';
import MainScreen from './components/MainScreen';

export default function App() {
  const { weather, loading, error } = useWeather();

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!weather) return null;

  const insights = generateInsights(weather);
  const themeGradient = getSystemTheme(weather.weatherCode);

  return (
    <MainScreen 
      weather={weather} 
      insights={insights} 
      themeGradient={themeGradient} 
    />
  );
}

// Small sub-components for states
const LoadingScreen = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
    <div className="text-white tracking-[0.4em] font-light animate-pulse text-xl">SYNCING...</div>
  </div>
);

const ErrorScreen = ({ message }) => (
  <div className="h-screen w-screen flex items-center justify-center bg-slate-950 p-10 text-center">
    <div className="max-w-sm text-slate-500 text-sm leading-relaxed uppercase tracking-widest">{message}</div>
  </div>
);