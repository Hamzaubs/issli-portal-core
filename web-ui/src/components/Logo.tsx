// apps/web-ui/src/components/Logo.tsx
import React from 'react';
import logoSrc from '../assets/logo.png'; 

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  return (
    <img 
      src={logoSrc} 
      alt="ISSLI PEACHE Logo" 
      className={`object-contain select-none ${className}`} 
    />
  );
};
