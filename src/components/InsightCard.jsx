export default function InsightCard({ text }) {
  return (
    <div className="bg-white/10 shadow-md backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-white/20 transition-all duration-300 hover:bg-white/15 hover:border-white/30">
      <p className="text-[11px] sm:text-xs text-white font-medium leading-normal tracking-wide antialiased">
        {text}
      </p>
    </div>
  );
}