import React from 'react';

interface CustomIconProps {
  name: 'plus' | 'map' | 'clipboard' | 'settings' | 'help' | 'user' | 'logout';
  className?: string;
}

export function CustomIcon({ name, className = "h-6 w-6" }: CustomIconProps) {
  return (
    <div 
      className={`${className} bg-current`}
      style={{
        maskImage: `url(/icons/${name}.svg)`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(/icons/${name}.svg)`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}