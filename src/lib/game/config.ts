export const GAME_CONFIG = {
  version: "0.0.1",

  // Deck Construction
  deck: {
    avatarCount: 20,
    contentCount: 20,
  },

  // Game Loop
  initialHandSize: 5,
  maxTurns: 10,

  phases: [
    { duration: 3, multiplier: 1 },
    { duration: 3, multiplier: 20 },
    { duration: 3, multiplier: 300 },
    { duration: 1, multiplier: 300 },
  ],

  // Resources
  pds: {
    initialCapacity: 10,
    maxCapacityIncrement: 1, // How much capacity increases per turn
    drawCost: 4, // Cost to Reload (discard hand & redraw)
    archiveCost: 2, // Cost to archive a card
  },

  archiveMultiplier: 2, // Multiplier when archiving a card
  relayPowerBonus: 500, // Bonus power for user cards when a post card is used
  extendedCardBonus: 10, // Bonus to final turn multiplier per extended card played

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
  },

  soundDelays: {
    draw: 0,
    label: 0,
    postcard: 0,
    rankup: 0,
    result: 0,
    score: 1000,
    turnchange: 0,
    usercard: 0,
  },
} as const;
