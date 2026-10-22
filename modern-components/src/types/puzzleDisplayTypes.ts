/**
 * Enhanced Puzzle Display System Types
 * =====================================
 * Type definitions for the enhanced puzzle display system with emoji sets,
 * ARC color overlays, and interactive value selection
 */

import type { EmojiSet } from '@/constants/spaceEmojis';

/** Display mode options for puzzle visualization */
export type DisplayMode = 'emoji' | 'arc-colors' | 'hybrid';

/** Puzzle display preferences */
export interface PuzzleDisplayPreferences {
  displayMode: DisplayMode;
  emojiSet: EmojiSet;
  selectedValue: number;
  persistAcrossSessions: boolean;
}

/** Color overlay configuration for ARC color mode */
export interface ColorOverlayConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  opacity: number;
}

/** Enhanced display options for grid components */
export interface EnhancedDisplayOptions {
  displayMode?: DisplayMode;
  selectedValue?: number;
  onCellInteraction?: (row: number, col: number, value: number) => void;
  showValuePalette?: boolean;
}

/** Props for PuzzleDisplayControls component */
export interface PuzzleDisplayControlsProps {
  displayMode: DisplayMode;
  emojiSet: EmojiSet;
  selectedValue: number;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onEmojiSetChange: (set: EmojiSet) => void;
  onValueSelect: (value: number) => void;
  className?: string;
}

/** Props for ValuePalette component */
export interface ValuePaletteProps {
  selectedValue: number;
  displayMode: DisplayMode;
  emojiSet: EmojiSet;
  onValueSelect: (value: number) => void;
  usedValues?: number[];
  className?: string;
}

/** Props for EnhancedGridCell component */
export interface EnhancedGridCellProps {
  value: number;
  displayMode: DisplayMode;
  emojiSet: EmojiSet;
  isSelected: boolean;
  isHovered: boolean;
  interactive: boolean;
  onClick?: (value: number) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onRightClick?: (value: number) => void;
  cellSize: number;
  className?: string;
}

/** Master puzzle display state */
export interface PuzzleDisplayState {
  displayMode: DisplayMode;
  emojiSet: EmojiSet;
  selectedValue: number;
  showControls: boolean;
}