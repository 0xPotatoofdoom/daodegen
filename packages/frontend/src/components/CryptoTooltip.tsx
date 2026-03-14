'use client';

import React, { useState } from 'react';

interface CryptoTooltipProps {
  term: string;
  explanation: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * CryptoTooltip - Explains crypto terms for non-crypto users
 * Provides hover and click interactions for accessibility
 */
export function CryptoTooltip({ 
  term, 
  explanation, 
  children, 
  position = 'top' 
}: CryptoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };
  
  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-slate-700 border-l-4 border-r-4 border-t-4',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-slate-700 border-l-4 border-r-4 border-b-4',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-slate-700 border-t-4 border-b-4 border-l-4',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-slate-700 border-t-4 border-b-4 border-r-4'
  };
  
  return (
    <span className="relative inline-block">
      <span
        className="cursor-help underline decoration-dotted decoration-dao-purple/60 hover:decoration-dao-purple transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsVisible(!isVisible);
          }
        }}
        aria-label={`Click to learn about ${term}`}
      >
        {children}
      </span>

      {isVisible && (
        <span
          className={`absolute z-50 ${positionClasses[position]} w-80 max-w-xs sm:max-w-sm block`}
          role="tooltip"
        >
          <span className="bg-slate-700 text-white p-3 rounded-lg shadow-xl border border-dao-purple/30 block">
            <span className="font-semibold text-dao-gold text-sm mb-1 block">{term}</span>
            <span className="text-xs text-gray-200 leading-relaxed block">{explanation}</span>
          </span>
          <span className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
        </span>
      )}
    </span>
  );
}

export default CryptoTooltip;