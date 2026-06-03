import React from 'react';
import useWeather from './hooks/useWeather';
import { generateInsights } from './utils/weatherLogic';
import metricCard from './components/metricCard';
// Importing specific icons from Lucide
import { Wind, Droplets, Sun, Gauge, AlertCircle } from 'lucide-react';

export default function App() {
  const { weather, loading, error } = useWeather();
  const insights = generateInsights(weather);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <p className="animate-pulse tracking-widest">INITIALIZING DASHBOARD...</p>
      </div>
    );
  }

  // 2. Error/Permission State
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <AlertCircle size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Location Required</h2>
        <p className="text-slate-400 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="text-center space-y-2">
          <h1 className="text-slate-400 text-sm uppercase tracking-[0.3em] font-light">
            Current Conditions
          </h1>
          <p className="text-4xl font-bold text-white tracking-tight">
            {weather.locationName}
          </p>
          <div className="text-6xl font-extralight text-white pt-4">
            {Math.round(weather.temp)}°
          </div>
        </header>

        {/* Insights Banner */}
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index} 
              className={`p-4 rounded-xl border transition-all duration-500 animate-in fade-in slide-in-from-top-2 ${insight.style}`}
            >
              <p className="text-sm leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <metricCard Icon={Droplets} label="Humidity" value={weather.humidity} unit="%" />
          <metricCard Icon={Wind} label="Wind Speed" value={weather.windSpeed} unit="km/h" />
          <metricCard Icon={Sun} label="UV Index" value={weather.uvIndex} unit="of 11" />
          <metricCard Icon={Gauge} label="Pressure" value="1012" unit="hPa" />
        </div>

      </div>
    </div>
  );
}