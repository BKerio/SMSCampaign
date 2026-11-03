import { MousePointer2, SendHorizontal } from 'lucide-react';

/*
 * Looping 6s illustration for the login page: a cursor clicks a message
 * envelope, the flap opens, a letter rises and three "plane" arrows fly out
 * along curved paths, leaving dotted trails. Everything is on one timeline -
 * keyframe percentages live in index.css under "Login scene".
 *
 * Coordinates are px inside a fixed 360x340 stage; the envelope sits at
 * (100,196) and every flight starts at the top edge of the risen letter
 * (180,160). Each plane keeps a fixed heading (start -> end of its path):
 * `offset-rotate: auto` flipped the left-bound plane backwards in Chrome.
 */
const FLIGHTS = [
  { d: 'M180 160 C150 120 80 110 34 46', heading: -142 },
  { d: 'M180 160 C176 110 192 70 182 18', heading: -89 },
  { d: 'M180 160 C220 120 290 110 326 52', heading: -36 },
];

function LoginScene() {
  return (
    <div className="lp-stage" aria-hidden="true">
      {/* Dotted trails, each revealed by a mask stroke that "draws" along the flight path. */}
      <svg className="lp-trails" width="360" height="340" viewBox="0 0 360 340">
        <defs>
          {FLIGHTS.map(({ d }, i) => (
            <mask key={i} id={`lp-trail-mask-${i}`} maskUnits="userSpaceOnUse">
              <path
                d={d}
                pathLength={1}
                className="lp-trail-reveal"
                style={{ animationDelay: `${i * 0.22}s` }}
              />
            </mask>
          ))}
        </defs>
        {/* Broadcast rings around the envelope; the gold pings fire on the click. */}
        <circle cx="180" cy="251" r="104" className="lp-ring" />
        <circle cx="180" cy="251" r="150" className="lp-ring" />
        <circle cx="180" cy="251" r="100" className="lp-ping" />
        <circle cx="180" cy="251" r="100" className="lp-ping" style={{ animationDelay: '.35s' }} />
        {FLIGHTS.map(({ d }, i) => (
          <path
            key={i}
            d={d}
            className="lp-trail"
            mask={`url(#lp-trail-mask-${i})`}
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </svg>

      <span className="lp-env-shadow" />
      <svg className="lp-envelope" width="160" height="110" viewBox="0 0 160 110" overflow="visible">
        <rect width="160" height="110" rx="10" className="lp-env-back" />
        <polygon points="0,0 80,-58 160,0" className="lp-flap lp-flap-open" />
        <g className="lp-letter">
          <rect x="16" y="8" width="128" height="88" rx="6" />
          <line x1="32" y1="26" x2="98" y2="26" />
          <line x1="32" y1="40" x2="128" y2="40" />
          <line x1="32" y1="54" x2="116" y2="54" />
        </g>
        <path d="M0 26 L80 74 L160 26 V100 a10 10 0 0 1 -10 10 H10 a10 10 0 0 1 -10 -10 Z" className="lp-env-front" />
        <polygon points="0,0 80,62 160,0" className="lp-flap lp-flap-closed" />
        <g className="lp-badge">
          <circle cx="156" cy="2" r="13" />
          <text x="156" y="7" textAnchor="middle">1</text>
        </g>
      </svg>

      {FLIGHTS.map(({ d, heading }, i) => (
        <span
          key={i}
          className="lp-plane"
          style={{ offsetPath: `path('${d}')`, offsetRotate: `${heading}deg`, animationDelay: `${i * 0.22}s` }}
        >
          <SendHorizontal size={26} strokeWidth={2.2} />
        </span>
      ))}

      <span className="lp-ripple" />
      <span className="lp-cursor">
        <MousePointer2 size={30} strokeWidth={1.6} />
      </span>
    </div>
  );
}

export default LoginScene;
