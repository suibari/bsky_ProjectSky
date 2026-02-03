import { GAME_CONFIG } from './config';
import type { GameState, Player, Card, UserCard, PostCard, Lane } from './types';
import { getRank } from './ranks';

export class GameEngine {
  state: GameState;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  // Adapter to convert raw deck inputs to new Card format
  static convertCards(
    did: string,
    rawAvatars: any[],
    rawContents: any[]
  ): Card[] {
    const cards: Card[] = [];

    // Process Avatar -> User Cards
    rawAvatars.forEach(a => {
      // Use existing power/cost if available (from api.ts), otherwise fallback
      const power = a.power ?? 1;
      const cost = a.cost ?? Math.min(8, Math.floor(2 + power / 10));

      const card: UserCard = {
        id: a.id,
        uuid: crypto.randomUUID(),
        type: 'user',
        handle: a.handle,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
        description: a.description,
        power,
        originalPower: power,
        cost,
        origin: a.origin
      };
      cards.push(card);
    });

    // Process Content -> Post Cards
    rawContents.forEach(c => {
      const likes = c.originalLikes ?? c.buzzFactor ?? 0;

      const power = c.power ?? Math.floor((likes * 1000) / ((c.text?.length || 0) + 10));
      const cost = c.cost ?? Math.floor(1 + ((c.text?.length || 0) / 40));

      const card: PostCard = {
        id: c.id,
        uuid: crypto.randomUUID(),
        type: 'post',
        handle: c.handle || c.authorHandle,
        displayName: c.displayName || c.authorDisplayName,
        avatarUrl: undefined, // Content cards might not have avatar url readily available in old type unless passed
        text: c.text,
        imageUrl: c.imageUrl,
        power,
        originalPower: power,
        cost,
        originalLikes: likes,
        origin: c.origin
      };
      cards.push(card);
    });

    return cards;
  }

  static createInitialState(did: string, handle: string, displayName: string, avatarDeck: any[], contentDeck: any[]): GameState {
    const allCards = GameEngine.convertCards(did, avatarDeck, contentDeck);

    // Ensure we have enough cards or truncate? 
    // Prompt says "Deck is composed of 30 User and 30 Post cards".
    // We will shuffle and take what we have, or take first 30 of each if provided more.

    const userCards = allCards.filter(c => c.type === 'user');
    const postCards = allCards.filter(c => c.type === 'post');

    // Shuffle independent pools first
    userCards.sort(() => Math.random() - 0.5);
    postCards.sort(() => Math.random() - 0.5);

    // Take 30 each (or all if less)
    const deckUsers = userCards.slice(0, GAME_CONFIG.deck.avatarCount);
    const deckPosts = postCards.slice(0, GAME_CONFIG.deck.contentCount);

    // Merge and shuffle final deck
    const deck = [...deckUsers, ...deckPosts].sort(() => Math.random() - 0.5);

    // Draw initial hand: 0 cards (User starts manually)
    const hand: any[] = [];

    return {
      player: {
        did,
        handle,
        displayName,
        deck,
        hand,
        discard: [],
        field: [],
        pdsCapacity: GAME_CONFIG.pds.initialCapacity,
        pdsCurrent: GAME_CONFIG.pds.initialCapacity,
        buzzPoints: 0
      },
      turnCount: 0, // Will be 1 after startTurn
      phase: 'draw',
      phaseMultiplier: 1,
      gameOver: false,
      victory: false,
      buzzHistory: [0],
      archiveMultiplier: 1
    };
  }

  getPhaseMultiplier(turn: number): number {
    let currentTurnCuttoff = 0;
    for (const phase of GAME_CONFIG.phases) {
      currentTurnCuttoff += phase.duration;
      if (turn <= currentTurnCuttoff) {
        return phase.multiplier;
      }
    }
    // If we exceed configured phases, default to last known or 1
    return GAME_CONFIG.phases[GAME_CONFIG.phases.length - 1]?.multiplier ?? 1;
  }

  startTurn() {
    if (this.state.gameOver) return;

    this.state.turnCount++;

    // Apply "Moderation" Rule
    // Cards held in hand have their power halved (carry-over penalty)
    for (const card of this.state.player.hand) {
      if (card.power > 0) {
        card.power = Math.floor(card.power / 2);
        card.lastModeratedTurn = this.state.turnCount;
      }
    }

    this.state.phase = 'draw';
    this.state.phaseMultiplier = this.getPhaseMultiplier(this.state.turnCount);

    // PDS Recovery & Growth
    this.state.player.pdsCapacity = GAME_CONFIG.pds.initialCapacity + (this.state.turnCount - 1) * GAME_CONFIG.pds.maxCapacityIncrement;
    this.state.player.pdsCurrent = this.state.player.pdsCapacity;

    // Draw Phase: Draw until hand has 5 cards
    // "手札が5枚になるようデッキからドローする"
    const cardsNeeded = GAME_CONFIG.initialHandSize - this.state.player.hand.length;
    if (cardsNeeded > 0) {
      const drawn = this.state.player.deck.splice(0, cardsNeeded);
      this.state.player.hand.push(...drawn);

      // Deck out check?
      if (this.state.player.deck.length === 0 && drawn.length < cardsNeeded) {
        // Handle deck out - maybe nothing happens, just play with what you have
      }
    }

    this.state.phase = 'main';
  }

  archiveCard(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    const card = this.state.player.hand[cardIndex];
    if (!card) return;

    // Check Cost
    const cost = GAME_CONFIG.pds.archiveCost;
    if (this.state.player.pdsCurrent < cost) {
      console.warn("Not enough PDS to archive");
      return;
    }

    // Pay Cost
    this.state.player.pdsCurrent -= cost;

    // Remove from hand
    this.state.player.hand.splice(cardIndex, 1);

    // Move to Discard
    this.state.player.discard.push(card);

    // Apply Multiplier
    // "Power is *2. Stacking possible."
    this.state.archiveMultiplier *= GAME_CONFIG.archiveMultiplier;
  }

  playCard(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    const card = this.state.player.hand[cardIndex];
    if (!card) return;

    // Check Cost
    if (this.state.player.pdsCurrent < card.cost) {
      console.warn("Not enough PDS");
      return;
    }

    // Pay Cost
    this.state.player.pdsCurrent -= card.cost;

    // Remove from hand
    this.state.player.hand.splice(cardIndex, 1);

    if (card.type === 'user') {
      // User Card: Place on Field
      // Apply Archive Multiplier permanently to this card instance
      card.power *= this.state.archiveMultiplier;

      this.state.player.field.unshift({
        id: crypto.randomUUID(),
        card: card as UserCard,
        turnCreated: this.state.turnCount
      });
    } else if (card.type === 'post') {
      // Post Card: Instant Score
      // Power * Phase Multiplier * Archive Multiplier
      const scoreGain = card.power * this.state.phaseMultiplier * this.state.archiveMultiplier;
      card.playedScore = scoreGain;
      this.state.player.buzzPoints += scoreGain;

      // Relay Effect: Boost all User Cards on Field
      // "ポストカードを使うと、その時点で場に出ているすべてのユーザーカードのパワーを+100する"
      const relayBonus = GAME_CONFIG.relayPowerBonus;
      if (this.state.player.field.length > 0) {
        const timestamp = Date.now();
        this.state.player.field.forEach(lane => {
          lane.card.power += relayBonus;
          lane.card.lastHydratedTrigger = timestamp;
        });
      }

      // Move to Discard
      this.state.player.discard.push(card);
    }

    this.state.archiveMultiplier = 1;
  }

  pdsBoost() {
    if (this.state.phase !== 'main') return;

    // Cost: 3 PDS
    const cost = GAME_CONFIG.pds.drawCost;
    if (this.state.player.pdsCurrent < cost) {
      console.warn("Not enough PDS for Boost");
      return;
    }

    // Check deck
    if (this.state.player.deck.length === 0) {
      console.warn("Deck empty");
      return;
    }

    // Pay Cost
    this.state.player.pdsCurrent -= cost;

    // Draw 1 card
    const card = this.state.player.deck.shift();
    if (card) {
      this.state.player.hand.push(card);
    }
  }

  endTurn() {
    if (this.state.phase !== 'main') return;

    this.state.phase = 'end';

    // End Phase: Field User Cards generate score
    // Sum of Power * Phase Multiplier
    let turnFieldScore = 0;
    for (const lane of this.state.player.field) {
      turnFieldScore += lane.card.power;
    }
    const totalGain = turnFieldScore * this.state.phaseMultiplier;
    this.state.player.buzzPoints += totalGain;

    this.state.buzzHistory.push(this.state.player.buzzPoints);

    // Check Game End Condition (Turn 15)
    if (this.state.turnCount >= GAME_CONFIG.maxTurns) {
      this.finishGame();
    }

    // Reset Archive Multiplier at end of turn (do not carry over)
    this.state.archiveMultiplier = 1;
  }

  finishGame() {
    this.state.gameOver = true;

    // Calculate Rank
    this.state.finalRank = getRank(this.state.player.buzzPoints);
    if (this.state.finalRank === 'SS') {
      this.state.victory = true; // "Clear"
    }

    // Determine MVP Cards
    // User MVP: Highest Power on Field (includes buffs if we had any, currently power is static but archive bonus is applied on play/permanent? Logic check:
    // Archive multiplier applies to power permanently?
    // line 182: card.power *= this.state.archiveMultiplier; -> YES.
    // So looking at field cards is correct for "Strongest User".
    let mvpUser: UserCard | null = null;
    if (this.state.player.field.length > 0) {
      mvpUser = this.state.player.field.reduce((prev, current) =>
        (current.card.power > prev.card.power) ? current : prev
        , this.state.player.field[0]).card;

      // Calculate effective end-game score for display
      if (mvpUser) {
        // Clone to avoid mutating original card state excessively if that matters, 
        // but here we just want to attach the property for the result screen.
        mvpUser.playedScore = mvpUser.power * this.state.phaseMultiplier;
      }
    }

    // Post MVP: Highest Played Score in Discard
    let mvpPost: PostCard | null = null;
    const playedPostCards = this.state.player.discard.filter(c => c.type === 'post' && c.playedScore !== undefined) as PostCard[];
    if (playedPostCards.length > 0) {
      mvpPost = playedPostCards.reduce((prev, current) =>
        ((current.playedScore || 0) > (prev.playedScore || 0)) ? current : prev
        , playedPostCards[0]);
    }

    this.state.mvpCards = {
      user: mvpUser,
      post: mvpPost
    };
  }
}
