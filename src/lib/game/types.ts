export interface Player {
  did: string;
  handle: string;
  avatarUrl?: string;
  deck: {
    avatars: AvatarCard[];
    contents: ContentCard[];
  };
  hand: {
    avatars: AvatarCard[];
    contents: ContentCard[];
  };
  field: Lane[];
  buzzPoints: number;
  turnCount: number;
}

export interface Lane {
  id: string; // unique id for keying
  avatar: AvatarCard;
  contents: ContentCard[];
  turnCreated: number;
}

export interface AvatarCard {
  id: string; // did
  type: 'avatar';
  handle: string;
  displayName?: string; // Add displayName
  avatarUrl?: string;
  buzzPower: number; // likes per day + 1
  description?: string;
  // Runtime props
  uuid?: string; // unique id for hand/field distinction if multiple same cards
}

export interface ContentCard {
  id: string; // uri
  type: 'content';
  authorHandle: string;
  authorDisplayName?: string; // Add authorDisplayName
  text: string;
  imageUrl?: string;
  buzzFactor: number; // likes + 1
  originalBuzzFactor: number; // to track decay base if needed, or just mutate buzzFactor
  // Runtime props
  uuid?: string;
  // New props
  authorDid?: string;
  metadata?: string[]; // 'quote' | 'mention' | 'image' | 'link'
}

export interface GameState {
  player: Player;
  phase: 'draw' | 'main' | 'end';
  gameOver: boolean;
  victory: boolean;
  buzzHistory: number[]; // For graph/tracking
  nextTurnContentDrawBonus: number; // For Release system
  nextTurnAvatarDrawBonus: number; // For Release system (Content -> Avatar draw)
}
