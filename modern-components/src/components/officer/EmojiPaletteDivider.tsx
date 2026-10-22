/**
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-12
 * PURPOSE: Enhanced emoji palette with glowing pulse effects to guide user interaction.
 * Compact 2x5 emoji palette that acts as a visual divider between TEST INPUT and YOUR SOLUTION.
 * Features pulsing glow effect until user first interacts, making controls more discoverable.
 * SRP and DRY check: Pass - Single responsibility (value selection), enhanced with UX improvements
 *
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SPACE_EMOJIS, type EmojiSet } from '@/constants/spaceEmojis';
import type { DisplayMode } from '@/types/puzzleDisplayTypes';

interface EmojiPaletteDividerProps {
  emojiSet: EmojiSet;
  selectedValue: number;
  onValueSelect: (value: number) => void;
  usedValues?: number[];
  className?: string;
  displayMode?: DisplayMode;
}

export const EmojiPaletteDivider: React.FC<EmojiPaletteDividerProps> = ({
  emojiSet,
  selectedValue,
  onValueSelect,
  usedValues = [],
  className = '',
  displayMode = 'emoji'
}) => {
  // Track user interaction to control glowing pulse effect
  const [hasInteracted, setHasInteracted] = useState(false);

  // Handle value selection with interaction tracking
  const handleValueSelect = (value: number) => {
    setHasInteracted(true);
    onValueSelect(value);
  };
  const getAllEmojis = () => {
    const emojis = SPACE_EMOJIS[emojiSet];
    return emojis.map((emoji, index) => ({ emoji, value: index }));
  };

  const emojis = getAllEmojis();

  // Split into 2 rows of 5 values each
  const topRow = emojis.slice(0, 5);
  const bottomRow = emojis.slice(5, 10);

  const renderValueButton = ({ emoji, value }: { emoji: string; value: number }) => {
    const isSelected = value === selectedValue;
    const isUsed = usedValues.includes(value);

    // Determine what to display based on mode
    let displayContent: string;
    if (displayMode === 'arc-colors') {
      displayContent = value.toString();
    } else if (displayMode === 'hybrid') {
      displayContent = `${value}${emoji}`;
    } else {
      displayContent = emoji;
    }

    return (
      <Button
        key={value}
        variant={isSelected ? "default" : "outline"}
        size="sm"
        onClick={() => handleValueSelect(value)}
        className={`
          h-24 w-20 p-0 text-2xl font-bold flex-shrink-0 transition-all duration-300
          ${!hasInteracted ? 'animate-pulse [animation-duration:3s] ring-1 ring-amber-400/60 shadow-md shadow-amber-400/30' : ''}
          ${isSelected
            ? 'bg-amber-600 text-slate-900 hover:bg-amber-700 ring-2 ring-amber-400'
            : isUsed
              ? 'border-cyan-400 text-cyan-300 hover:bg-cyan-600 hover:text-white border-2'
              : 'border-slate-500 text-slate-300 hover:bg-slate-600'
          }
        `}
        title={`Value ${value}: ${emoji} ${isUsed ? '(used in puzzle)' : ''}`}
      >
        {displayContent}
      </Button>
    );
  };

  return (
    <div className={`
      flex flex-col items-center justify-center gap-4 transition-all duration-300
      ${!hasInteracted ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/30 animate-pulse [animation-duration:4s]' : ''}
      ${className}
    `}>
      {/* Header with clear description */}
      <div className="text-center">
        <h4 className={`
          text-amber-300 text-2xl font-bold mb-2 transition-all duration-300
          ${!hasInteracted ? 'animate-pulse [animation-duration:3s] text-amber-200' : ''}
        `}>
          PAINTING TOOLS
        </h4>
        <p className={`
          text-slate-300 text-lg transition-all duration-300
          ${!hasInteracted ? 'animate-pulse [animation-duration:3s] text-slate-200' : ''}
        `}>
          Select a value, then click on the output grid to paint
        </p>
      </div>

      {/* Top row (0-4) */}
      <div className="flex gap-2">
        {topRow.map(renderValueButton)}
      </div>

      {/* Bottom row (5-9) */}
      <div className="flex gap-2">
        {bottomRow.map(renderValueButton)}
      </div>

      {/* Selected value indicator - more prominent */}
      <div className="bg-amber-600 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg">
        Selected: Value {selectedValue}
      </div>

      {/* Usage hint */}
      <div className="text-slate-400 text-sm text-center max-w-48">
        Value 0 = Background • Values 1-9 = Different elements
      </div>
    </div>
  );
};