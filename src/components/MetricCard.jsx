
// We pass in the Icon component, a label, the value, and the unit
export default function MetricCard({ Icon, label, value, unit }) {
  return (
    <div className="flex flex-col p-4 rounded-md bg-white/5 border border-white/10 backdrop-blur-md">
      {/* Icon and Label row */}
      <div className="flex items-center gap-2 mb-2 text-slate-200">
        <Icon size={18} strokeWidth={1.5} />
        <span className="text-xs uppercase tracking-widest font-medium">{label}</span>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-slate-50">{value}</span>
        <span className="text-sm text-slate-200">{unit}</span>
      </div>
    </div>
  );
}