// Tunable numbers shared across the sampler and engine modules.
// Adjusting these is the fastest way to change how the effect feels.

export const TIER_GRID = 3;
export const TIER_COUNT = TIER_GRID * TIER_GRID; // coarse-to-fine buckets per shape

export const MAX_PARTICLES = 2600;     // sampling backs off density to stay under this
export const CAPTURE_R = 85;           // px radius a sweep captures particles within
export const NUDGE_R = 30;             // px radius uncaptured dust gets pushed from the cursor
export const PRIORITY_JITTER = 0.55;   // how much adjacent letters blend in the reveal order
export const PREVIEW_COUNT = 70;       // how many upcoming queue slots get a faint preview hint
