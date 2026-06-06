import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { connectDb } from "./db.js";
import roundsRouter from "./routes/rounds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, stack: "MongoDB + Express + React + Node" });
});

app.use("/api", roundsRouter);

const clientDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((error, _req, res, _next) => {
  if (error?.name === "ZodError") {
    return res.status(400).json({ message: "Invalid input", issues: error.issues });
  }

  console.error(error);
  res.status(500).json({ message: "Server error" });
});

connectDb()
  .then((useMongo) => {
    app.locals.useMongo = useMongo;
    app.listen(port, () => {
      console.log(`Plinko Lab API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });

