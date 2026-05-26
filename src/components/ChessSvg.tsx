/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PieceType, PieceColor } from '../types';

interface SvgPieceProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
}

export const ChessSvg: React.FC<SvgPieceProps> = ({ type, color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  
  // Custom subtle drop shadow and borders for pieces to look modern and geometric
  const fill = isWhite ? '#FFFFFF' : '#1A1D20';
  const stroke = isWhite ? '#1A1D20' : '#ECEFF1';
  const secondaryFill = isWhite ? '#ECEFF1' : '#2D3136';

  switch (type) {
    case 'p': // Pawn
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 13 30.22 13 34h19c0-3.78-2.41-6.91-5.41-7.97 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
            <path d="M11.5 37h22v3h-22z" fill={secondaryFill} />
          </g>
        </svg>
      );

    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3-13h21v-4H12v4zm2.5-11h16l1.5-5H13l1.5 5z" />
            <path d="M12 36v-10h21v10H12zm2.5-11h16V15h-16v10z" />
            <path d="M9 15v-6h5v3h5V9h5v3h5V9h5v6H9z" fill={secondaryFill} />
          </g>
        </svg>
      );

    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14.5,21.5 16.5,21.5 C 18.5,21.5 21,23 22,25 C 23,27 22,30 22,30 C 22,30 24,28 26,25 C 28,22 28,18 28,18 C 28,18 31,17 32,12 C 30,13 28,13 26,11 C 24,9 22,10 22,10 z" />
            <path d="M 22,30 C 22,30 21,32 17,31 C 13,30 11,35 11,35 L 34,35 C 34,35 34,29 29,26 L 22,30 z" />
            <path d="M 9,38 L 36,38 L 33,40 L 12,40 L 9,38 z" fill={secondaryFill} />
            <circle cx="27" cy="15" r="1.5" fill={isWhite ? '#1A1D20' : '#FFFFFF'} stroke="none" />
          </g>
        </svg>
      );

    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 36h27v-4H9v4zm21-10c2.21 0 4-1.79 4-4 0-1.71-.85-4.22-3.12-6.5C28.61 13.22 25.13 11 22.5 11s-6.11 2.22-8.38 4.5C11.85 17.78 11 20.29 11 22.2c0 2.21 1.79 4 4 4" />
            <path d="M15 26.5c0 0 3-1.5 7.5-1.5s7.5 1.5 7.5 1.5V31H15v-4.5z" />
            <path d="M22.5 8c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5S23.33 8 22.5 8z" fill={secondaryFill} />
            {/* Cut / slit in bishop head */}
            <path d="M17.5 18l10 5M27.5 18l-10 5" stroke={stroke} strokeWidth="2" />
          </g>
        </svg>
      );

    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM22.5 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill={secondaryFill} />
            <path d="M6 16l3 20h27l3-20L31.5 29 22.5 17 13.5 29 6 16z" />
            <path d="M9 37h27v3H9v-3z" fill={secondaryFill} />
          </g>
        </svg>
      );

    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6M20 8h5" strokeWidth="2" />
            <path d="M11.5 30C15 33 20 31.5 22.5 31.5S30 33 33.5 30C36 21 34 16 32 14c-4-4-6.5.5-9.5.5S17 10 13 14C11 16 9 21 11.5 30z" />
            <path d="M11.5 30h22v3h-22z" />
            <path d="M11.5 34h22v3h-22z" fill={secondaryFill} />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
