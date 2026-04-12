import React from 'react';

const Logo: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Board */}
    <rect x="4" y="22" width="32" height="6" rx="3" fill="#E8622A" />
    {/* Wheels */}
    <circle cx="11" cy="31" r="3" fill="#1a1a1a" />
    <circle cx="29" cy="31" r="3" fill="#1a1a1a" />
    {/* Wheel axle lines */}
    <rect x="9" y="28" width="4" height="1.5" rx="0.75" fill="#6b6b73" />
    <rect x="27" y="28" width="4" height="1.5" rx="0.75" fill="#6b6b73" />
    {/* Bold K */}
    <text
      x="20"
      y="19"
      textAnchor="middle"
      fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
      fontWeight="800"
      fontSize="20"
      fill="#1a1a1a"
    >
      K
    </text>
  </svg>
);

export default Logo;
