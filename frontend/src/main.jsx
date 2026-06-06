import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Download, Grid2X2, Search, Volume2, VolumeX } from "lucide-react";
import { PAYTABLE, ROWS } from "./constants.js";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = {
  async request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  },
  commit: () => api.request("/rounds/commit", { method: "POST" }),
  start: (id, body) => api.request(`/rounds/${id}/start`, { method: "POST", body: JSON.stringify(body) }),
  reveal: (id) => api.request(`/rounds/${id}/reveal`, { method: "POST" }),
  round: (id) => api.request(`/rounds/${id}`),
  recent: () => api.request("/rounds?limit=12"),
  verify: (params) => api.request(`/verify?${new URLSearchParams(params).toString()}`),
};

function useAudio(muted) {
  const ctxRef = useRef(null);

  return useMemo(
    () => ({
      tick() {
        if (muted) return;
        const ctx = ctxRef.current || new AudioContext();
        ctxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 580;
        gain.gain.value = 0.025;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.035);
      },
      land() {
        if (muted) return;
        const ctx = ctxRef.current || new AudioContext();
        ctxRef.current = ctx;
        [330, 495, 660].forEach((hz, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = hz;
          gain.gain.value = 0.04;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.055);
          osc.stop(ctx.currentTime + 0.18 + i * 0.055);
        });
      },
    }),
    [muted],
  );
}

function PlinkoBoard({ path = [], binIndex, dropColumn, debug, tilt, golden, reducedMotion, onTick, onLand }) {
  const canvasRef = useRef(null);
  const [landed, setLanded] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frameId;
    let start = performance.now();
    let lastStep = -1;
    setLanded(null);

    function draw(now) {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      const top = 34;
      const rowGap = (height - 105) / ROWS;
      const center = width / 2;
      const spacing = Math.min(44, width / 16);
      const progress = path.length ? Math.min((now - start) / (reducedMotion ? 150 : 2400), 1) : 0;
      const stepFloat = progress * ROWS;
      const currentStep = Math.min(Math.floor(stepFloat), path.length - 1);

      if (currentStep > lastStep && path.length) {
        lastStep = currentStep;
        onTick?.();
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#10151f";
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      if (tilt) {
        ctx.translate(center, height / 2);
        ctx.rotate((Math.sin(now / 280) * 5 * Math.PI) / 180);
        ctx.translate(-center, -height / 2);
      }

      for (let row = 0; row < ROWS; row += 1) {
        for (let peg = 0; peg <= row; peg += 1) {
          const x = center + (peg - row / 2) * spacing;
          const y = top + row * rowGap;
          ctx.beginPath();
          ctx.arc(x, y, debug ? 5 : 4, 0, Math.PI * 2);
          ctx.fillStyle = debug ? "#7dd3fc" : "#d9e2f1";
          ctx.fill();
          if (debug) {
            ctx.fillStyle = "#8aa0bc";
            ctx.font = "10px Inter, sans-serif";
            ctx.fillText(`${row}:${peg}`, x + 7, y - 7);
          }
        }
      }

      const binY = height - 54;
      for (let bin = 0; bin <= ROWS; bin += 1) {
        const x = center + (bin - ROWS / 2) * spacing;
        const isHit = bin === binIndex && progress >= 1;
        ctx.fillStyle = isHit ? "#facc15" : "#263244";
        ctx.fillRect(x - spacing / 2 + 2, binY, spacing - 4, 36);
        ctx.fillStyle = isHit ? "#111827" : "#e2e8f0";
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${PAYTABLE[bin]}x`, x, binY + 23);
      }

      let x = center + (dropColumn - ROWS / 2) * spacing * 0.4;
      let y = 16;
      if (path.length) {
        let logicalX = 0;
        const completed = Math.min(Math.floor(stepFloat), path.length);
        for (let i = 0; i < completed; i += 1) logicalX += path[i].direction === "R" ? 0.5 : -0.5;
        const partial = stepFloat - completed;
        const next = path[completed];
        const nextDelta = next ? (next.direction === "R" ? 0.5 : -0.5) * partial : 0;
        x = center + (logicalX + nextDelta) * spacing;
        y = top - 16 + stepFloat * rowGap;
      }

      ctx.beginPath();
      ctx.arc(x, Math.min(y, binY - 8), golden ? 11 : 9, 0, Math.PI * 2);
      ctx.fillStyle = golden ? "#fde68a" : "#f97316";
      ctx.shadowColor = golden ? "#facc15" : "#fb923c";
      ctx.shadowBlur = golden ? 22 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (progress >= 1 && binIndex !== undefined) {
        setLanded(binIndex);
        onLand?.();
        if (!reducedMotion) {
          for (let i = 0; i < 34; i += 1) {
            const angle = (i / 34) * Math.PI * 2 + now / 500;
            const radius = 14 + (i % 7) * 5;
            ctx.fillStyle = ["#22c55e", "#38bdf8", "#f97316", "#facc15"][i % 4];
            ctx.fillRect(center + (binIndex - ROWS / 2) * spacing + Math.cos(angle) * radius, binY - 20 + Math.sin(angle) * radius, 4, 4);
          }
        }
      }

      ctx.restore();

      if (progress < 1) frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [path, binIndex, dropColumn, debug, tilt, golden, reducedMotion, onTick, onLand]);

  return (
    <div className={`boardShell ${tilt ? "tiltMode" : ""}`} aria-label="Plinko board">
      <canvas ref={canvasRef} className="boardCanvas" />
      {landed !== null && <div className="landingBadge">Bin {landed}</div>}
    </div>
  );
}

function Game() {
  const [dropColumn, setDropColumn] = useState(6);
  const [betCents, setBetCents] = useState(1000);
  const [clientSeed, setClientSeed] = useState("candidate-hello");
  const [round, setRound] = useState(null);
  const [recent, setRecent] = useState([]);
  const [muted, setMuted] = useState(false);
  const [debug, setDebug] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [centerStreak, setCenterStreak] = useState(0);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const audio = useAudio(muted);
  const golden = centerStreak >= 3;

  async function loadRecent() {
    setRecent(await api.recent());
  }

  useEffect(() => {
    loadRecent().catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "ArrowLeft") setDropColumn((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setDropColumn((value) => Math.min(ROWS, value + 1));
      if (event.code === "Space") {
        event.preventDefault();
        drop();
      }
      if (event.key.toLowerCase() === "g") setDebug((value) => !value);
      if (event.key.toLowerCase() === "t") setTilt((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function drop() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const commit = await api.commit();
      const start = await api.start(commit.roundId, { clientSeed, betCents, dropColumn });
      const reveal = await api.reveal(commit.roundId);
      const full = await api.round(commit.roundId);
      setRound({ ...full, ...start, serverSeed: reveal.serverSeed });
      setCenterStreak(start.binIndex === 6 ? centerStreak + 1 : 0);
      await loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function csv() {
    const rows = ["id,createdAt,commitHex,pegMapHash,binIndex,payoutMultiplier"];
    recent.forEach((item) => rows.push([item.id, item.createdAt, item.commitHex, item.pegMapHash, item.binIndex, item.payoutMultiplier].join(",")));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plinko-rounds.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="layout">
      <section className="playArea">
        <div className="topBar">
          <div>
            <p className="eyebrow">Provably fair MERN Plinko</p>
            <h1>Plinko Lab</h1>
          </div>
          <div className="iconGroup">
            <button className="iconButton" onClick={() => setMuted(!muted)} title={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button className="iconButton" onClick={() => setDebug(!debug)} title="Debug grid">
              <Grid2X2 size={18} />
            </button>
          </div>
        </div>

        <PlinkoBoard
          path={round?.pathJson || round?.path || []}
          binIndex={round?.binIndex}
          dropColumn={dropColumn}
          debug={debug}
          tilt={tilt}
          golden={golden}
          reducedMotion={reducedMotion}
          onTick={audio.tick}
          onLand={audio.land}
        />

        <div className="paytable">
          {PAYTABLE.map((multiplier, index) => (
            <span className={round?.binIndex === index ? "active" : ""} key={index}>
              {index}: {multiplier}x
            </span>
          ))}
        </div>
      </section>

      <aside className="panel">
        <label>
          Client seed
          <input value={clientSeed} onChange={(event) => setClientSeed(event.target.value)} />
        </label>
        <label>
          Drop column: {dropColumn}
          <input type="range" min="0" max="12" value={dropColumn} onChange={(event) => setDropColumn(Number(event.target.value))} />
        </label>
        <label>
          Bet amount
          <input type="number" min="0" value={betCents} onChange={(event) => setBetCents(Number(event.target.value))} />
        </label>
        <button className="primary" onClick={drop} disabled={busy || !clientSeed.trim()}>
          {busy ? "Dropping..." : "Drop"}
        </button>
        {error && <p className="error">{error}</p>}

        {round && (
          <div className="result">
            <CheckCircle2 size={18} />
            <div>
              <strong>Bin {round.binIndex} · {round.payoutMultiplier}x</strong>
              <small>Round {round.id}</small>
              <a href={`/verify?roundId=${round.id}&serverSeed=${round.serverSeed}&clientSeed=${round.clientSeed}&nonce=${round.nonce}&dropColumn=${round.dropColumn}`}>Open verifier</a>
            </div>
          </div>
        )}

        <div className="sessionHeader">
          <h2>Recent rounds</h2>
          <button className="iconButton" onClick={csv} title="Download CSV"><Download size={16} /></button>
        </div>
        <div className="roundList">
          {recent.map((item) => (
            <a key={item.id} href={`/verify?roundId=${item.id}`}>
              <span>Bin {item.binIndex ?? "-"}</span>
              <small>{item.commitHex.slice(0, 12)}...</small>
            </a>
          ))}
        </div>
      </aside>
    </main>
  );
}

function Verify() {
  const params = new URLSearchParams(location.search || location.hash.split("?")[1] || "");
  const [form, setForm] = useState({
    roundId: params.get("roundId") || "",
    serverSeed: params.get("serverSeed") || "",
    clientSeed: params.get("clientSeed") || "",
    nonce: params.get("nonce") || "",
    dropColumn: params.get("dropColumn") || "6",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (form.roundId && !form.serverSeed) {
      api.round(form.roundId)
        .then((round) => setForm((value) => ({
          ...value,
          serverSeed: round.serverSeed || "",
          clientSeed: round.clientSeed || "",
          nonce: round.nonce || "",
          dropColumn: String(round.dropColumn ?? 6),
        })))
        .catch(() => {});
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      setResult(await api.verify(form));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="verifyLayout">
      <a className="backLink" href="/">Back to game</a>
      <section className="verifyForm">
        <p className="eyebrow">Public verifier</p>
        <h1>Replay a round</h1>
        <form onSubmit={submit}>
          {["roundId", "serverSeed", "clientSeed", "nonce", "dropColumn"].map((name) => (
            <label key={name}>
              {name}
              <input value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required={name !== "roundId"} />
            </label>
          ))}
          <button className="primary"><Search size={16} /> Verify</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="verifyResult">
        <PlinkoBoard path={result?.path || []} binIndex={result?.binIndex} dropColumn={Number(form.dropColumn || 6)} debug={false} reducedMotion />
        {result && (
          <div className="hashGrid">
            <strong>{result.matchesStored === null ? "Recomputed only" : result.matchesStored ? "Matches stored round" : "Does not match stored round"}</strong>
            <span>Commit: {result.commitHex}</span>
            <span>Combined: {result.combinedSeed}</span>
            <span>Peg map hash: {result.pegMapHash}</span>
            <span>Final bin: {result.binIndex}</span>
          </div>
        )}
      </section>
    </main>
  );
}

function App() {
  const [route, setRoute] = useState(`${location.pathname}${location.hash}`);
  useEffect(() => {
    const onHash = () => setRoute(`${location.pathname}${location.hash}`);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route.startsWith("/verify") || route.includes("#/verify") ? <Verify /> : <Game />;
}

createRoot(document.getElementById("root")).render(<App />);
