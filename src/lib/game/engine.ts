import { GAME_CONFIG } from './config';
import type { GameState, Player, Card, UserCard, PostCard, Lane } from './types';

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
        cost
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
        cost,
        originalLikes: likes
      };
      cards.push(card);
    });

    return cards;
  }

  static createInitialState(did: string, handle: string, avatarDeck: any[], contentDeck: any[]): GameState {
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
    if (turn >= 11) return 100;
    if (turn >= 6) return 10;
    return 1;
  }

  startTurn() {
    if (this.state.gameOver) return;

    this.state.turnCount++;
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

    // Remove from hand
    this.state.player.hand.splice(cardIndex, 1);

    // Move to Discard
    this.state.player.discard.push(card);

    // Apply Multiplier
    // "Power is *2. Stacking possible."
    this.state.archiveMultiplier *= 2;
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
      this.state.player.buzzPoints += scoreGain;

      // Move to Discard
      this.state.player.discard.push(card);
    }

    this.state.archiveMultiplier = 1;
  }

  pdsBoost() {
    if (this.state.phase !== 'main') return;

    // Cost: 3 PDS
    const cost = 3;
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
    const users = this.state.player.buzzPoints;
    if (users >= GAME_CONFIG.ranks.SS) {
      this.state.finalRank = 'SS';
      this.state.victory = true; // "Clear"
    } else if (users >= GAME_CONFIG.ranks.S) {
      this.state.finalRank = 'S';
    } else if (users >= GAME_CONFIG.ranks.A) {
      this.state.finalRank = 'A';
    } else if (users >= GAME_CONFIG.ranks.B) {
      this.state.finalRank = 'B';
    } else {
      this.state.finalRank = 'C';
    }
  }
}
