export const GAME_CONFIG = {
  // Deck Construction
  deck: {
    avatarCount: 50,
    contentCount: 50,
  },

  // Game Loop
  initialHandSize: 5,
  maxTurns: 15,

  // Resources
  pds: {
    initialCapacity: 10,
    maxCapacityIncrement: 1, // How much capacity increases per turn
  },

  // Ranking Thresholds (Buzz Points)
  ranks: {
    SS: 100_000_000,
    S: 50_000_000,
    A: 10_000_000,
    B: 1_000_000,
  },

  // API Limits
  api: {
    likesFetchLimit: 100, // How many likes to fetch per page
    profileChunkSize: 25, // Max actors per getProfiles call
  }
} as const;
