import type { GameState, Player, AvatarCard, ContentCard, Lane } from './types';

export class GameEngine {
  state: GameState;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  static createInitialState(did: string, handle: string, avatarDeck: AvatarCard[], contentDeck: ContentCard[]): GameState {
    // Shuffle decks and assign UUIDs to ensure uniqueness
    const assignUUID = (c: any) => ({ ...c, uuid: crypto.randomUUID() });

    const shuffledAvatars = [...avatarDeck].map(assignUUID).sort(() => Math.random() - 0.5);
    const shuffledContents = [...contentDeck].map(assignUUID).sort(() => Math.random() - 0.5);

    // Draw initial hand (2 avatars, 2 contents)
    // Rule: Start with 2 and 2.
    const handAvatars = shuffledAvatars.splice(0, 2);
    const handContents = shuffledContents.splice(0, 2);

    return {
      player: {
        did,
        handle,
        deck: {
          avatars: shuffledAvatars,
          contents: shuffledContents
        },
        hand: {
          avatars: handAvatars,
          contents: handContents
        },
        field: [],
        buzzPoints: 0,
        turnCount: 0
      },
      phase: 'draw',
      gameOver: false,
      victory: false,
      buzzHistory: [0]
    };
  }

  startTurn() {
    if (this.state.gameOver || this.state.victory) return;

    this.state.phase = 'draw';
    this.state.player.turnCount++;

    const newAvatars = this.state.player.deck.avatars.splice(0, 1); // Draw 1 avatar
    const newContents = this.state.player.deck.contents.splice(0, 1); // Draw 1 contents

    this.state.player.hand.avatars.push(...newAvatars);
    this.state.player.hand.contents.push(...newContents);

    // Rule: Game Over if Avatar Deck becomes 0.
    // If we tried to draw and deck is now empty?
    // Or if we couldn't draw full amount?
    // "アバターデッキが0枚になったらゲームオーバー"
    // Let's assume strict empty check.
    if (this.state.player.deck.avatars.length === 0 && newAvatars.length === 0) {
      this.state.gameOver = true;
    }

    this.state.phase = 'main';
  }

  playAvatar(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    // Rule: One Avatar per turn
    const alreadyPlayedAvatar = this.state.player.field.some(lane => lane.turnCreated === this.state.player.turnCount);
    if (alreadyPlayedAvatar) {
      console.warn("Already played an Avatar this turn");
      return;
    }

    const card = this.state.player.hand.avatars[cardIndex];
    if (!card) return;

    // Remove from hand
    this.state.player.hand.avatars.splice(cardIndex, 1);

    // Add to field as new Lane
    // Add to TOP (beginning) of field to simulate timeline? Or bottom?
    // Usually timeline adds to top.
    this.state.player.field.unshift({
      id: crypto.randomUUID(),
      avatar: card,
      contents: [],
      turnCreated: this.state.player.turnCount
    });
  }

  playContent(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    // Target the LATEST lane (unshifted to 0)
    const lane = this.state.player.field[0];
    if (!lane) {
      console.warn("No avatar on field");
      return;
    }

    // Rule: Cannot set content to past field cards.
    // Meaning, safe to assume only the avatar played THIS TURN is valid.
    if (lane.turnCreated !== this.state.player.turnCount) {
      console.warn("Cannot play content on past avatars");
      return;
    }

    // Rule: Level System (Content Limit)
    // 1-3: 1, 4-6: 2, 7+: 3
    let limit = 1;
    if (this.state.player.turnCount >= 7) limit = 3;
    else if (this.state.player.turnCount >= 4) limit = 2;

    if (lane.contents.length >= limit) {
      console.warn("Lane full (Level limit)");
      return;
    }

    const card = this.state.player.hand.contents[cardIndex];
    if (!card) return;

    // Remove from hand
    this.state.player.hand.contents.splice(cardIndex, 1);

    // Add to lane
    // Note: The combo effect (2nd^2, 3rd^3) is calculated during scoring based on position.
    lane.contents.push(card);
  }

  returnAvatar(laneIndex: number) {
    if (this.state.phase !== 'main') return;
    const lane = this.state.player.field[laneIndex];
    if (!lane) return;

    // Rule: Can only return cards played THIS turn
    if (lane.turnCreated !== this.state.player.turnCount) {
      console.warn("Cannot return past cards");
      return;
    }

    // Return contents to hand
    this.state.player.hand.contents.push(...lane.contents);

    // Return avatar to hand
    this.state.player.hand.avatars.push(lane.avatar);

    // Remove lane
    this.state.player.field.splice(laneIndex, 1);
  }

  returnContent(laneIndex: number, contentIndex: number) {
    if (this.state.phase !== 'main') return;
    const lane = this.state.player.field[laneIndex];
    if (!lane) return;

    // Rule: Check recursion/turn
    if (lane.turnCreated !== this.state.player.turnCount) {
      console.warn("Cannot return past cards");
      return;
    }

    const content = lane.contents[contentIndex];
    if (!content) return;

    // Return to hand
    this.state.player.hand.contents.push(content);

    // Remove from lane
    lane.contents.splice(contentIndex, 1);
  }

  endTurn(): boolean {
    if (this.state.phase !== 'main') return false;

    // Rule: Must play Avatar every turn
    const latestLane = this.state.player.field[0];
    if (!latestLane || latestLane.turnCreated !== this.state.player.turnCount) {
      console.warn("Must play an Avatar this turn");
      return false;
    }

    this.state.phase = 'end';

    // 1. Calculate Score
    let turnScore = 0;

    for (const lane of this.state.player.field) {
      // Rule: Only score cards played THIS turn?
      // "Timeline" is history. 
      // User feedback: "Should be +1 BP" when playing 1-power card after previous massive turns.
      // This implies past turns DO NOT score again.
      if (lane.turnCreated !== this.state.player.turnCount) continue;

      const avatarPower = lane.avatar.buzzPower;
      let contentSum = 1;
      lane.contents.forEach((content, index) => {
        const exponent = index + 1; // 1, 2, 3
        contentSum *= Math.pow(content.buzzFactor, exponent);
      });

      // Validated: 31 * 4 * 25 * 2197 = 6,810,700
      const laneTotal = avatarPower * contentSum;
      turnScore += laneTotal;
    }

    this.state.player.buzzPoints += turnScore;
    this.state.buzzHistory.push(this.state.player.buzzPoints);

    // 2. Apply Decay (Content) and Aging (Avatar)
    // Rule: "コンテンツカードのバズ係数は、引いた次のターンからターンごとに80%になる"
    // Apply to HAND contents.
    for (const content of this.state.player.hand.contents) {
      content.buzzFactor = Math.floor(content.buzzFactor * 0.8);
      if (content.buzzFactor < 1) content.buzzFactor = 1; // Minimum 1?
    }

    // Rule: "アバターカードのバズパワーは、引いた次のターンからターンごとに倍になる"
    // Apply to HAND avatars.
    for (const avatar of this.state.player.hand.avatars) {
      avatar.buzzPower = Math.ceil(avatar.buzzPower * 2);
    }

    // 3. Check Victory
    if (this.state.player.buzzPoints >= 10_000_000_000) {
      this.state.victory = true;
    }

    if (this.state.player.deck.avatars.length === 0) {
      // Rule says Game Over if Deck becomes 0.
      // Usually checked at draw, but keeping eye on it.
    }

    return true;
  }
}
