export function ArchitectureDiagram() {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">
        Gateway - Registry - Worker
      </p>
      <svg viewBox="0 0 760 170" className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4fd9ff" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>

        <line x1="145" y1="85" x2="380" y2="85" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="390" y1="85" x2="625" y2="85" stroke="url(#flow)" strokeWidth="2.5" />

        <circle cx="110" cy="85" r="34" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />
        <circle cx="385" cy="85" r="34" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />
        <circle cx="660" cy="85" r="34" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />

        <text x="110" y="91" textAnchor="middle" fill="#dbe9ff" fontSize="13">Gateway</text>
        <text x="385" y="91" textAnchor="middle" fill="#dbe9ff" fontSize="13">Registry</text>
        <text x="660" y="91" textAnchor="middle" fill="#dbe9ff" fontSize="13">Worker</text>

        <circle cx="155" cy="85" r="5" fill="#b0fbff" className="orb-dot-a" />
        <circle cx="395" cy="85" r="5" fill="#99f6e4" className="orb-dot-b" />
      </svg>
    </div>
  );
}
