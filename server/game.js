// Football (fusbal) match rules and physics. Pure logic, no networking, so it is easy to test.
//
// The field is 600 x 900. Team A defends the bottom goal and attacks up; team B the opposite.
// Every player sits in a small hole and never leaves it. The team with the ball pulls the
// player who has it back like a spring and lets go: the ball flies the opposite way.
// A ball that rolls slowly into any player's hole is caught by that player (also opponents!).

export const FIELD = { W: 600, H: 900, GOAL_L: 210, GOAL_R: 390 };
export const R = { hole: 38, disc: 20, gk: 24, ball: 11 };
export const RULES = {
  maxPull: 70,          // how far a player can be pulled back (field units)
  minSpeed: 160,        // kick speed for a tiny pull
  maxSpeed: 1150,       // kick speed for a full pull
  captureSpeed: 360,    // slower than this, a hole catches the ball
  shotClockMs: 15000,   // time to play the ball before it goes to the other team
  goalPauseMs: 2200,
  goalsToWin: 3,
};

// Team A positions [x, y, isGoalkeeper]. Team B is the same, turned around the centre spot.
const A_POSITIONS = [
  [300, 860, true],                    // goalkeeper (cannot be pulled)
  [180, 760], [420, 760],              // defenders
  [110, 600], [300, 640], [490, 600],  // midfield
  [230, 440], [470, 470],              // forwards
];
const KICKOFF_INDEX = 4; // centre midfielder starts with the ball

export function makePlayers() {
  const players = [];
  for (const team of ["A", "B"]) {
    A_POSITIONS.forEach(([x, y, gk], i) => {
      players.push({
        id: players.length,
        team,
        num: i + 1,
        gk: !!gk,
        x: team === "A" ? x : FIELD.W - x,
        y: team === "A" ? y : FIELD.H - y,
      });
    });
  }
  return players;
}

const other = (team) => (team === "A" ? "B" : "A");

export class Match {
  constructor() {
    this.players = makePlayers();
    this.score = { A: 0, B: 0 };
    this.now = 0;
    this.ball = { x: FIELD.W / 2, y: FIELD.H / 2, vx: 0, vy: 0 };
    this.holder = null;      // player id that has the ball
    this.lastKick = null;    // { id, at } so the kicker does not catch his own kick
    this.phase = "play";     // play | goal | over
    this.phaseUntil = 0;
    this.shotClockEnd = 0;
    this.lastGoal = null;    // team that scored
    this.winner = null;
    this.events = [];
    this.kickoff("A");
  }

  kickoff(team) {
    const p = this.players.find((q) => q.team === team && q.num === KICKOFF_INDEX + 1);
    this.give(p.id);
    this.phase = "play";
  }

  give(id) {
    const p = this.players[id];
    this.holder = id;
    this.ball = { x: p.x, y: p.y, vx: 0, vy: 0 };
    this.shotClockEnd = this.now + RULES.shotClockMs;
    this.events.push({ type: "catch", id, team: p.team });
  }

  /** Player of `team` pulls player `id` by (px, py) and lets go. Returns true if the kick happened. */
  kick(team, id, px, py) {
    if (this.phase !== "play" || this.holder !== id) return false;
    const p = this.players[id];
    if (!p || p.team !== team || p.gk) return false;
    if (![px, py].every(Number.isFinite)) return false;
    const len = Math.hypot(px, py);
    if (len < 8) return false;
    const pull = Math.min(len, RULES.maxPull);
    const speed = RULES.minSpeed + (RULES.maxSpeed - RULES.minSpeed) * (pull / RULES.maxPull);
    // The ball flies opposite to the pull, like a slingshot.
    this.ball.vx = (-px / len) * speed;
    this.ball.vy = (-py / len) * speed;
    this.holder = null;
    this.lastKick = { id, at: this.now };
    this.events.push({ type: "kick", id, team });
    return true;
  }

  nearestFieldPlayer(x, y, team = null) {
    let best = null, bestD = Infinity;
    for (const p of this.players) {
      if (p.gk || (team && p.team !== team)) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /** Advance the match by dtMs milliseconds. */
  step(dtMs) {
    const sub = Math.max(1, Math.ceil(dtMs / 4)); // small sub-steps keep fast balls from skipping holes
    for (let i = 0; i < sub; i++) this.tick(dtMs / sub);
  }

  tick(dtMs) {
    this.now += dtMs;
    if (this.phase === "over") return;
    if (this.phase === "goal") {
      if (this.now >= this.phaseUntil) this.kickoff(other(this.lastGoal)); // the team that conceded kicks off
      return;
    }
    if (this.holder !== null) {
      if (this.now >= this.shotClockEnd) {
        // Too slow: the nearest opponent gets the ball.
        const team = other(this.players[this.holder].team);
        const p = this.nearestFieldPlayer(this.ball.x, this.ball.y, team);
        this.events.push({ type: "timeout", team: this.players[this.holder].team });
        this.give(p.id);
      }
      return;
    }

    const b = this.ball, dt = dtMs / 1000;
    // Rolling friction
    let speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const newSpeed = Math.max(0, speed * (1 - 1.1 * dt) - 110 * dt);
      b.vx *= newSpeed / speed; b.vy *= newSpeed / speed;
      speed = newSpeed;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;

    // Side walls
    if (b.x < R.ball) { b.x = R.ball; b.vx = Math.abs(b.vx) * 0.8; }
    if (b.x > FIELD.W - R.ball) { b.x = FIELD.W - R.ball; b.vx = -Math.abs(b.vx) * 0.8; }
    // End lines: goal inside the posts, otherwise bounce
    const inMouth = b.x > FIELD.GOAL_L + R.ball && b.x < FIELD.GOAL_R - R.ball;
    if (b.y < R.ball) {
      if (inMouth) { if (b.y < -R.ball) return this.goal("A"); }
      else { b.y = R.ball; b.vy = Math.abs(b.vy) * 0.8; }
    }
    if (b.y > FIELD.H - R.ball) {
      if (inMouth) { if (b.y > FIELD.H + R.ball) return this.goal("B"); }
      else { b.y = FIELD.H - R.ball; b.vy = -Math.abs(b.vy) * 0.8; }
    }

    // Players
    for (const p of this.players) {
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 0.0001;
      if (p.gk) { if (d < R.gk + R.ball) this.bounce(p, dx / d, dy / d, R.gk + R.ball, 0.8); continue; }
      const kickerGrace = this.lastKick && this.lastKick.id === p.id && this.now - this.lastKick.at < 350;
      if (kickerGrace) continue;
      if (speed < RULES.captureSpeed && d < R.hole) return this.give(p.id);
      if (d < R.disc + R.ball) this.bounce(p, dx / d, dy / d, R.disc + R.ball, 0.6);
    }

    // A ball that stops on the grass goes to the nearest player.
    if (Math.hypot(b.vx, b.vy) < 12) {
      const p = this.nearestFieldPlayer(b.x, b.y);
      this.give(p.id);
    }
  }

  bounce(p, nx, ny, minDist, restitution) {
    const b = this.ball;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + restitution) * vn * nx; b.vy -= (1 + restitution) * vn * ny; }
    b.x = p.x + nx * minDist; b.y = p.y + ny * minDist;
  }

  goal(team) {
    this.score[team]++;
    this.lastGoal = team;
    this.holder = null;
    this.ball.vx = this.ball.vy = 0;
    this.events.push({ type: "goal", team });
    if (this.score[team] >= RULES.goalsToWin) {
      this.phase = "over"; this.winner = team;
      this.events.push({ type: "over", team });
    } else {
      this.phase = "goal"; this.phaseUntil = this.now + RULES.goalPauseMs;
    }
  }

  /** Small snapshot sent to both phones. */
  snapshot() {
    return {
      ball: [Math.round(this.ball.x * 10) / 10, Math.round(this.ball.y * 10) / 10],
      holder: this.holder,
      score: this.score,
      phase: this.phase,
      lastGoal: this.lastGoal,
      winner: this.winner,
      clock: this.holder !== null && this.phase === "play" ? Math.max(0, Math.ceil((this.shotClockEnd - this.now) / 1000)) : null,
    };
  }

  takeEvents() { const e = this.events; this.events = []; return e; }
}
