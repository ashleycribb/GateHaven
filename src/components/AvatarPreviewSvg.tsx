import React from 'react';
import { AvatarConfig } from '../types/blockhaven';

interface AvatarPreviewSvgProps {
  avatar: AvatarConfig;
  className?: string;
}

/**
 * Smooth-shaded Valheim humanoid preview illustration reflecting body tone,
 * muted Nordic garments, hair style, beard style, and restyled hats.
 */
export const AvatarPreviewSvg: React.FC<AvatarPreviewSvgProps> = ({
  avatar,
  className = 'h-56 w-44 drop-shadow-sm',
}) => {
  const hairStyle = avatar.hairStyle ?? 'short';
  const beardStyle = avatar.beardStyle ?? 'none';
  const hairColor = avatar.hairColor || '#5F4936';
  const hatFill = avatar.hat === 'crown' ? '#B5904C' : avatar.hatColor || '#7D5838';
  const pantsColor = avatar.pantsColor || '#3C352E';
  const wearingClosedHat =
    avatar.hat === 'cap' ||
    avatar.hat === 'sunhat' ||
    avatar.hat === 'wizard' ||
    avatar.hat === 'beanie';

  return (
    <svg
      viewBox="0 0 180 236"
      className={className}
      role="img"
      aria-label={`Preview of ${avatar.displayName || 'player'} avatar`}
    >
      <defs>
        <linearGradient id="valheim-shade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
          <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.26" />
        </linearGradient>
        <radialGradient id="valheim-head-shade" cx="42%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="70%" stopColor="#000000" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
        </radialGradient>
      </defs>

      {/* Contact ground shadow */}
      <ellipse cx="90" cy="222" rx="44" ry="8" fill="rgba(10,8,6,0.52)" />

      {/* Fur-Cloak back cape silhouette */}
      {avatar.shirtStyle === 'hoodie' && (
        <path
          d="M 55 96 L 44 186 Q 90 194 136 186 L 125 96 Z"
          fill={avatar.shirtColor}
          opacity="0.72"
        />
      )}

      {/* Long / Ponytail back hair layer */}
      {hairStyle === 'long' && (
        <path
          d="M 65 56 Q 58 84 60 108 L 120 108 Q 122 84 115 56 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'ponytail' && (
        <path
          d="M 108 58 Q 126 68 122 98 Q 116 106 112 96 Q 114 78 104 68 Z"
          fill={hairColor}
        />
      )}

      {/* Tapered Legs & Fur-Cuffed Leather Boots */}
      <g>
        {/* Left leg */}
        <path d="M 67 148 L 87 148 L 84 184 L 70 184 Z" fill={pantsColor} />
        <path d="M 67 148 L 87 148 L 84 184 L 70 184 Z" fill="url(#valheim-shade)" />
        {/* Right leg */}
        <path d="M 93 148 L 113 148 L 110 184 L 96 184 Z" fill={pantsColor} />
        <path d="M 93 148 L 113 148 L 110 184 L 96 184 Z" fill="url(#valheim-shade)" />

        {/* Fur boot cuffs */}
        <rect x="68" y="177" width="18" height="8" rx="3" fill="#6E6153" />
        <rect x="94" y="177" width="18" height="8" rx="3" fill="#6E6153" />

        {/* Tapered leather boots */}
        <path d="M 70 184 L 84 184 L 83 211 Q 77 215 67 214 Q 65 208 69 205 Z" fill="#4B3626" />
        <path d="M 96 184 L 110 184 L 111 205 Q 115 208 113 214 Q 103 215 97 211 Z" fill="#4B3626" />
        {/* Boot soles */}
        <rect x="66" y="213" width="18" height="4" rx="2" fill="#221812" />
        <rect x="96" y="213" width="18" height="4" rx="2" fill="#221812" />
      </g>

      {/* Tapered Arms, Leather Bracers & Visible Sculpted Hands */}
      <g>
        {/* Left arm */}
        <path d="M 55 96 L 64 98 L 58 128 L 46 125 Z" fill={avatar.shirtColor} />
        <rect
          x="45"
          y="123"
          width="14"
          height="5"
          rx="2.5"
          transform="rotate(11 52 125)"
          fill={avatar.shirtStyle === 'hoodie' ? '#6E6153' : '#CFC2AA'}
        />
        <path d="M 47 127 L 57 129 L 53 152 L 44 150 Z" fill={avatar.bodyColor} />
        {/* Left leather bracer */}
        <path d="M 46 131 L 56 133 L 54 148 L 44 146 Z" fill="#342419" />
        {/* Left sculpted hand + thumb */}
        <ellipse cx="48" cy="157" rx="5.5" ry="7.5" fill={avatar.bodyColor} />
        <ellipse cx="53.5" cy="155.5" rx="2.3" ry="4" transform="rotate(-20 53.5 155.5)" fill={avatar.bodyColor} />

        {/* Right arm */}
        <path d="M 125 96 L 116 98 L 122 128 L 134 125 Z" fill={avatar.shirtColor} />
        <rect
          x="121"
          y="123"
          width="14"
          height="5"
          rx="2.5"
          transform="rotate(-11 128 125)"
          fill={avatar.shirtStyle === 'hoodie' ? '#6E6153' : '#CFC2AA'}
        />
        <path d="M 133 127 L 123 129 L 127 152 L 136 150 Z" fill={avatar.bodyColor} />
        {/* Right leather bracer */}
        <path d="M 134 131 L 124 133 L 126 148 L 136 146 Z" fill="#342419" />
        {/* Right sculpted hand + thumb */}
        <ellipse cx="132" cy="157" rx="5.5" ry="7.5" fill={avatar.bodyColor} />
        <ellipse cx="126.5" cy="155.5" rx="2.3" ry="4" transform="rotate(20 126.5 155.5)" fill={avatar.bodyColor} />
      </g>

      {/* Tapered Nordic Torso & Tunic Skirt */}
      <g>
        <path
          d="M 66 90 Q 90 86 114 90 L 124 98 L 115 134 L 119 156 Q 90 162 61 156 L 65 134 L 56 98 Z"
          fill={avatar.shirtColor}
        />

        {/* Woven chest bands ('striped') */}
        {avatar.shirtStyle === 'striped' && (
          <>
            <path d="M 59 107 L 121 107 L 119 115 L 61 115 Z" fill="#CFC2AA" opacity="0.9" />
            <path d="M 62 121 L 118 121 L 116 128 L 64 128 Z" fill="#8B6B46" opacity="0.92" />
          </>
        )}

        {/* Diagonal leather baldric ('classic') */}
        {avatar.shirtStyle === 'classic' && (
          <path d="M 66 91 L 75 91 L 114 136 L 106 138 Z" fill="#4B3626" />
        )}

        {/* Leather craftsman apron ('overalls') */}
        {avatar.shirtStyle === 'overalls' && (
          <>
            <path d="M 71 91 L 78 91 L 79 114 L 72 114 Z" fill="#342419" />
            <path d="M 102 91 L 109 91 L 108 114 L 101 114 Z" fill="#342419" />
            <path d="M 70 112 L 110 112 L 115 156 Q 90 161 65 156 Z" fill="#4B3626" />
            <circle cx="75" cy="115" r="2.2" fill="#A98348" />
            <circle cx="105" cy="115" r="2.2" fill="#A98348" />
          </>
        )}

        {/* Tunic hem border */}
        <path d="M 62 151 Q 90 157 118 151 L 119 156 Q 90 162 61 156 Z" fill="#CFC2AA" opacity="0.82" />

        {/* Leather belt, iron buckle & hip pouch */}
        <path d="M 64 132 Q 90 136 116 132 L 116 141 Q 90 145 64 141 Z" fill="#342419" />
        <rect x="85" y="133" width="10" height="8" rx="1.5" fill="none" stroke="#8A847A" strokeWidth="2.2" />
        <ellipse cx="111" cy="145" rx="6" ry="7.5" fill="#4B3626" />
        <circle cx="111" cy="143" r="1.4" fill="#A98348" />

        {/* Linen collar */}
        <path d="M 77 90 Q 90 98 103 90" fill="none" stroke="#CFC2AA" strokeWidth="4" strokeLinecap="round" />

        {/* Fur shoulder mantle & brooch ('hoodie') */}
        {avatar.shirtStyle === 'hoodie' && (
          <>
            <path
              d="M 52 98 Q 62 84 90 88 Q 118 84 128 98 Q 118 107 90 103 Q 62 107 52 98 Z"
              fill="#6E6153"
            />
            <circle cx="90" cy="100" r="4.2" fill="#A98348" />
          </>
        )}

        {/* Smooth torso shading overlay */}
        <path
          d="M 66 90 Q 90 86 114 90 L 124 98 L 115 134 L 119 156 Q 90 162 61 156 L 65 134 L 56 98 Z"
          fill="url(#valheim-shade)"
        />
      </g>

      {/* Neck & Naturally Shaped Oval Head with Face */}
      <g>
        <path d="M 81 80 L 99 80 L 101 93 Q 90 97 79 93 Z" fill={avatar.bodyColor} />
        <path d="M 81 80 L 99 80 L 101 93 Q 90 97 79 93 Z" fill="#000000" opacity="0.12" />

        {/* Ears */}
        <ellipse cx="66" cy="63" rx="3.8" ry="6.2" fill={avatar.bodyColor} />
        <ellipse cx="114" cy="63" rx="3.8" ry="6.2" fill={avatar.bodyColor} />

        {/* Sculpted oval cranium + tapered jaw */}
        <path
          d="M 67 59 C 67 40 77 35 90 35 C 103 35 113 40 113 59 C 113 73 103 86 90 87 C 77 86 67 73 67 59 Z"
          fill={avatar.bodyColor}
        />
        <path
          d="M 67 59 C 67 40 77 35 90 35 C 103 35 113 40 113 59 C 113 73 103 86 90 87 C 77 86 67 73 67 59 Z"
          fill="url(#valheim-head-shade)"
        />

        {/* Eyebrows */}
        <path d="M 75 55 Q 80 53 85 55" stroke={hairColor} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M 95 55 Q 100 53 105 55" stroke={hairColor} strokeWidth="2.4" strokeLinecap="round" fill="none" />

        {/* Expressive eyes */}
        <ellipse cx="80" cy="60.5" rx="4.2" ry="2.8" fill="#E6DFD3" />
        <ellipse cx="100" cy="60.5" rx="4.2" ry="2.8" fill="#E6DFD3" />
        <circle cx="80.3" cy="60.5" r="2.2" fill="#465D67" />
        <circle cx="99.7" cy="60.5" r="2.2" fill="#465D67" />
        <circle cx="80.3" cy="60.5" r="1.2" fill="#171412" />
        <circle cx="99.7" cy="60.5" r="1.2" fill="#171412" />

        {/* Nose bridge & tip */}
        <path d="M 90 58 L 88 67 Q 90 69 92 67" stroke="#000000" strokeOpacity="0.24" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* Mouth */}
        <path d="M 84 75 Q 90 77.5 96 75" stroke="#6E4438" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Beard Styles */}
        {beardStyle === 'stubble' && (
          <path
            d="M 71 71 Q 72 86 90 88 Q 108 86 109 71 Q 102 79 90 79 Q 78 79 71 71 Z"
            fill={hairColor}
            opacity="0.34"
          />
        )}
        {beardStyle === 'short' && (
          <>
            <path
              d="M 70 68 Q 71 88 90 93 Q 109 88 110 68 Q 103 78 90 79 Q 77 78 70 68 Z"
              fill={hairColor}
            />
            <path d="M 80 73 Q 90 70 100 73 Q 95 76 90 74.5 Q 85 76 80 73 Z" fill={hairColor} />
          </>
        )}
        {beardStyle === 'braided' && (
          <>
            <path
              d="M 69 67 Q 71 88 90 91 Q 109 88 111 67 Q 102 77 90 78 Q 78 77 69 67 Z"
              fill={hairColor}
            />
            <path d="M 78 73 Q 90 69 102 73 Q 96 77 90 75 Q 84 77 78 73 Z" fill={hairColor} />
            {/* Twin chin braids + bronze clasps */}
            <path d="M 80 86 L 86 86 L 84 106 L 78 106 Z" fill={hairColor} />
            <path d="M 94 86 L 100 86 L 102 106 L 96 106 Z" fill={hairColor} />
            <rect x="78" y="99" width="7" height="3.2" rx="1" fill="#A98348" />
            <rect x="95" y="99" width="7" height="3.2" rx="1" fill="#A98348" />
          </>
        )}
        {beardStyle === 'full' && (
          <>
            <path
              d="M 68 66 Q 68 94 90 107 Q 112 94 112 66 Q 103 77 90 78 Q 77 77 68 66 Z"
              fill={hairColor}
            />
            <path d="M 77 73 Q 90 69 103 73 Q 97 78 90 75.5 Q 83 78 77 73 Z" fill={hairColor} />
          </>
        )}

        {/* Hair Styles */}
        {hairStyle !== 'bald' && (
          <>
            {!wearingClosedHat && (
              <path
                d="M 65 58 C 65 36 77 30 90 30 C 103 30 115 36 115 58 C 110 47 101 44 90 45 C 79 44 70 47 65 58 Z"
                fill={hairColor}
              />
            )}
            {hairStyle === 'short' && (
              <path
                d="M 67 52 Q 78 44 96 47 Q 106 48 112 54 Q 106 42 90 41 Q 74 41 67 52 Z"
                fill={hairColor}
              />
            )}
            {hairStyle === 'braids' && (
              <>
                <path d="M 65 58 L 71 58 L 69 98 L 62 96 Z" fill={hairColor} />
                <path d="M 109 58 L 115 58 L 118 96 L 111 98 Z" fill={hairColor} />
                <rect x="62" y="90" width="7" height="3" rx="1" fill="#A98348" />
                <rect x="111" y="90" width="7" height="3" rx="1" fill="#A98348" />
              </>
            )}
            {hairStyle === 'long' && (
              <>
                <path d="M 64 56 Q 60 80 63 102 L 70 98 Q 68 78 70 58 Z" fill={hairColor} />
                <path d="M 116 56 Q 120 80 117 102 L 110 98 Q 112 78 110 58 Z" fill={hairColor} />
              </>
            )}
            {hairStyle === 'ponytail' && (
              <path d="M 67 54 Q 73 46 73 60 L 67 60 Z M 113 54 Q 107 46 107 60 L 113 60 Z" fill={hairColor} />
            )}
          </>
        )}

        {/* Restyled Hats fitted to oval humanoid head */}
        {avatar.hat === 'cap' && (
          <>
            <path d="M 64 49 C 64 31 76 26 90 26 C 104 26 116 31 116 49 Z" fill={hatFill} />
            <path d="M 64 46 Q 90 50 116 46 L 116 50 Q 90 54 64 50 Z" fill="#342419" />
            <path d="M 64 49 Q 94 56 126 51 Q 110 45 64 49 Z" fill={hatFill} />
            <circle cx="90" cy="26" r="2.8" fill="#A98348" />
          </>
        )}
        {avatar.hat === 'sunhat' && (
          <>
            <path d="M 42 50 Q 90 42 138 50 Q 90 57 42 50 Z" fill={hatFill} />
            <path d="M 67 48 L 71 29 Q 90 25 109 29 L 113 48 Z" fill={hatFill} />
            <path d="M 68 43 Q 90 46 112 43 L 113 47 Q 90 50 67 47 Z" fill={avatar.shirtColor} />
          </>
        )}
        {avatar.hat === 'crown' && (
          <>
            <path
              d="M 67 44 L 69 30 L 79 39 L 90 24 L 101 39 L 111 30 L 113 44 Q 90 47 67 44 Z"
              fill={hatFill}
            />
            <path d="M 67 42 Q 90 45 113 42 L 113 46 Q 90 49 67 46 Z" fill="#927038" />
          </>
        )}
        {avatar.hat === 'wizard' && (
          <>
            <path d="M 45 50 Q 90 43 135 50 Q 90 56 45 50 Z" fill={hatFill} />
            <path d="M 66 49 L 86 8 L 106 16 L 94 26 L 114 49 Z" fill={hatFill} />
            <path d="M 67 45 Q 90 48 113 45 L 113 49 Q 90 52 67 49 Z" fill="#342419" />
            <rect x="86" y="45" width="8" height="5" rx="1" fill="#A98348" />
          </>
        )}
        {avatar.hat === 'beanie' && (
          <>
            <path d="M 65 48 C 65 26 78 22 92 22 C 106 22 115 28 115 48 Z" fill={hatFill} />
            <path d="M 63 44 Q 90 48 117 44 L 116 52 Q 90 56 64 52 Z" fill="#CFC2AA" />
            <circle cx="92" cy="19" r="5" fill="#CFC2AA" />
          </>
        )}
      </g>
    </svg>
  );
};
