
// We pass in the Icon component, a label, the value, and the unit
export default function MetricCard({ Icon, label, value, unit }) {
  return (
    <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
      {/* Icon and Label row */}
      <div className="flex items-center gap-1.5 mb-1.5 text-slate-200">
        <Icon size={14} strokeWidth={1.5} className="shrink-0 text-cyan-400" />
        <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-light">{label}</span>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg sm:text-xl font-bold text-slate-50">{value}</span>
        <span className="text-[10px] text-slate-300">{unit}</span>
      </div>
    </div>
  );
}