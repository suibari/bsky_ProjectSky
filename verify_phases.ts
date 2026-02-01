import { GAME_CONFIG } from './src/lib/game/config';
import { GameEngine } from './src/lib/game/engine';

// Mock initial state
const mockState = GameEngine.createInitialState('did:example:123', 'handle', 'Display Name', [], []);
const engine = new GameEngine(mockState);

console.log("Turn | Multiplier | Expected");
console.log("-----|------------|---------");

for (let turn = 1; turn <= 16; turn++) {
    const mult = engine.getPhaseMultiplier(turn);
    let expected = 1;
    if (turn > 10) expected = 100;
    else if (turn > 5) expected = 10;

    // Note: Config is now 5/5/5, so turns 1-5=1, 6-10=10, 11-15=100.

    console.log(`${turn.toString().padEnd(4)} | ${mult.toString().padEnd(10)} | ${expected}`);
}
