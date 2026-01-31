export const GAME_CONFIG = {
  // Deck Construction
  deck: {
    avatarCount: 70,
    contentCount: 70,
  },

  // Game Loop
  initialHandSize: 5,
  maxTurns: 15,

  // Resources
  pds: {
    initialCapacity: 10,
    maxCapacityIncrement: 1, // How much capacity increases per turn
    drawCost: 5, // Cost to draw an extra card
    archiveCost: 2, // Cost to archive a card
  },

  archiveMultiplier: 2, // Multiplier when archiving a card

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
