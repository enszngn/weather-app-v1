export default function InsightCard({ text }) {
  return (
    <div className="bg-white/10 shadow-lg backdrop-blur-2xl p-8 rounded-[2rem] border border-white/20 transition-all hover:bg-white/15">
      <p className="text-2xl md:text-3xl text-white font-medium leading-tight tracking-tight">
        {text}
      </p>
    </div>
  );
}