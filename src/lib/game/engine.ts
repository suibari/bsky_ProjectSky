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
      buzzHistory: [0],
      nextTurnContentDrawBonus: 0,
      nextTurnAvatarDrawBonus: 0
    };
  }

  startTurn() {
    if (this.state.gameOver || this.state.victory) return;

    this.state.phase = 'draw';
    this.state.player.turnCount++;

    const baseContentDraw = 1;
    const contentBonusDraw = this.state.nextTurnContentDrawBonus;
    const totalContentDraw = baseContentDraw + contentBonusDraw;

    // Reset content bonus
    this.state.nextTurnContentDrawBonus = 0;

    const baseAvatarDraw = 1;
    const avatarBonusDraw = this.state.nextTurnAvatarDrawBonus;
    const totalAvatarDraw = baseAvatarDraw + avatarBonusDraw;

    // Reset avatar bonus
    this.state.nextTurnAvatarDrawBonus = 0;

    const newAvatars = this.state.player.deck.avatars.splice(0, totalAvatarDraw); // Draw 1 + bonus avatars
    const newContents = this.state.player.deck.contents.splice(0, totalContentDraw); // Draw 1 + bonus contents

    this.state.player.hand.avatars.push(...newAvatars);
    this.state.player.hand.contents.push(...newContents);

    // Rule: Game Over if Avatar Deck becomes 0.
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
    this.state.player.field.unshift({
      id: crypto.randomUUID(),
      avatar: card,
      contents: [],
      turnCreated: this.state.player.turnCount
    });
  }

  releaseAvatar(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    const card = this.state.player.hand.avatars[cardIndex];
    if (!card) return;

    // Rule: Cannot release if only 1 avatar remains AND we haven't played an avatar yet.
    // If we already played an avatar, we can release the last card in hand (since we can't play it anyway).
    const alreadyPlayedAvatar = this.state.player.field.some(lane => lane.turnCreated === this.state.player.turnCount);

    if (!alreadyPlayedAvatar && this.state.player.hand.avatars.length <= 1) {
      console.warn("Cannot release, must play an avatar this turn.");
      return;
    }

    // Remove from hand (discard/release)
    this.state.player.hand.avatars.splice(cardIndex, 1);

    // Bonus for next turn (Content Draw +1)
    this.state.nextTurnContentDrawBonus += 1;
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
    lane.contents.push(card);
  }

  releaseContent(cardIndex: number) {
    if (this.state.phase !== 'main') return;

    const card = this.state.player.hand.contents[cardIndex];
    if (!card) return;

    // Remove from hand
    this.state.player.hand.contents.splice(cardIndex, 1);

    // Bonus for next turn (Avatar Draw +1)
    this.state.nextTurnAvatarDrawBonus += 1;
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
      // ONLY score cards played THIS turn
      if (lane.turnCreated !== this.state.player.turnCount) continue;

      const avatar = lane.avatar;
      const avatarPower = avatar.buzzPower;

      // Collect all metadata in this lane for "Metadata Match" check
      // Logic: If "metadata of issued content cards matches"
      // Interpretation: Check intersection of metadata across ALL content cards in lane.
      // Or check if a tag appears > 1 times? "Match" usually implies "Same as another".
      // "matched card each USER becomes double".
      // Let's count occurrence of each tag.
      const tagCounts: Record<string, number> = {};
      lane.contents.forEach(c => {
        c.metadata?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      let contentSum = 1;

      lane.contents.forEach((content) => {
        let cardScore = content.buzzFactor;

        // 1. Metadata Bonus (Double)
        // If this card has a tag that appears more than once in the lane (matches another card)
        const hasMatch = content.metadata?.some(tag => tagCounts[tag] > 1);
        if (hasMatch) {
          cardScore *= 2;
        }

        // 2. Account Match Bonus (Square)
        // If Avatar DID == Content Author DID
        // "USER becomes squared" -> implying the RESULTING score of this card is squared.
        // Prompt: "倍にした後2乗する" (After doubling, square it).
        if (content.authorDid && content.authorDid === avatar.id) {
          // Apply square
          cardScore = Math.pow(cardScore, 2);
        }

        contentSum *= cardScore;
      });

      // Simple multiplication
      const laneTotal = avatarPower * contentSum;
      turnScore += laneTotal;
    }

    // Snowball Rule: Add current Total Score to this turn's gain
    // "2ターン目にトータルスコア100が加算され" -> New Gain = TurnScore + CurrentTotal
    if (this.state.player.buzzPoints > 0) {
      turnScore += this.state.player.buzzPoints;
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

    // 3. Check Victory (100M Users)
    if (this.state.player.buzzPoints >= 100_000_000) {
      this.state.victory = true;
    }

    if (this.state.player.deck.avatars.length === 0) {
      // Rule says Game Over if Deck becomes 0.
      // Usually checked at draw, but keeping eye on it.
    }

    return true;
  }
}
