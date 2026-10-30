/**
 * The one "3D" moment: a grocery basket drawn in SVG with CSS 3D transforms (slow swing + floating produce).
 * No WebGL, so it stays smooth on low-end Android phones. Animations switch off for prefers-reduced-motion
 * (see globals.css).
 */
export function BasketHero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto aspect-square w-64 ${className}`} style={{ perspective: '900px' }} aria-hidden>
      <div className="absolute inset-x-6 bottom-2 h-6 rounded-full bg-brand-900/20 blur-xl" />
      <div className="nk-motion absolute inset-0 animate-swing" style={{ transformStyle: 'preserve-3d' }}>
        <svg viewBox="0 0 240 240" className="h-full w-full drop-shadow-xl">
          <defs>
            <linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7b36a" /><stop offset="1" stopColor="#b9792f" /></linearGradient>
            <linearGradient id="bk2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d49a4a" /><stop offset=".5" stopColor="#f0c98a" /><stop offset="1" stopColor="#c78937" /></linearGradient>
            <linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#46b98c" /><stop offset="1" stopColor="#0b6347" /></linearGradient>
          </defs>
          {/* handle */}
          <path d="M62 118 C62 40 178 40 178 118" fill="none" stroke="#a96a22" strokeWidth="10" strokeLinecap="round" />
          {/* produce behind rim */}
          <g className="nk-motion animate-floaty" style={{ ['--r' as string]: '-6deg' }}>
            <rect x="92" y="52" width="34" height="68" rx="9" fill="#fff" stroke="#cfe9dd" strokeWidth="3" />
            <rect x="92" y="52" width="34" height="20" rx="9" fill="#0f7d58" /><rect x="100" y="86" width="18" height="18" rx="4" fill="#d6f3e6" />
          </g>
          <g className="nk-motion animate-floaty" style={{ ['--r' as string]: '8deg', animationDelay: '-1.6s' }}>
            <path d="M138 70 c-4-18 10-30 26-28 -2 18 -10 28 -26 28z" fill="url(#lf)" /><path d="M150 62 q-10 22 -22 54 M156 70 q-4 18 -12 46" stroke="#f08a2c" strokeWidth="14" strokeLinecap="round" fill="none" />
            <circle cx="164" cy="104" r="19" fill="#e0483f" /><path d="M164 86 q4-10 12-10" stroke="#0b6347" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
          <g className="nk-motion animate-floaty" style={{ ['--r' as string]: '-12deg', animationDelay: '-3s' }}>
            <ellipse cx="78" cy="96" rx="22" ry="17" fill="#f6d36a" /><path d="M60 92 q18-14 36 0" stroke="#e8a317" strokeWidth="3" fill="none" />
          </g>
          {/* basket body */}
          <path d="M34 112 H206 L190 206 Q188 218 176 218 H64 Q52 218 50 206 Z" fill="url(#bk)" />
          <path d="M34 112 H206 L202 134 H38 Z" fill="url(#bk2)" />
          <g stroke="#9b5f1c" strokeWidth="3" opacity=".55" fill="none" strokeLinecap="round">
            <path d="M46 150 H194 M50 178 H190 M56 204 H184" />
            <path d="M80 134 L72 216 M112 134 L110 218 M144 134 L146 218 M176 134 L184 216" />
          </g>
          <path d="M34 112 H206" stroke="#8a5216" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
