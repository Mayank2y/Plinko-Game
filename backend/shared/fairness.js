import crypto from "node:crypto";
import { PAYTABLE, ROWS } from "./constants.js";

export { PAYTABLE, ROWS };

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function seedFromCombinedHex(combinedSeed) {
  const seed = Number.parseInt(combinedSeed.slice(0, 8), 16) >>> 0;
  return seed === 0 ? 0x9e3779b9 : seed;
}

export function createXorshift32(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;

  return function rand() {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function createPrngFromCombinedSeed(combinedSeed) {
  return createXorshift32(seedFromCombinedHex(combinedSeed));
}

export function roundBias(value) {
  return Number(value.toFixed(6));
}

export function createPegMap(rows, rand) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: row + 1 }, () => ({
      leftBias: roundBias(0.5 + (rand() - 0.5) * 0.2),
    })),
  );
}

export function computeRound({
  serverSeed,
  clientSeed,
  nonce,
  dropColumn,
  rows = ROWS,
}) {
  const normalizedDropColumn = Number(dropColumn);
  const commitHex = sha256Hex(`${serverSeed}:${nonce}`);
  const combinedSeed = sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
  const rand = createPrngFromCombinedSeed(combinedSeed);
  const pegMap = createPegMap(rows, rand);
  const pegMapHash = sha256Hex(JSON.stringify(pegMap));
  const adjustment = (normalizedDropColumn - Math.floor(rows / 2)) * 0.01;

  let pos = 0;
  const path = [];

  for (let row = 0; row < rows; row += 1) {
    const pegIndex = Math.min(pos, row);
    const leftBias = pegMap[row][pegIndex].leftBias;
    const adjustedBias = clamp(leftBias + adjustment);
    const rnd = rand();
    const direction = rnd < adjustedBias ? "L" : "R";

    if (direction === "R") pos += 1;

    path.push({
      row,
      pegIndex,
      leftBias,
      adjustedBias: roundBias(adjustedBias),
      rnd: Number(rnd.toFixed(10)),
      direction,
      posAfter: pos,
    });
  }

  return {
    rows,
    commitHex,
    combinedSeed,
    pegMap,
    pegMapHash,
    path,
    binIndex: pos,
    payoutMultiplier: PAYTABLE[pos],
  };
}

