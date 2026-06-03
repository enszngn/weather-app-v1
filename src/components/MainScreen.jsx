import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import { Droplets, Wind } from 'lucide-react';

export default function MainScreen({ weather, insights, themeGradient }) {
  return (
    <div className={`min-h-screen w-screen transition-colors duration-1000 bg-gradient-to-br ${themeGradient} flex items-center justify-center p-6`}>
      <div className="w-full max-w-2xl space-y-12">
        <header className="text-center space-y-4">
          <p className="text-sm uppercase tracking-[0.5em] opacity-60">{weather.locationName}</p>
          <h1 className="text-[12rem] leading-none font-bold tracking-tighter italic">{Math.round(weather.temp)}°</h1>
        </header>

        <div className="space-y-4">
          {insights.map((text, i) => <InsightCard key={i} text={text} />)}
        </div>

        <div className="grid grid-cols-2 gap-4 opacity-80">
          <MetricCard Icon={Droplets} label="Humidity" value={weather.humidity} unit="%" />
          <MetricCard Icon={Wind} label="Wind" value={weather.windSpeed} unit="km/h" />
        </div>
      </div>
    </div>
  );
}
