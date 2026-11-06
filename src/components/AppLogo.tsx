import React, { useId } from 'react';

interface AppLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  directorateName?: string;
  variant?: 'light' | 'dark';
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 52,
  showText = false,
  directorateName,
  variant = 'light'
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 52;
  const heightValue = numericSize * 1.2;
  
  const instanceId = useId().replace(/:/g, '');
  const shadowId = `logoShadow_${instanceId}`;
  const goldCrownId = `goldCrown_${instanceId}`;
  const moroccoRedId = `moroccoRed_${instanceId}`;
  const moroccoGreenId = `moroccoGreen_${instanceId}`;
  const skyBlueId = `skyBlue_${instanceId}`;
  const textPathGreenId = `textPathGreen_${instanceId}`;
  const textPathRedId = `textPathRed_${instanceId}`;

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <svg
        viewBox="0 0 200 240"
        width={numericSize}
        height={heightValue}
        style={{ width: `${numericSize}px`, height: `${heightValue}px` }}
        className="shrink-0 drop-shadow-md transition-transform hover:scale-105 select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={shadowId} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.25" />
          </filter>
          <linearGradient id={goldCrownId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <linearGradient id={moroccoRedId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id={moroccoGreenId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>
          <linearGradient id={skyBlueId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* --- 1. Top Moroccan Crown --- */}
        <g id="crown" filter={`url(#${shadowId})`}>
          {/* Top Green Star */}
          <polygon
            points="100,6 102.5,13.5 110,13.5 104,18 106.5,25.5 100,21 93.5,25.5 96,18 90,13.5 97.5,13.5"
            fill="#15803d"
            stroke="#166534"
            strokeWidth="0.8"
          />
          {/* Crown Arch & Pearls */}
          <path
            d="M 85 30 Q 100 18 115 30 Q 128 36 122 46 Q 100 40 78 46 Q 72 36 85 30 Z"
            fill={`url(#${goldCrownId})`}
            stroke="#92400e"
            strokeWidth="1.2"
          />
          {/* Crown Spikes & Jewels */}
          <circle cx="100" cy="27" r="2.5" fill="#dc2626" />
          <circle cx="88" cy="31" r="2" fill="#15803d" />
          <circle cx="112" cy="31" r="2" fill="#15803d" />
          {/* Crown Base */}
          <path
            d="M 76 46 L 124 46 L 121 53 L 79 53 Z"
            fill={`url(#${goldCrownId})`}
            stroke="#92400e"
            strokeWidth="1"
          />
          <line x1="79" y1="49.5" x2="121" y2="49.5" stroke="#dc2626" strokeWidth="1.5" />
        </g>

        {/* --- 2. Main Circular Red Ring --- */}
        <g id="main-circle" filter={`url(#${shadowId})`}>
          <circle cx="100" cy="115" r="62" fill={`url(#${moroccoRedId})`} stroke="#ffffff" strokeWidth="2.5" />
          <circle cx="100" cy="115" r="59" fill="none" stroke="#fef08a" strokeWidth="1" opacity="0.8" />
        </g>

        {/* --- 3. Athletes Silhouettes in Ring --- */}
        <g id="athletes" fill="#ffffff" opacity="0.95">
          {/* Athlete Running (Top Left) */}
          <circle cx="68" cy="76" r="3.2" />
          <path d="M 68 80 L 64 92 L 58 97 M 68 83 L 75 90 L 71 98 M 64 85 L 58 84 M 68 84 L 74 81" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

          {/* Athlete Jumping/Gymnastics (Top Right) */}
          <circle cx="132" cy="74" r="3.2" />
          <path d="M 132 78 L 136 89 L 144 91 M 132 82 L 126 89 L 128 97 M 132 82 L 140 78 M 132 83 L 124 81" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

          {/* Basketball / Handball Player (Right) */}
          <circle cx="147" cy="115" r="3.2" fill="#86efac" />
          <path d="M 147 119 L 144 130 L 148 139 M 147 122 L 138 126 L 135 133 M 147 122 L 153 114" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <circle cx="155" cy="111" r="2.8" fill="#fef08a" />

          {/* Footballer / Runner (Bottom Right) */}
          <circle cx="128" cy="151" r="3" fill="#86efac" />
          <path d="M 128 154 L 122 163 L 115 165 M 128 156 L 135 164 L 141 163" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <circle cx="111" cy="166" r="2.5" fill="#ffffff" />

          {/* Javelin / High Jump (Bottom Left) */}
          <circle cx="70" cy="151" r="3" />
          <path d="M 70 154 L 75 163 L 83 166 M 70 156 L 63 163 L 59 161" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

          {/* Volleyball Player (Left) */}
          <circle cx="53" cy="115" r="3.2" fill="#86efac" />
          <path d="M 53 119 L 56 128 L 51 137 M 53 122 L 61 125 L 63 133 M 53 122 L 46 113" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <circle cx="43" cy="110" r="2.8" fill="#fef08a" />
        </g>

        {/* --- 4. Central Education Core (Blue Sky + Book + Track) --- */}
        <g id="center-core">
          {/* Inner Circle Border */}
          <circle cx="100" cy="115" r="37" fill="#ffffff" stroke="#f59e0b" strokeWidth="1.5" />
          
          {/* Upper Sky Hemisphere */}
          <path d="M 64 115 A 36 36 0 0 1 136 115 Z" fill={`url(#${skyBlueId})`} />

          {/* Lower Running Track Lanes */}
          <path d="M 64 115 A 36 36 0 0 0 136 115 Z" fill="#92400e" />
          <line x1="68" y1="122" x2="132" y2="122" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
          <line x1="72" y1="129" x2="128" y2="129" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
          <line x1="78" y1="136" x2="122" y2="136" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
          <line x1="86" y1="143" x2="114" y2="143" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />

          {/* Open White Book */}
          <g filter={`url(#${shadowId})`}>
            {/* Left Page */}
            <path
              d="M 100 120 C 92 114 77 114 69 119 C 69 104 84 94 100 100 Z"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            {/* Right Page */}
            <path
              d="M 100 120 C 108 114 123 114 131 119 C 131 104 116 94 100 100 Z"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            {/* Book Spine Center */}
            <line x1="100" y1="100" x2="100" y2="121" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Page Lines */}
            <line x1="75" y1="110" x2="94" y2="107" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="74" y1="114" x2="95" y2="111" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="106" y1="107" x2="125" y2="110" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="105" y1="111" x2="126" y2="114" stroke="#94a3b8" strokeWidth="0.8" />
          </g>
        </g>

        {/* --- 5. Green Curved Banner with Arabic Title --- */}
        <g id="green-banner" filter={`url(#${shadowId})`}>
          <path
            d="M 15 152 Q 100 206 185 152 L 198 166 Q 100 226 2 166 Z"
            fill={`url(#${moroccoGreenId})`}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          {/* Gold Trim */}
          <path
            d="M 17 155 Q 100 208 183 155"
            fill="none"
            stroke="#fef08a"
            strokeWidth="1"
          />
          {/* Arabic Text curved along banner */}
          <path
            id={textPathGreenId}
            d="M 18 162 Q 100 216 182 162"
            fill="none"
          />
          <text fill="#ffffff" fontSize="8.5" fontWeight="900" fontFamily="'Tajawal', 'Cairo', sans-serif">
            <textPath href={`#${textPathGreenId}`} startOffset="50%" textAnchor="middle">
              الفرع الإقليمي للجامعة الملكية للرياضة المدرسية
            </textPath>
          </text>
        </g>

        {/* --- 6. Bottom Red Ribbon (F.R.M.S.S.) --- */}
        <g id="red-ribbon" filter={`url(#${shadowId})`}>
          {/* Green Ribbon Tails */}
          <path d="M 28 200 L 46 195 L 42 225 L 22 226 L 31 213 Z" fill="#065f46" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M 172 200 L 154 195 L 158 225 L 178 226 L 169 213 Z" fill="#065f46" stroke="#ffffff" strokeWidth="0.8" />

          {/* Central Red Ribbon */}
          <path
            d="M 36 195 Q 100 230 164 195 L 160 218 Q 100 252 40 218 Z"
            fill={`url(#${moroccoRedId})`}
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          {/* FRMSS Acronym Text */}
          <path
            id={textPathRedId}
            d="M 40 210 Q 100 242 160 210"
            fill="none"
          />
          <text fill="#ffffff" fontSize="13" fontWeight="900" letterSpacing="3.5" fontFamily="'Arial Black', 'Trebuchet MS', sans-serif">
            <textPath href={`#${textPathRedId}`} startOffset="50%" textAnchor="middle">
              F.R.M.S.S.
            </textPath>
          </text>
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col text-right min-w-0 select-none">
          <span className={`text-xs sm:text-sm font-black leading-tight truncate ${variant === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            الجامعة الملكية المغربية للرياضة المدرسية
          </span>
          <span className={`text-[10px] sm:text-xs font-bold leading-tight truncate ${variant === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
            الفرع الإقليمي {directorateName ? `• ${directorateName}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};
