export function ArchitectureDiagram() {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">
        Public gateway - private registry - worker - SQL state
      </p>
      <svg viewBox="0 0 860 240" className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4fd9ff" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>

        <line x1="145" y1="104" x2="300" y2="104" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="390" y1="82" x2="560" y2="66" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="390" y1="126" x2="560" y2="142" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="606" y1="90" x2="606" y2="118" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="356" y1="148" x2="356" y2="184" stroke="url(#flow)" strokeWidth="2.5" />
        <line x1="606" y1="164" x2="424" y2="196" stroke="url(#flow)" strokeWidth="2.5" />

        <rect x="48" y="70" width="96" height="68" rx="18" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />
        <rect x="300" y="70" width="112" height="68" rx="18" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />
        <rect x="560" y="30" width="112" height="68" rx="18" fill="#101a31" stroke="#6cc6ff" strokeWidth="2" />
        <rect x="560" y="128" width="112" height="68" rx="18" fill="#101a31" stroke="#5eead4" strokeWidth="2" />
        <rect x="264" y="184" width="184" height="42" rx="16" fill="#101a31" stroke="#94a3b8" strokeWidth="1.8" />

        <text x="96" y="100" textAnchor="middle" fill="#dbe9ff" fontSize="13">Agent / client</text>
        <text x="96" y="119" textAnchor="middle" fill="#94a3b8" fontSize="11">Public edge</text>

        <text x="356" y="100" textAnchor="middle" fill="#dbe9ff" fontSize="13">Gateway</text>
        <text x="356" y="119" textAnchor="middle" fill="#94a3b8" fontSize="11">Invoke, replay, jobs</text>

        <text x="616" y="60" textAnchor="middle" fill="#dbe9ff" fontSize="13">Registry</text>
        <text x="616" y="79" textAnchor="middle" fill="#94a3b8" fontSize="11">Heartbeats + routing</text>

        <text x="616" y="158" textAnchor="middle" fill="#dbe9ff" fontSize="13">Worker</text>
        <text x="616" y="177" textAnchor="middle" fill="#94a3b8" fontSize="11">rag.search@v1</text>

        <text x="356" y="210" textAnchor="middle" fill="#dbe9ff" fontSize="13">SQL state via DATABASE_URL</text>

        <text x="208" y="94" textAnchor="middle" fill="#94a3b8" fontSize="11">invoke</text>
        <text x="478" y="58" textAnchor="middle" fill="#94a3b8" fontSize="11">lookup</text>
        <text x="482" y="152" textAnchor="middle" fill="#94a3b8" fontSize="11">dispatch</text>
        <text x="622" y="113" textAnchor="middle" fill="#94a3b8" fontSize="11">heartbeat</text>
        <text x="440" y="176" textAnchor="middle" fill="#94a3b8" fontSize="11">artifacts + capability state</text>

        <circle cx="196" cy="104" r="5" fill="#b0fbff" className="orb-dot-a" />
        <circle cx="470" cy="64" r="5" fill="#99f6e4" className="orb-dot-b" />
      </svg>
    </div>
  );
}
