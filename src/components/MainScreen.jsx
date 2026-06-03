import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import { Droplets, Wind } from 'lucide-react';

export default function MainScreen({ weather, insights, themeGradient }) {
  return (
    <div className={`h-[100svh] w-full overflow-hidden transition-colors duration-1000 bg-gradient-to-br ${themeGradient} flex items-center justify-center p-[clamp(1rem,4svh,2.5rem)]`}>
      <div className="w-full max-w-2xl h-full flex flex-col justify-between py-[clamp(0.5rem,3svh,1.5rem)]">
        <header className="text-center space-y-[clamp(0.25rem,1svh,0.75rem)]">
          <p className="text-[clamp(0.7rem,1.8svh,0.9rem)] uppercase tracking-[0.5em] opacity-60">{weather.locationName}</p>
          <h1 className="text-[clamp(4rem,18svh,10rem)] leading-none font-bold tracking-tighter italic">{Math.round(weather.temp)}°</h1>
        </header>

        <div className="space-y-[clamp(0.5rem,1.5svh,1rem)] overflow-y-auto max-h-[35svh] custom-scrollbar pr-1 my-auto">
          {insights.map((text, i) => <InsightCard key={i} text={text} />)}
        </div>

        <div className="grid grid-cols-2 gap-[clamp(0.5rem,1.5svh,1rem)] opacity-80 mt-auto">
          <MetricCard Icon={Droplets} label="Humidity" value={weather.humidity} unit="%" />
          <MetricCard Icon={Wind} label="Wind" value={weather.windSpeed} unit="km/h" />
        </div>
      </div>
    </div>
  );
}
