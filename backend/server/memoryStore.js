import crypto from "node:crypto";

const rounds = new Map();

function publicRound(round) {
  const { hiddenServerSeed, ...rest } = round;
  return rest;
}

export const memoryStore = {
  async create(round) {
    const saved = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...round,
    };
    rounds.set(saved.id, saved);
    return publicRound(saved);
  },

  async findById(id, includeHidden = false) {
    const round = rounds.get(id);
    if (!round) return null;
    return includeHidden ? round : publicRound(round);
  },

  async save(id, patch) {
    const round = rounds.get(id);
    if (!round) return null;
    const next = { ...round, ...patch };
    rounds.set(id, next);
    return publicRound(next);
  },

  async recent(limit = 20) {
    return [...rounds.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(publicRound);
  },
};

