import type { CSSProperties } from 'react';
import { ICONS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const data = ICONS[name];
  return (
    <span className={`icon ${className}`.trim()} style={{ width: size, height: size, ...style }} aria-hidden="true">
      <svg viewBox={data.viewBox} fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">
        {data.paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    </span>
  );
}
