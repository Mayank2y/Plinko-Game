import mongoose from "mongoose";

export async function connectDb() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn("MONGO_URI not set. Using in-memory round store for local demo.");
    return false;
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
  return true;
}

