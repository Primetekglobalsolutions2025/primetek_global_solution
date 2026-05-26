import React from 'react';

interface LogoProps {
  className?: string;
  dark?: boolean;
}

export default function Logo({ className = "w-48 h-auto", dark = false }: LogoProps) {
  const primaryColor = dark ? "#FFFFFF" : "#0F172A";
  const secondaryColor = dark ? "#94A3B8" : "#475569";
  const globeColor = dark ? "#60A5FA" : "#1E3A8A";

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 400 100" 
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="globeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={globeColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={primaryColor} stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>
        <linearGradient id="meshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={globeColor} />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Logo Mark (Globe + P) */}
      <g transform="translate(10, 10)">
        {/* Globe / Orbit lines */}
        <ellipse cx="40" cy="40" rx="35" ry="35" fill="none" stroke="url(#globeGrad)" strokeWidth="1.5" opacity="0.4"/>
        <ellipse cx="40" cy="40" rx="15" ry="35" fill="none" stroke="url(#globeGrad)" strokeWidth="1" opacity="0.5"/>
        <ellipse cx="40" cy="40" rx="35" ry="15" fill="none" stroke="url(#globeGrad)" strokeWidth="1" opacity="0.5"/>
        <path d="M 15 15 L 65 65 M 15 65 L 65 15" stroke="url(#globeGrad)" strokeWidth="0.5" opacity="0.3"/>
        
        {/* P Network Mesh */}
        <path 
          d="M 25,65 L 25,20 L 45,20 C 55,20 60,25 60,35 C 60,45 55,50 45,50 L 25,50" 
          fill="none" 
          stroke="url(#meshGrad)" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        
        {/* Connection Nodes */}
        <circle cx="25" cy="20" r="4.5" fill="url(#goldGrad)" />
        <circle cx="45" cy="20" r="4" fill="url(#goldGrad)" />
        <circle cx="58" cy="35" r="4.5" fill="url(#goldGrad)" />
        <circle cx="45" cy="50" r="4" fill="url(#goldGrad)" />
        <circle cx="25" cy="50" r="4.5" fill="url(#goldGrad)" />
        <circle cx="25" cy="65" r="4" fill="url(#goldGrad)" />
        
        {/* Outer orbital node */}
        <circle cx="70" cy="20" r="2.5" fill="url(#goldGrad)" opacity="0.8" />
        <path d="M 60 25 L 70 20" stroke="url(#globeGrad)" strokeWidth="1" opacity="0.5" />
      </g>

      {/* Text Elements */}
      <g transform="translate(105, 50)">
        <text 
          x="0" 
          y="0" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="800" 
          fontSize="38" 
          fill={primaryColor} 
          letterSpacing="1"
        >
          PRIMETEK
        </text>
        
        {/* Gold Separator Line */}
        <path d="M 2 12 L 195 12" stroke="url(#goldGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
        
        <text 
          x="0" 
          y="32" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="600" 
          fontSize="13" 
          fill={secondaryColor} 
          letterSpacing="4"
        >
          GLOBAL SOLUTIONS
        </text>
      </g>
    </svg>
  );
}
