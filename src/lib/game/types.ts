export interface Player {
  did: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  field: Lane[]; // User Cards on field

  // Resource
  pdsCapacity: number;
  pdsCurrent: number;

  // Score
  buzzPoints: number; // Users
}

export interface Lane {
  id: string;
  card: UserCard; // Only User Cards stay on field
  turnCreated: number;
}

export type CardType = 'user' | 'post';

export interface BaseCard {
  id: string;
  type: CardType;
  uuid: string; // Runtime unique ID

  // Stats
  power: number; // Users gain (User: per turn, Post: instant)
  originalPower: number; // Base power at creation (unmodified by game buffs/nerfs)
  cost: number;  // PDS cost

  // Display
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  text?: string;
  imageUrl?: string;
  origin?: 'direct' | 'extended'; // 'direct' = My Likes (A), 'extended' = Extended Likes (B)
  lastModeratedTurn?: number;
  lastHydratedTrigger?: number; // Timestamp/ID to trigger Hydrated animation
}

export type FeedRequestType =
  | 'play_3_cards'
  | 'jetstream'
  | 'label_1_time'
  | 'field_3_users'
  | 'play_extended'
  | 'reach_0_pds'
  | 'post_with_5_users';

export type FeedEffectType =
  | 'draw_1'
  | 'pds_cap_plus_1'
  | 'field_power_plus_500'
  | 'final_multiplier_plus_10'
  | 'next_cost_half'
  | 'clear_moderation';

export interface CustomFeed {
  request: FeedRequestType;
  effect: FeedEffectType;
  isCompleted: boolean;
  completedTurn?: number;
  progress: number;
}

export interface UserCard extends BaseCard {
  type: 'user';
  description?: string;
  playedScore?: number; // Score per turn at end of game (Power * Phase Multiplier)
  customFeed?: CustomFeed;
}

export interface PostCard extends BaseCard {
  type: 'post';
  originalLikes: number; // For reference if needed
  playedScore?: number; // Score generated when played (for MVP calculation)
}

export type Card = UserCard | PostCard;

export type MvpCards = {
  user: UserCard | null;
  post: PostCard | null;
};

export interface GameState {
  player: Player;
  turnCount: number; // 1-15
  phase: 'draw' | 'main' | 'end';
  phaseMultiplier: number; // 1, 10, 100
  archiveMultiplier: number; // Multiplier from archived cards
  extendedCardsPlayed: number; // For Phase 4 multiplier calc

  mvpCards?: MvpCards;

  gameOver: boolean;
  victory: boolean; // Not used strictly as boolean anymore, rank determines result
  finalRank?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

  buzzHistory: number[];

  // Turn State
  jetstreamUsedThisTurn?: boolean;
  cardsPlayedThisTurn: number;
  labelsUsedThisTurn: number;

  // Custom Feed Bonuses
  finalPhaseBonus: number;
  nextCardCostHalf: boolean;
  pdsCapBonus: number;
}
