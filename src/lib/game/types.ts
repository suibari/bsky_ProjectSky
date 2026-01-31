export interface Player {
  did: string;
  handle: string;
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
  cost: number;  // PDS cost

  // Display
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  text?: string;
  imageUrl?: string;
}

export interface UserCard extends BaseCard {
  type: 'user';
  description?: string;
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

  mvpCards?: MvpCards;

  gameOver: boolean;
  victory: boolean; // Not used strictly as boolean anymore, rank determines result
  finalRank?: 'SS' | 'S' | 'A' | 'B' | 'C';

  buzzHistory: number[];
}
