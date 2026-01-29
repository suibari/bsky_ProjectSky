
function calculateCost(follows: number, followers: number): number {
  let rawCost = Math.floor((follows * 5) / (followers + 1)) + 1;
  return Math.max(1, Math.min(10, rawCost));
}

const testCases = [
  { follows: 100, followers: 100, expected: 5 }, // 500/101 ~ 4.95 -> 4 + 1 = 5
  { follows: 1000, followers: 100, expected: 10 }, // 5000/101 ~ 49.5 -> 49 + 1 = 50 -> 10
  { follows: 10, followers: 1000, expected: 1 }, // 50/1001 ~ 0.04 -> 0 + 1 = 1 -> 1
  { follows: 0, followers: 0, expected: 1 }, // 0/1 ~ 0 -> 1
  { follows: 200, followers: 100, expected: 10 }, // 1000/101 ~ 9.9 -> 9 + 1 = 10
];

console.log("--- Testing Cost Formula ---");
let errors = 0;
testCases.forEach(tc => {
  const res = calculateCost(tc.follows, tc.followers);
  console.log(`Follows: ${tc.follows}, Followers: ${tc.followers} -> Cost: ${res} (Expected: ${tc.expected})`);
  if (res !== tc.expected) {
    console.error(`Mismatch! Expected ${tc.expected}, got ${res}`);
    errors++;
  }
});

if (errors === 0) {
  console.log("All tests passed.");
} else {
  console.error("Some tests failed.");
  process.exit(1);
}
