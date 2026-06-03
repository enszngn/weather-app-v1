import InsightCard from './InsightCard';
import MetricCard from './MetricCard';
import { Droplets, Wind } from 'lucide-react';

export default function MainScreen({ weather, insights, themeGradient }) {
  // Algebraic darkness calculation:
  // Noon (12:00 PM / 720 mins) is the lightest (20% or 0.2 opacity).
  // Midnight (12:00 AM / 0 mins) is the darkest (80% or 0.8 opacity).
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const diffFromNoon = Math.abs(minutes - 720);
  const ratio = diffFromNoon / 720; // Ranges from 0.0 at noon to 1.0 at midnight
  const darkness = 0.2 + ratio * 0.6; // Maps ratio to 0.2 - 0.8 range

  return (
    <div className={`relative h-[100svh] w-full overflow-hidden transition-colors duration-1000 bg-gradient-to-br ${themeGradient} flex items-center justify-center p-[clamp(1rem,4svh,2.5rem)]`}>
      {/* Time-based continuous algebraic overlay */}
      <div
        className="absolute inset-0 bg-black/10 pointer-events-none z-0"
        style={{ backgroundColor: `rgba(0, 0, 0, ${darkness})` }}
      />

      <div className="relative z-10 w-full max-w-2xl h-full flex flex-col justify-between py-[clamp(0.5rem,3svh,1.5rem)]">
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
