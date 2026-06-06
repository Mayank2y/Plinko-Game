import mongoose from "mongoose";

const roundSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["CREATED", "STARTED", "REVEALED"],
      default: "CREATED",
      index: true,
    },
    nonce: { type: String, required: true },
    commitHex: { type: String, required: true, index: true },
    serverSeed: { type: String },
    hiddenServerSeed: { type: String, required: true, select: false },
    clientSeed: { type: String, default: "" },
    combinedSeed: { type: String, default: "" },
    pegMapHash: { type: String, default: "" },
    rows: { type: Number, default: 12 },
    dropColumn: { type: Number, min: 0, max: 12 },
    binIndex: { type: Number, min: 0, max: 12 },
    payoutMultiplier: { type: Number, default: 0 },
    betCents: { type: Number, default: 0, min: 0 },
    pathJson: { type: mongoose.Schema.Types.Mixed, default: [] },
    pegMap: { type: mongoose.Schema.Types.Mixed, default: [] },
    revealedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

roundSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.hiddenServerSeed;
    return ret;
  },
});

export const Round = mongoose.model("Round", roundSchema);

