import { GAME_CONFIG } from './config';
import type { GameState, Player, Card, UserCard, PostCard, Lane, FeedRequestType, FeedEffectType, CustomFeed } from './types';
import { getRank } from './ranks';
import { trackTurnStart, trackCardPlay, trackGameEnd } from '$lib/analytics';
import { soundManager } from './sound';

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
      extendedCardsPlayed: 0, // Initialize here
      gameOver: false,
      victory: false,
      buzzHistory: [0],
      archiveMultiplier: 1,
      jetstreamUsedThisTurn: false,
      cardsPlayedThisTurn: 0,
      labelsUsedThisTurn: 0,
      finalPhaseBonus: 0,
      nextCardCostHalf: false,
      pdsCapBonus: 0
    };
  }

  getPhaseMultiplier(turn: number): number {
    let currentTurnCuttoff = 0;
    for (let i = 0; i < GAME_CONFIG.phases.length; i++) {
      const phase = GAME_CONFIG.phases[i];
      currentTurnCuttoff += phase.duration;
      if (turn <= currentTurnCuttoff) {
        // Phase 4 (Last Phase) Dynamic Multiplier
        if (i === GAME_CONFIG.phases.length - 1) {
          return phase.multiplier + (this.state.extendedCardsPlayed * GAME_CONFIG.extendedCardBonus) + this.state.finalPhaseBonus;
        }
        return phase.multiplier;
      }
    }
    // If we exceed configured phases, default to last known (with bonus)
    const distinctPhases = GAME_CONFIG.phases.length;
    if (distinctPhases > 0) {
      const lastPhase = GAME_CONFIG.phases[distinctPhases - 1];
      return lastPhase.multiplier + (this.state.extendedCardsPlayed * GAME_CONFIG.extendedCardBonus) + this.state.finalPhaseBonus;
    }
    return 1;
  }

  getRandomCustomFeed(): CustomFeed {
    const requests: FeedRequestType[] = [
      'play_3_cards', 'jetstream', 'label_1_time',
      'field_3_users', 'play_extended', 'reach_0_pds'
    ];
    const effects: FeedEffectType[] = [
      'draw_1',
      'pds_cap_plus_1',
      'field_power_plus_500',
      'final_multiplier_plus_20',
      'next_cost_half',
      'clear_moderation'
    ];

    const request = requests[Math.floor(Math.random() * requests.length)];
    const effect = effects[Math.floor(Math.random() * effects.length)];

    return {
      request,
      effect,
      isCompleted: false,
      progress: 0
    };
  }

  checkFeedRequests(triggerAction: string, context?: any) {
    this.state.player.field.forEach(lane => {
      const card = lane.card;
      if (!card.customFeed || card.customFeed.isCompleted) return;

      let completed = false;
      const req = card.customFeed.request;

      switch (req) {
        case 'play_3_cards':
          if (triggerAction === 'playCard' && this.state.cardsPlayedThisTurn >= 3) {
            completed = true;
          }
          break;
        case 'jetstream':
          if (triggerAction === 'jetstream') {
            completed = true;
          }
          break;
        case 'label_1_time':
          if (triggerAction === 'label' && this.state.labelsUsedThisTurn >= 1) {
            completed = true;
          }
          break;
        case 'field_3_users':
          if (triggerAction === 'userAdded' && context?.uuid && card.uuid !== context.uuid) {
            // Increment progress for existing cards when a NEW user is added
            card.customFeed.progress = (card.customFeed.progress || 0) + 1;
            if (card.customFeed.progress >= 3) {
              completed = true;
            }
          }
          break;
        case 'play_extended':
          if (triggerAction === 'playCard' && context?.origin === 'extended' && context?.uuid && card.uuid !== context.uuid) {
            completed = true;
          }
          break;
        case 'reach_0_pds':
          if (triggerAction === 'pds' && this.state.player.pdsCurrent === 0) {
            completed = true;
          }
          break;
      }

      if (completed) {
        card.customFeed.isCompleted = true;
        card.customFeed.completedTurn = this.state.turnCount;
        this.applyFeedEffect(card.customFeed.effect);
      }
    });
  }

  applyFeedEffect(effect: FeedEffectType) {
    switch (effect) {
      case 'draw_1':
        if (this.state.player.deck.length > 0) {
          const drawn = this.state.player.deck.splice(0, 1);
          this.state.player.hand.push(drawn[0]);
          soundManager.play('draw', 1, GAME_CONFIG.soundDelays.draw);
        }
        break;
      case 'pds_cap_plus_1':
        this.state.pdsCapBonus += 1;
        this.state.player.pdsCapacity += 1;
        break;
      case 'field_power_plus_500':
        this.state.player.field.forEach(l => {
          l.card.power += 500;
        });
        break;
      case 'final_multiplier_plus_20':
        this.state.finalPhaseBonus += 20;
        // Recalculate multiplier immediately if we are in final phase?
        this.state.phaseMultiplier = this.getPhaseMultiplier(this.state.turnCount);
        break;
      case 'next_cost_half':
        this.state.nextCardCostHalf = true;
        break;
      case 'clear_moderation':
        this.state.player.hand.forEach(c => {
          c.power = c.originalPower;
          c.lastModeratedTurn = undefined;
        });
        break;
    }
  }

  startTurn() {
    if (this.state.gameOver) return;

    this.state.turnCount++;
    trackTurnStart(this.state.turnCount);
    soundManager.play('turnchange', 1, GAME_CONFIG.soundDelays.turnchange);

    // Reset Turn Stats
    this.state.cardsPlayedThisTurn = 0;
    this.state.labelsUsedThisTurn = 0;
    // Jetstream reset is done at end of startTurn or here? Done below.

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
    this.state.player.pdsCapacity = GAME_CONFIG.pds.initialCapacity + (this.state.turnCount - 1) * GAME_CONFIG.pds.maxCapacityIncrement + this.state.pdsCapBonus;
    this.state.player.pdsCurrent = this.state.player.pdsCapacity;

    // Draw Phase: Draw until hand has 5 cards
    // "手札が5枚になるようデッキからドローする"
    const cardsNeeded = GAME_CONFIG.initialHandSize - this.state.player.hand.length;
    if (cardsNeeded > 0) {
      const drawn = this.state.player.deck.splice(0, cardsNeeded);
      this.state.player.hand.push(...drawn);

      soundManager.play('draw', drawn.length, GAME_CONFIG.soundDelays.draw);

      // Deck out check?
      if (this.state.player.deck.length === 0 && drawn.length < cardsNeeded) {
        // Handle deck out
      }
    }

    this.state.phase = 'main';
    this.state.jetstreamUsedThisTurn = false;

    // Check 'field_3_users' at start of turn? It might trigger if we already have 3 users.
    // But usually triggered by ACTION.
    // Just in case, check existing specific conditions?
    // "End turn 0 PDS" -> checked at end.
    // "Play 3 cards" -> checked on play.
    // "3 Users on field" -> checked on user play.

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

    soundManager.play('label', 1, GAME_CONFIG.soundDelays.label);

    // Custom Feed Trigger
    this.state.labelsUsedThisTurn++;
    this.checkFeedRequests('label');
    this.checkFeedRequests('pds'); // PDS consumed
  }

  playCard(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    const card = this.state.player.hand[cardIndex];
    if (!card) return;

    // Calculate effective cost (Halved?)
    let effectiveCost = card.cost;
    if (this.state.nextCardCostHalf) {
      effectiveCost = Math.floor(effectiveCost / 2);
    }

    // Check Cost
    if (this.state.player.pdsCurrent < effectiveCost) {
      console.warn("Not enough PDS");
      return;
    }

    // Pay Cost
    this.state.player.pdsCurrent -= effectiveCost;
    if (this.state.nextCardCostHalf) {
      this.state.nextCardCostHalf = false; // Consumed
    }

    if (effectiveCost > 0) {
      this.checkFeedRequests('pds'); // PDS consumed
    }

    trackCardPlay(card);

    if (card.origin === 'extended') {
      this.state.extendedCardsPlayed++;
      // Phase Multiplier is now fixed at start of turn (per user request)
    }

    // Remove from hand
    this.state.player.hand.splice(cardIndex, 1);

    // Custom Feed Trigger (Part 1: Count)
    this.state.cardsPlayedThisTurn++;

    if (card.type === 'user') {
      // User Card: Place on Field
      // Apply Archive Multiplier permanently to this card instance
      card.power *= this.state.archiveMultiplier;

      // Assign Custom Feed if User Card!
      card.customFeed = this.getRandomCustomFeed();

      this.state.player.field.unshift({
        id: crypto.randomUUID(),
        card: card as UserCard,
        turnCreated: this.state.turnCount
      });

      // Check 'field_3_users'
      this.checkFeedRequests('userAdded', { uuid: card.uuid });
      this.checkFeedRequests('playCard', { origin: card.origin, uuid: card.uuid }); // Passed origin for 'play_extended' check

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

      // Check 'play_extended' (for Post cards too?)
      // User requests usually on User Cards, but user card request can be "Play Extended".
      // Yes.
      this.checkFeedRequests('playCard', { origin: card.origin, uuid: card.uuid });
    }

    this.state.archiveMultiplier = 1;
  }

  pdsBoost() {
    if (this.state.phase !== 'main') return;

    // Check Usage Limit (Once per turn)
    if (this.state.jetstreamUsedThisTurn) {
      console.warn("Jetstream already used this turn");
      return;
    }

    // Cost: 4 PDS
    const cost = GAME_CONFIG.pds.drawCost;
    if (this.state.player.pdsCurrent < cost) {
      console.warn("Not enough PDS for Reload");
      return;
    }

    // Pay Cost
    this.state.player.pdsCurrent -= cost;

    const handSize = this.state.player.hand.length;

    // Discard all cards
    // Return all cards to deck (Resetting power)
    this.state.player.hand.forEach(card => {
      card.power = card.originalPower;
    });
    this.state.player.deck.push(...this.state.player.hand);
    this.state.player.hand = [];

    // Shuffle deck
    this.state.player.deck.sort(() => Math.random() - 0.5);

    // Draw same amount
    const drawCount = handSize;
    if (drawCount > 0 && this.state.player.deck.length > 0) {
      const drawn = this.state.player.deck.splice(0, drawCount);
      this.state.player.hand.push(...drawn);

      soundManager.play('draw', drawn.length, GAME_CONFIG.soundDelays.draw);
    }

    // Mark used
    this.state.jetstreamUsedThisTurn = true;

    // Custom Feed Trigger
    this.checkFeedRequests('jetstream');
    if (cost > 0) {
      this.checkFeedRequests('pds'); // PDS consumed
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
      soundManager.play('result', 1, GAME_CONFIG.soundDelays.result);
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

    trackGameEnd(this.state.player.buzzPoints, this.state.finalRank);

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
