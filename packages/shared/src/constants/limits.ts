export const WORLD_LIMITS = {
  minX: -50,
  maxX: 50,
  minY: -64,
  maxY: 100,
  minZ: -50,
  maxZ: 50,
  originX: 0,
  originY: 4,
  originZ: 0,
  width: 100,
  depth: 100,
} as const;

export const BUILD_BATCH_SIZE = 10;
export const BUILD_BATCH_DELAY_MS = 100;
export const FSM_TICK_MS = 500;
export const DEFAULT_SESSION_DURATION_MINUTES = 6;
export const DEFAULT_QUESTION_COUNT = 4;
export const MAX_QUESTION_COUNT = 5;
export const MIN_QUESTION_COUNT = 3;
