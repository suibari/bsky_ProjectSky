export const GAME_CONFIG = {
  // Deck Construction
  deck: {
    avatarCount: 30,
    contentCount: 30,
  },

  // Game Loop
  initialHandSize: 5,
  maxTurns: 10,

  phases: [
    { duration: 3, multiplier: 1 },
    { duration: 3, multiplier: 20 },
    { duration: 4, multiplier: 300 },
  ],

  // Resources
  pds: {
    initialCapacity: 10,
    maxCapacityIncrement: 1, // How much capacity increases per turn
    drawCost: 5, // Cost to draw an extra card
    archiveCost: 2, // Cost to archive a card
  },

  archiveMultiplier: 2, // Multiplier when archiving a card
  relayPowerBonus: 500, // Bonus power for user cards when a post card is used

  // Ranking Thresholds (Buzz Points)
  ranks: {
    SS: 100_000_000,
    S: 80_000_000,
    A: 40_000_000,
    B: 20_000_000,
    C: 10_000_000,
    D: 1_000_000,
    E: 100_000,
    F: 1_000,
    G: 0,
  },

  // API Limits
  api: {
    likesFetchLimit: 100, // How many likes to fetch per page
    profileChunkSize: 25, // Max actors per getProfiles call
  }
} as const;
