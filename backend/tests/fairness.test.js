import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRound,
  createPrngFromCombinedSeed,
  sha256Hex,
} from "../shared/fairness.js";

const vector = {
  rows: 12,
  serverSeed: "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc",
  nonce: "42",
  clientSeed: "candidate-hello",
  dropColumn: 6,
};

describe("fairness primitives", () => {
  it("matches the commit and combined seed test vector", () => {
    assert.equal(
      sha256Hex(`${vector.serverSeed}:${vector.nonce}`),
      "bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34",
    );
    assert.equal(
      sha256Hex(`${vector.serverSeed}:${vector.clientSeed}:${vector.nonce}`),
      "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0",
    );
  });

  it("matches the xorshift32 PRNG sequence", () => {
    const rand = createPrngFromCombinedSeed(
      "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0",
    );

    assert.deepEqual(
      Array.from({ length: 5 }, () => Number(rand().toFixed(10))),
      [0.1106166649, 0.7625129214, 0.0439292176, 0.4578678815, 0.3438999297],
    );
  });

  it("generates the expected peg map prefix and center outcome", () => {
    const result = computeRound(vector);

    assert.deepEqual(result.pegMap[0].map((peg) => peg.leftBias), [0.422123]);
    assert.deepEqual(result.pegMap[1].map((peg) => peg.leftBias), [0.552503, 0.408786]);
    assert.deepEqual(result.pegMap[2].map((peg) => peg.leftBias), [0.491574, 0.46878, 0.43654]);
    assert.equal(result.binIndex, 6);
  });

  it("replays deterministically for identical inputs", () => {
    const first = computeRound(vector);
    const second = computeRound(vector);

    assert.deepEqual(second.path, first.path);
    assert.equal(second.pegMapHash, first.pegMapHash);
    assert.equal(second.binIndex, first.binIndex);
  });
});

