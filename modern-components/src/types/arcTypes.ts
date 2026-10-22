/**
 * ARC (Abstract Reasoning Corpus) TypeScript Definitions
 * For Officer Track - Advanced puzzle integration
 *
 * Raw ARC puzzles use integer grids (0-9) that get transformed to emojis for presentation
 * Maintains complete separation from base game task structure
 */

// =============================================================================
// CORE ARC DATA TYPES (Raw Format)
// =============================================================================

/** Raw ARC grid - integers 0-9 representing different objects/colors */
export type ARCGrid = number[][];

/** Single ARC example - input/output pair for training */
export interface ARCExample {
  input: ARCGrid;
  output: ARCGrid;
}

/** Raw ARC puzzle structure as loaded from JSON files */
export interface ARCPuzzle {
  /** Training examples to learn the pattern */
  train: ARCExample[];
  /** Test case(s) to solve */
  test: ARCExample[];
}

/** ARC dataset categories */
export type ARCDatasetType = 'training' | 'training2' | 'evaluation' | 'evaluation2';

// =============================================================================
// OFFICER TRACK ENHANCED TYPES
// =============================================================================

/** Officer Track enhanced puzzle with metadata */
export interface OfficerTrackPuzzle extends ARCPuzzle {
  /** Unique Officer Track ID (e.g., ARC-TR-007bbfb7, ARC-EV-00576224) */
  id: string;
  /** Original filename for reference */
  filename: string;
  /** Dataset source */
  dataset: ARCDatasetType;
  /** Estimated difficulty based on complexity analysis */
  difficulty: OfficerRankRequirement;
  /** Grid size analysis (min/max dimensions) */
  gridSize: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  };
  /** Complexity metrics */
  complexity: {
    /** Number of training examples */
    trainingExamples: number;
    /** Number of unique colors/objects used */
    uniqueColors: number;
    /** Estimated transformation complexity */
    transformationComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  };
  /** When puzzle was loaded/processed */
  loadedAt: Date;
}

/** Officer ranking system for progression */
export enum OfficerRank {
  LIEUTENANT = 'Lieutenant',
  CAPTAIN = 'Captain',
  MAJOR = 'Major',
  COLONEL = 'Colonel',
  GENERAL = 'General'
}

/** Officer rank requirements for puzzle access */
export type OfficerRankRequirement = keyof typeof OfficerRank;

/** Officer Track player data (separate from main game) */
export interface OfficerTrackPlayer {
  /** PlayFab player ID */
  playerId: string;
  /** Current officer rank */
  officerRank: OfficerRank;
  /** Officer track points (separate from main game) */
  officerPoints: number;
  /** Points needed for next rank */
  pointsToNextRank: number;
  /** Completed ARC puzzle IDs */
  completedPuzzles: string[];
  /** Current solving streak */
  currentStreak: number;
  /** Best solving streak achieved */
  bestStreak: number;
  /** Officer-specific achievements */
  achievements: OfficerAchievement[];
  /** Currently selected puzzle (if any) */
  currentPuzzle?: string;
  /** Officer track statistics */
  stats: {
    totalAttempts: number;
    successfulSolves: number;
    averageTimePerPuzzle: number;
    favoriteComplexity: string;
    totalTimeSpent: number;
  };
  /** Account creation for officer track */
  officerEnlistmentDate: Date;
  /** Last activity timestamp */
  lastActive: Date;
}

// =============================================================================
// LEADERBOARD AND RANKING TYPES
// =============================================================================

/** Officer Track leaderboard entry */
export interface OfficerLeaderboardEntry {
  /** Player display name */
  displayName: string;
  /** Officer rank */
  officerRank: OfficerRank;
  /** Total officer points */
  officerPoints: number;
  /** Leaderboard position */
  position: number;
  /** PlayFab player ID */
  playerId: string;
  /** Number of completed puzzles */
  completedPuzzles: number;
  /** Current streak */
  currentStreak: number;
  /** Player profile information */
  profile?: {
    avatarUrl?: string;
    enlistmentDate?: Date;
  };
}

// =============================================================================
// VALIDATION AND SCORING TYPES
// =============================================================================

/** ARC puzzle solution attempt */
export interface ARCSolutionAttempt {
  /** Puzzle ID being attempted */
  puzzleId: string;
  /** Player's solution grid (single test case) */
  solution: ARCGrid;
  /** Player's solution grids (multi test case support) */
  solutions?: ARCGrid[];
  /** Time taken to solve (in seconds) */
  timeElapsed: number;
  /** Number of hints used (if any) */
  hintsUsed?: number;
  /** Session ID for tracking */
  sessionId?: string;
  /** Attempt number for this puzzle */
  attemptNumber: number;
}

/** ARC validation result from CloudScript */
export interface ARCValidationResult {
  /** Whether validation was successful */
  success: boolean;
  /** Whether the solution is correct */
  correct: boolean;
  /** Base points for this puzzle (Officer Track uses 0) */
  pointsEarned: number;
  /** Time bonus points */
  timeBonus: number;
  /** Penalty for hints (if any) */
  hintPenalty: number;
  /** Total score (for compatibility) */
  totalScore?: number;
  /** Time elapsed during solve */
  timeElapsed?: number;
  /** When validation completed */
  completedAt?: string;
  /** Validation message */
  message: string;
  /** Optional: New total officer points (complex scoring) */
  newTotalPoints?: number;
  /** Optional: Whether player ranked up (complex scoring) */
  rankUp?: boolean;
  /** Optional: New rank (if ranked up) */
  newRank?: OfficerRank;
  /** Optional: Detailed scoring breakdown (complex scoring) */
  scoring?: {
    difficultyMultiplier: number;
    speedBonus: number;
    streakBonus: number;
    firstSolveBonus: number;
  };
}

// =============================================================================
// UI AND PRESENTATION TYPES
// =============================================================================

/** ARC grid transformed for UI presentation */
export type ARCDisplayGrid = string[][];

/** Puzzle selection filters */
export interface ARCPuzzleFilters {
  /** Filter by dataset */
  dataset?: ARCDatasetType[];
  /** Filter by difficulty */
  difficulty?: OfficerRankRequirement[];
  /** Filter by completion status */
  completed?: boolean;
  /** Search by puzzle ID */
  searchTerm?: string;
  /** Sort order */
  sortBy: 'difficulty' | 'complexity' | 'dataset' | 'id';
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
}

/** Paginated puzzle results */
export interface ARCPuzzleSearchResult {
  /** Matching puzzles for current page */
  puzzles: OfficerTrackPuzzle[];
  /** Total matching puzzles */
  totalCount: number;
  /** Current page number (0-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Applied filters */
  filters: ARCPuzzleFilters;
}

// =============================================================================
// ACHIEVEMENT SYSTEM TYPES
// =============================================================================

/** Officer Track achievements */
export interface OfficerAchievement {
  /** Achievement ID */
  id: string;
  /** Achievement name */
  name: string;
  /** Achievement description */
  description: string;
  /** Achievement icon/emoji */
  icon: string;
  /** When achievement was unlocked */
  unlockedAt: Date;
  /** Achievement rarity */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/** Available achievement types */
export type AchievementType =
  | 'first_puzzle_solve'
  | 'rank_promotion'
  | 'streak_achievement'
  | 'speed_solve'
  | 'complexity_master'
  | 'dataset_completion'
  | 'perfect_accuracy';

// =============================================================================
// SERVICE CONFIGURATION TYPES
// =============================================================================

/** Configuration for ARC data loading */
export interface ARCServiceConfig {
  /** Maximum puzzles to load per batch */
  batchSize: number;
  /** Cache timeout in milliseconds */
  cacheTimeout: number;
  /** Enable difficulty estimation */
  enableDifficultyEstimation: boolean;
  /** Default emoji set for transformation */
  defaultEmojiSet: string;
}

/** ARC data loading options */
export interface ARCLoadOptions {
  /** Which datasets to load */
  datasets: ARCDatasetType[];
  /** Maximum number of puzzles to load */
  limit?: number;
  /** Skip puzzles (for pagination) */
  offset?: number;
  /** Difficulty filter */
  difficulty?: OfficerRankRequirement[];
  /** Force refresh cache */
  forceRefresh?: boolean;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/** ARC service specific errors */
export interface ARCError {
  /** Error code */
  code: 'PUZZLE_NOT_FOUND' | 'INVALID_SOLUTION' | 'LOAD_FAILED' | 'VALIDATION_ERROR';
  /** Error message */
  message: string;
  /** Additional error details */
  details?: any;
  /** Puzzle ID if applicable */
  puzzleId?: string;
}

// =============================================================================
// CONSTANTS AND ENUMS
// =============================================================================

/** Officer Track specific constants */
export const ARC_CONSTANTS = {
  /** Point thresholds for rank progression */
  RANK_THRESHOLDS: {
    [OfficerRank.LIEUTENANT]: 0,
    [OfficerRank.CAPTAIN]: 1000,
    [OfficerRank.MAJOR]: 2500,
    [OfficerRank.COLONEL]: 5000,
    [OfficerRank.GENERAL]: 10000
  },
  /** Base points by difficulty */
  BASE_POINTS: {
    LIEUTENANT: 100,
    CAPTAIN: 200,
    MAJOR: 350,
    COLONEL: 500,
    GENERAL: 750
  },
  /** Maximum puzzles to load per page */
  PUZZLES_PER_PAGE: 24,
  /** Default emoji set for ARC puzzles */
  DEFAULT_EMOJI_SET: 'tech_set1',
  /** PlayFab keys for officer track */
  PLAYFAB_KEYS: {
    OFFICER_POINTS: 'OfficerTrackPoints',
    OFFICER_DATA: 'officer-player-data',
    OFFICER_TASKS: 'officer-tasks.json'
  }
} as const;