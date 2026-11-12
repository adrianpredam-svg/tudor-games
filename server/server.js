// Tudor's games server: serves the games in ../site and runs online football matches.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Match, RULES, R, FIELD, makePlayers } from "./game.js";

const PORT = Number(process.env.PORT) || 3000;
// The secret code friends need to play football. Change it in Coolify (environment variable).
const FUSBAL_CODE = (process.env.FUSBAL_CODE || "PREDA-FC").trim().toUpperCase();
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");

// ---------- Static files ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let file;
  try { file = path.normalize(path.join(SITE, decodeURIComponent(url.pathname))); } catch { res.writeHead(400); return res.end(); }
  if (file !== SITE && !file.startsWith(SITE + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(301, { location: url.pathname + "/" }); return res.end(); }
      file = path.join(file, "index.html");
    }
    fs.readFile(file, (err2, data) => {
      if (err2) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "cache-control": file.endsWith(".html") ? "no-cache" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  });
});

// ---------- Football: players, lobby, rooms ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url, "http://x").pathname !== "/fusbal/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

const clients = new Set();   // all connected sockets
const rooms = new Map();     // roomId -> { id, host, guest, match, timer, rematch:Set }
const failedCodes = new Map(); // ip -> { count, first, lockedUntil } to slow down code guessing
let nextId = 1;

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const cleanName = (s) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Player";
const roomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();

// The lobby shows friends waiting for an opponent, and matches already being played (with the score).
function lobbyList() {
  const all = [...rooms.values()];
  return {
    rooms: all.filter((r) => !r.guest).map((r) => ({ id: r.id, host: r.host.name })),
    playing: all.filter((r) => r.guest && r.match).map((r) => ({
      id: r.id, a: r.host.name, b: r.guest.name, score: r.match.score, over: r.match.phase === "over",
    })),
  };
}
function broadcastLobby() {
  const list = lobbyList();
  for (const c of clients) if (c.authed && !c.room) send(c, { t: "lobby", ...list });
}

function startMatch(room) {
  room.match = new Match();
  room.rematch = new Set();
  room.host.team = "A"; room.guest.team = "B";
  const names = { A: room.host.name, B: room.guest.name };
  const players = makePlayers().map(({ id, team, num, gk, x, y }) => ({ id, team, num, gk, x, y }));
  for (const c of [room.host, room.guest]) send(c, { t: "start", team: c.team, names, players, rules: RULES, sizes: R, field: FIELD });
  clearInterval(room.timer);
  let last = Date.now(), frame = 0;
  room.timer = setInterval(() => {
    const now = Date.now();
    room.match.step(Math.min(100, now - last)); last = now;
    const events = room.match.takeEvents();
    if (events.some((e) => e.type === "goal" || e.type === "over")) broadcastLobby(); // live scores in the lobby
    // 30 updates per second to both phones, plus every event straight away
    if (++frame % 2 === 0 || events.length) {
      const msg = { t: "state", ...room.match.snapshot(), aim: room.aim || null, events };
      send(room.host, msg); send(room.guest, msg);
    }
  }, 1000 / 60);
}

function closeRoom(room, leaver) {
  clearInterval(room.timer);
  rooms.delete(room.id);
  for (const c of [room.host, room.guest]) {
    if (!c) continue;
    c.room = null; c.team = null;
    if (c !== leaver) send(c, { t: "left" });
  }
  broadcastLobby();
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

wss.on("connection", (ws, req) => {
  ws.id = nextId++;
  ws.ip = clientIp(req);
  ws.authed = false;
  ws.room = null;
  ws.msgCount = 0;
  clients.add(ws);
  const rate = setInterval(() => { ws.msgCount = 0; }, 1000);

  ws.on("message", (raw) => {
    if (++ws.msgCount > 60) return; // ignore floods
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.t === "hello") {
      const now = Date.now();
      let f = failedCodes.get(ws.ip);
      if (f && f.lockedUntil > now) return send(ws, { t: "denied", reason: "Too many wrong codes. Try again in a few minutes." });
      if (String(m.code ?? "").trim().toUpperCase() !== FUSBAL_CODE) {
        // 8 wrong codes within 10 minutes locks this connection address for 5 minutes
        if (!f || now - f.first > 600000) f = { count: 0, first: now, lockedUntil: 0 };
        f.count++;
        if (f.count >= 8) f.lockedUntil = now + 5 * 60000;
        failedCodes.set(ws.ip, f);
        return send(ws, { t: "denied", reason: "Wrong code. Ask Tudor for the club code!" });
      }
      failedCodes.delete(ws.ip);
      ws.authed = true; ws.name = cleanName(m.name);
      send(ws, { t: "welcome", name: ws.name });
      return send(ws, { t: "lobby", ...lobbyList() });
    }
    if (!ws.authed) return;

    if (m.t === "create" && !ws.room) {
      let id; do { id = roomId(); } while (rooms.has(id));
      const room = { id, host: ws, guest: null, match: null, timer: null, aim: null };
      rooms.set(id, room); ws.room = room;
      send(ws, { t: "waiting", id });
      return broadcastLobby();
    }
    if (m.t === "join" && !ws.room) {
      const room = rooms.get(String(m.id || "").toUpperCase());
      if (!room || room.guest) return send(ws, { t: "error", reason: "That match is not open any more." });
      room.guest = ws; ws.room = room;
      startMatch(room);
      return broadcastLobby();
    }
    if (m.t === "leave" && ws.room) return closeRoom(ws.room, ws);

    const room = ws.room;
    if (!room || !room.match) return;
    if (m.t === "aim") {
      // Show the other player how far the spring is pulled (no effect on the game).
      const holder = room.match.holder;
      if (holder === null || room.match.players[holder].team !== ws.team) return;
      room.aim = Number.isFinite(m.px) && Number.isFinite(m.py) ? [Math.round(m.px), Math.round(m.py)] : null;
      return;
    }
    if (m.t === "kick") {
      room.aim = null;
      room.match.kick(ws.team, Number(m.id), Number(m.px), Number(m.py));
      return;
    }
    if (m.t === "rematch" && room.match.phase === "over") {
      room.rematch.add(ws.team);
      send(room.host, { t: "rematch", ready: [...room.rematch] }); send(room.guest, { t: "rematch", ready: [...room.rematch] });
      if (room.rematch.size === 2) { startMatch(room); broadcastLobby(); }
    }
  });

  ws.on("close", () => {
    clearInterval(rate);
    clients.delete(ws);
    if (ws.room) closeRoom(ws.room, ws);
  });
});

// Keep connections alive behind proxies
setInterval(() => { for (const c of clients) if (c.readyState === 1) c.ping(); }, 25000);

server.listen(PORT, () => console.log(`Tudor's games on http://localhost:${PORT} (football code set: ${FUSBAL_CODE ? "yes" : "no"})`));
