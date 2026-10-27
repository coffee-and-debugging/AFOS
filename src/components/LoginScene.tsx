/**
 * Animated sign-in scene showing how AFOS works: a guest scans the table QR, the order flies to the
 * kitchen rail, the chef cooks, the waiter serves, and the guest's phone tracks every status.
 * Pure SVG + CSS (see "Login scene" in app.css); one 10s loop, still for reduced-motion users.
 */
const STEPS = [
  { x: 306, label: 'Received' },
  { x: 354, label: 'Cooking' },
  { x: 402, label: 'Ready' },
  { x: 450, label: 'Served' },
];

const STATUS = ['Scanning table QR…', 'Order received', 'Cooking your food', 'Ready · on the way', 'Served · enjoy!'];

export default function LoginScene() {
  return (
    <svg className="scene" viewBox="0 -24 480 324" role="img" aria-label="A guest scans a table QR code, the chef cooks the order and a waiter serves it">
      <defs>
        <filter id="scene-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
        <linearGradient id="scene-floor-line" x1="0" x2="1">
          <stop offset="0" stopColor="#fbd5b5" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fbd5b5" />
          <stop offset="0.85" stopColor="#fbd5b5" />
          <stop offset="1" stopColor="#fbd5b5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft, asymmetric backdrop that fades into the page instead of a card */}
      <path d="M44 92C76 26 196 6 270 30C338 52 404 20 452 64C488 98 476 172 468 232C460 290 382 306 262 302C150 298 46 310 20 258C0 214 16 136 44 92Z" fill="#ffedd5" filter="url(#scene-soft)" />
      <ellipse cx="96" cy="70" rx="70" ry="44" fill="#fecaca" opacity="0.6" filter="url(#scene-soft)" />
      <ellipse cx="300" cy="280" rx="210" ry="22" fill="#fed7aa" opacity="0.8" filter="url(#scene-soft)" />
      <path d="M14 258H470" stroke="url(#scene-floor-line)" strokeWidth="2" />

      {/* Hanging lamp */}
      <g className="scene-lamp">
        <path d="M206 -24v52" stroke="#d1d5db" strokeWidth="2" />
        <circle cx="206" cy="52" r="26" fill="#fde68a" opacity="0.35" />
        <path d="M192 44l6-16h16l6 16z" fill="#dc2626" />
        <circle cx="206" cy="46" r="4" fill="#fef3c7" />
      </g>

      {/* Kitchen ticket rail: the new order lands here */}
      <path d="M14 70h118" stroke="#9ca3af" strokeWidth="2" />
      <g className="scene-ticket"><rect x="24" y="70" width="20" height="26" rx="2" fill="#fff" stroke="#e5e7eb" /><path d="M28 78h12M28 83h9M28 88h11" stroke="#d1d5db" strokeWidth="2" /></g>
      <g className="scene-ticket scene-ticket-2"><rect x="56" y="70" width="20" height="26" rx="2" fill="#fff" stroke="#e5e7eb" /><path d="M60 78h12M60 83h8M60 88h11" stroke="#d1d5db" strokeWidth="2" /></g>
      <g className="scene-ticket-new"><rect x="88" y="70" width="20" height="26" rx="2" fill="#fff" stroke="#dc2626" strokeWidth="1.5" /><path d="M92 78h12M92 83h10M92 88h7" stroke="#fca5a5" strokeWidth="2" /></g>
      <g className="scene-ding">
        <path d="M128 56a7 7 0 0 1 14 0v5h-14z" fill="#facc15" />
        <circle cx="135" cy="63" r="2" fill="#facc15" />
        <path d="M124 48l-4-4M146 48l4-4M135 44v-6" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Chef */}
      <g>
        <rect x="34" y="140" width="48" height="58" rx="14" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
        <circle cx="52" cy="160" r="2" fill="#d1d5db" /><circle cx="52" cy="172" r="2" fill="#d1d5db" />
        <circle cx="58" cy="122" r="15" fill="#f4c7a1" />
        <circle cx="53" cy="120" r="1.8" fill="#1f2937" /><circle cx="63" cy="120" r="1.8" fill="#1f2937" />
        <path d="M53 127q5 4 10 0" stroke="#1f2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M52 131q6 3 12 0" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="45" y="100" width="26" height="12" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
        <circle cx="49" cy="98" r="8" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
        <circle cx="67" cy="98" r="8" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
        <circle cx="58" cy="93" r="9" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
        <path d="M76 154q14 8 24 20" stroke="#fff" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M76 154q14 8 24 20" stroke="#e5e7eb" strokeWidth="1.5" fill="none" />
      </g>

      {/* Counter and stove; flames burn while the order is cooking */}
      <rect x="4" y="190" width="140" height="10" rx="4" fill="#9ca3af" />
      <rect x="8" y="198" width="132" height="60" rx="6" fill="#374151" />
      <rect x="20" y="210" width="50" height="34" rx="4" fill="#4b5563" />
      <circle cx="96" cy="227" r="5" fill="#9ca3af" /><circle cx="116" cy="227" r="5" fill="#9ca3af" />
      <g className="scene-cooking">
        <path className="scene-flame" d="M118 190q3-10 6-2q3-9 6 0q3-8 6 2z" fill="#f97316" />
        <path className="scene-flame scene-flame-2" d="M121 190q3-7 5-1q3-6 5 1z" fill="#fde047" />
      </g>
      <g className="scene-pan">
        <circle cx="101" cy="175" r="5" fill="#f4c7a1" />
        <path d="M104 177l12 5" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="129" cy="184" rx="16" ry="5" fill="#1f2937" />
      </g>
      <g className="scene-food">
        <circle cx="124" cy="177" r="3" fill="#f97316" />
        <circle cx="131" cy="174" r="3" fill="#22c55e" />
        <circle cx="137" cy="178" r="2.6" fill="#facc15" />
      </g>

      {/* Table with the QR stand and the served dish */}
      <rect x="330" y="206" width="98" height="8" rx="3" fill="#b45309" />
      <rect x="340" y="214" width="6" height="44" rx="2" fill="#92400e" />
      <rect x="412" y="214" width="6" height="44" rx="2" fill="#92400e" />
      <path d="M340 206l8-22h4l8 22z" fill="#fff" stroke="#d1d5db" />
      <g fill="#1f2937">
        <rect x="346" y="192" width="3" height="3" /><rect x="351" y="192" width="3" height="3" />
        <rect x="346" y="197" width="3" height="3" /><rect x="350" y="198" width="2" height="2" /><rect x="352" y="196" width="2" height="2" />
      </g>
      <g className="scene-table-plate">
        <ellipse cx="380" cy="204" rx="15" ry="3.5" fill="#fff" stroke="#e5e7eb" />
        <path d="M370 203q10-13 20 0z" fill="#f97316" />
        <circle cx="377" cy="197" r="2" fill="#22c55e" /><circle cx="383" cy="198" r="1.6" fill="#facc15" />
        <path className="scene-steam" d="M376 190q-3-5 0-9t0-9" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path className="scene-steam scene-steam-2" d="M384 190q-3-5 0-9t0-9" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* Guest with a phone: scans the QR, then follows the order */}
      <path className="scene-beam" d="M409 170L352 188V202L409 177Z" fill="#dc2626" />
      <g>
        <ellipse cx="446" cy="259" rx="24" ry="3" fill="#000" opacity="0.06" />
        <rect x="464" y="148" width="6" height="58" rx="3" fill="#92400e" />
        <rect x="430" y="200" width="40" height="6" rx="3" fill="#b45309" />
        <rect x="434" y="206" width="5" height="52" rx="2" fill="#92400e" />
        <rect x="462" y="206" width="5" height="52" rx="2" fill="#92400e" />
        <rect x="416" y="198" width="26" height="9" rx="4.5" fill="#1f2937" />
        <rect x="416" y="200" width="9" height="56" rx="4.5" fill="#1f2937" />
        <ellipse cx="418" cy="257" rx="8" ry="3.5" fill="#111827" />
        <g className="scene-guest">
          <rect x="432" y="160" width="28" height="44" rx="11" fill="#f97316" />
          <circle cx="446" cy="146" r="13" fill="#f4c7a1" />
          <path d="M433 143q2-14 15-13q11 1 11 12q-5-6-14-5q-7 1-12 6z" fill="#3b2a20" />
          <circle cx="440" cy="147" r="1.8" fill="#1f2937" />
          <path d="M437 153q3 2 6 0" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M436 170q-10 4-18 6" stroke="#f97316" strokeWidth="7" strokeLinecap="round" fill="none" />
          <rect x="406" y="162" width="11" height="18" rx="2.5" fill="#1f2937" />
          <rect className="scene-phone-screen" x="407.5" y="164" width="8" height="13" rx="1" fill="#fecaca" />
          <circle cx="418" cy="176" r="3.5" fill="#f4c7a1" />
        </g>
        <path className="scene-heart" d="M446 108c-4-6-13-3-11 4c1 4 11 10 11 10s10-6 11-10c2-7-7-10-11-4z" fill="#dc2626" />
      </g>

      {/* The order ticket flying from the guest's phone to the kitchen */}
      <g className="scene-fly">
        <rect x="-9" y="-12" width="18" height="24" rx="2" fill="#fff" stroke="#dc2626" strokeWidth="1.5" />
        <path d="M-5 -5h10M-5 0h8M-5 5h9" stroke="#fca5a5" strokeWidth="2" />
      </g>

      {/* Guest's phone: live order status, as on the real guest page */}
      <path d="M412 160V74" stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="3 4" />
      <g>
        <rect x="286" y="-16" width="188" height="88" rx="14" fill="#000" opacity="0.08" filter="url(#scene-soft)" />
        <rect x="286" y="-18" width="188" height="88" rx="14" fill="#fff" stroke="#f3e8df" />
        <text x="300" y="0" className="scene-text scene-text-sub">Table 4 · Order #042</text>
        {STATUS.map((s, i) => (
          <text key={s} x="300" y="20" className={`scene-text scene-text-status scene-status-${i}`}>{s}</text>
        ))}
        <path d={`M${STEPS[0].x} 40H${STEPS[3].x}`} stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
        <path className="scene-progress" d={`M${STEPS[0].x} 40H${STEPS[3].x}`} stroke="#dc2626" strokeWidth="3" strokeLinecap="round" pathLength="1" />
        {STEPS.map((s, i) => (
          <g key={s.label}>
            <circle cx={s.x} cy="40" r="5" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
            <circle className={`scene-step scene-step-${i}`} cx={s.x} cy="40" r="5" fill="#dc2626" />
            <text x={s.x} y="58" textAnchor="middle" className={`scene-text scene-text-step scene-label-${i}`}>{s.label}</text>
          </g>
        ))}
      </g>

      {/* Waiter: waits at the kitchen, carries the dish to the table, walks back */}
      <ellipse className="scene-waiter scene-waiter-shadow" cx="0" cy="259" rx="20" ry="3" fill="#000" opacity="0.07" />
      <g className="scene-waiter">
        <g className="scene-leg scene-leg-a"><rect x="-10" y="210" width="9" height="46" rx="4.5" fill="#1f2937" /><ellipse cx="-4" cy="256" rx="7" ry="3.5" fill="#111827" /></g>
        <g className="scene-leg scene-leg-b"><rect x="1" y="210" width="9" height="46" rx="4.5" fill="#374151" /><ellipse cx="7" cy="256" rx="7" ry="3.5" fill="#111827" /></g>
        <path d="M-10 176q-6 14-4 30" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
        <rect x="-15" y="164" width="30" height="52" rx="10" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
        <path d="M-15 178q0-6 6-8l9 12l9-12q6 2 6 8v28q0 10-10 10h-10q-10 0-10-10z" fill="#dc2626" />
        <path d="M-5 166l5 3l5-3v6l-5-3l-5 3z" fill="#1f2937" />
        <circle cx="0" cy="150" r="13" fill="#f4c7a1" />
        <path d="M-13 148q0-14 14-14q12 0 12 11q-6-5-14-4q-7 1-12 7z" fill="#1f2937" />
        <circle cx="6" cy="150" r="1.8" fill="#1f2937" />
        <path d="M3 156q3 2 6 0" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M10 174q12-6 18-22" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="29" cy="150" r="4" fill="#f4c7a1" />
        <ellipse cx="30" cy="146" rx="22" ry="3.5" fill="#9ca3af" />
        <g className="scene-tray-plate">
          <path d="M18 143a12 12 0 0 1 24 0z" fill="#e5e7eb" stroke="#d1d5db" />
          <circle cx="30" cy="130" r="2.5" fill="#d1d5db" />
          <path className="scene-steam" d="M25 125q-3-5 0-9t0-9" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path className="scene-steam scene-steam-2" d="M34 124q-3-5 0-9t0-9" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
