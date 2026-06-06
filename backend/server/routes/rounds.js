import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { computeRound, ROWS, sha256Hex } from "../../shared/fairness.js";
import { Round } from "../models/Round.js";
import { memoryStore } from "../memoryStore.js";

const router = express.Router();

const startSchema = z.object({
  clientSeed: z.string().trim().min(1).max(120),
  betCents: z.coerce.number().int().min(0).max(10000000),
  dropColumn: z.coerce.number().int().min(0).max(ROWS),
});

const verifySchema = z.object({
  roundId: z.string().optional(),
  serverSeed: z.string().min(1),
  clientSeed: z.string().min(1),
  nonce: z.string().min(1),
  dropColumn: z.coerce.number().int().min(0).max(ROWS),
});

function seedHex() {
  return crypto.randomBytes(32).toString("hex");
}

function nonceValue() {
  return crypto.randomInt(1, 2 ** 31 - 1).toString();
}

function store(req) {
  return req.app.locals.useMongo ? null : memoryStore;
}

async function createRound(req, payload) {
  if (store(req)) return store(req).create(payload);
  const doc = await Round.create(payload);
  return doc.toJSON();
}

async function findRound(req, id, includeHidden = false) {
  if (store(req)) return store(req).findById(id, includeHidden);
  const query = Round.findById(id);
  if (includeHidden) query.select("+hiddenServerSeed");
  return query;
}

async function saveRound(req, id, patch) {
  if (store(req)) return store(req).save(id, patch);
  const doc = await Round.findByIdAndUpdate(id, patch, { new: true });
  return doc?.toJSON();
}

router.post("/rounds/commit", async (req, res, next) => {
  try {
    const hiddenServerSeed = seedHex();
    const nonce = nonceValue();
    const commitHex = sha256Hex(`${hiddenServerSeed}:${nonce}`);
    const round = await createRound(req, {
      status: "CREATED",
      hiddenServerSeed,
      nonce,
      commitHex,
      rows: ROWS,
    });

    res.status(201).json({ roundId: round.id, commitHex, nonce });
  } catch (error) {
    next(error);
  }
});

router.post("/rounds/:id/start", async (req, res, next) => {
  try {
    const body = startSchema.parse(req.body);
    const round = await findRound(req, req.params.id, true);

    if (!round) return res.status(404).json({ message: "Round not found" });
    if (round.status !== "CREATED") return res.status(409).json({ message: "Round already started" });

    const result = computeRound({
      serverSeed: round.hiddenServerSeed,
      clientSeed: body.clientSeed,
      nonce: round.nonce,
      dropColumn: body.dropColumn,
      rows: ROWS,
    });

    const saved = await saveRound(req, req.params.id, {
      status: "STARTED",
      clientSeed: body.clientSeed,
      combinedSeed: result.combinedSeed,
      pegMapHash: result.pegMapHash,
      rows: ROWS,
      dropColumn: body.dropColumn,
      binIndex: result.binIndex,
      payoutMultiplier: result.payoutMultiplier,
      betCents: body.betCents,
      pathJson: result.path,
      pegMap: result.pegMap,
    });

    res.json({
      roundId: saved.id,
      pegMapHash: saved.pegMapHash,
      rows: saved.rows,
      path: saved.pathJson,
      pegMap: saved.pegMap,
      binIndex: saved.binIndex,
      payoutMultiplier: saved.payoutMultiplier,
      payoutCents: Math.round(saved.betCents * saved.payoutMultiplier),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/rounds/:id/reveal", async (req, res, next) => {
  try {
    const round = await findRound(req, req.params.id, true);

    if (!round) return res.status(404).json({ message: "Round not found" });
    if (round.status === "CREATED") return res.status(409).json({ message: "Round has not started" });

    const saved = await saveRound(req, req.params.id, {
      status: "REVEALED",
      serverSeed: round.hiddenServerSeed,
      revealedAt: new Date(),
    });

    res.json({ roundId: saved.id, serverSeed: round.hiddenServerSeed, status: saved.status });
  } catch (error) {
    next(error);
  }
});

router.get("/rounds", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    if (store(req)) return res.json(await store(req).recent(limit));

    const rounds = await Round.find().sort({ createdAt: -1 }).limit(limit);
    res.json(rounds.map((round) => round.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.get("/rounds/:id", async (req, res, next) => {
  try {
    const round = await findRound(req, req.params.id);
    if (!round) return res.status(404).json({ message: "Round not found" });
    res.json(round.toJSON ? round.toJSON() : round);
  } catch (error) {
    next(error);
  }
});

router.get("/verify", async (req, res, next) => {
  try {
    const input = verifySchema.parse(req.query);
    const recomputed = computeRound(input);
    let stored = null;
    let matchesStored = null;

    if (input.roundId) {
      const round = await findRound(req, input.roundId);
      stored = round?.toJSON ? round.toJSON() : round;
      matchesStored = Boolean(
        stored &&
          stored.commitHex === recomputed.commitHex &&
          stored.combinedSeed === recomputed.combinedSeed &&
          stored.pegMapHash === recomputed.pegMapHash &&
          stored.binIndex === recomputed.binIndex,
      );
    }

    res.json({
      ...recomputed,
      matchesStored,
      stored,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

