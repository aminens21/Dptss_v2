import React from 'react';

interface SportSilhouetteProps {
  sportVisual: string;
  color?: string; // Primary fill or accent color
  className?: string;
  isCertificate?: boolean;
  customSilhouetteUrl?: string | null;
  silhouetteScale?: number; // Scale multiplier (1.0 = 100%, 0.5 to 2.5)
  opacity?: number;
  position?: { x: number; y: number };
}

export const SportSilhouette: React.FC<SportSilhouetteProps> = ({
  sportVisual,
  color = '#1e293b',
  className = 'w-full h-24',
  isCertificate = false,
  customSilhouetteUrl = null,
  silhouetteScale = 1.0,
  opacity = 100,
  position = { x: 0, y: 0 },
}) => {
  const fillColor = color;
  const scaleStyle: React.CSSProperties = {
    transform: `translate(${position.x}%, ${position.y}%) scale(${silhouetteScale})`,
    transformOrigin: 'center center',
    opacity: opacity !== 100 ? opacity / 100 : undefined,
    transition: 'transform 0.15s ease-out',
  };

  if (!customSilhouetteUrl) {
    return null;
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={scaleStyle}>
      <img
        src={customSilhouetteUrl}
        alt="رسم ظلي مخصص"
        className="max-h-full max-w-full object-contain filter drop-shadow-sm"
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          opacity: opacity !== 100 ? opacity / 100 : undefined,
        }}
      />
    </div>
  );
};

