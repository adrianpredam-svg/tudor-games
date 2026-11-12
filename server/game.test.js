import { test } from "node:test";
import assert from "node:assert/strict";
import { Match, RULES, FIELD } from "./game.js";

const run = (m, ms) => { for (let t = 0; t < ms; t += 16) m.step(16); };
const holderOf = (m) => m.players[m.holder];

test("team A kicks off with the centre midfielder", () => {
  const m = new Match();
  assert.equal(holderOf(m).team, "A");
  assert.equal(holderOf(m).num, 5);
});

test("only the team with the ball can kick, goalkeeper can never be pulled", () => {
  const m = new Match();
  assert.equal(m.kick("B", m.holder, 0, 40), false);
  const gkA = m.players.find((p) => p.team === "A" && p.gk);
  assert.equal(m.kick("A", gkA.id, 0, 40), false);
  assert.equal(m.kick("A", m.holder, 0, 3), false, "tiny pull is ignored");
  assert.equal(m.kick("A", m.holder, 0, 40), true);
});

test("ball flies opposite to the pull and a soft pass is caught by a team-mate", () => {
  const m = new Match();
  const from = holderOf(m); // (300, 640)
  // Pull down a little -> ball goes up towards the forwards at y 440-470
  m.kick("A", from.id, 0, 22);
  run(m, 4000);
  assert.notEqual(m.holder, null);
  assert.ok(holderOf(m).y < from.y, "ball moved up the field");
});

test("a full-power straight shot from the edge of the box scores", () => {
  const m = new Match();
  const fwd = m.players.find((p) => p.team === "A" && p.num === 7); // (230, 440)
  m.give(fwd.id);
  // Aim at the left half of the goal mouth, avoiding the keeper at x=300
  const tx = 250, ty = -20;
  const dx = tx - fwd.x, dy = ty - fwd.y, len = Math.hypot(dx, dy);
  m.kick("A", fwd.id, (-dx / len) * RULES.maxPull, (-dy / len) * RULES.maxPull);
  run(m, 3000);
  assert.equal(m.score.A, 1);
});

test("a goal is counted when the ball crosses the line between the posts", () => {
  const m = new Match();
  m.holder = null;
  m.ball = { x: 250, y: 20, vx: 0, vy: -600 };
  run(m, 200);
  assert.equal(m.score.A, 1);
  assert.equal(m.phase, "goal");
  run(m, RULES.goalPauseMs + 100);
  assert.equal(m.phase, "play");
  assert.equal(holderOf(m).team, "B", "team that conceded kicks off");
});

test("outside the posts the ball bounces instead of scoring", () => {
  const m = new Match();
  m.holder = null;
  m.ball = { x: 60, y: 20, vx: 0, vy: -600 };
  run(m, 100);
  assert.equal(m.score.A, 0);
  assert.ok(m.ball.vy > 0);
});

test("a slow ball rolling into an opponent's hole is intercepted", () => {
  const m = new Match();
  const opp = m.players.find((p) => p.team === "B" && p.num === 5); // (300, 260)
  m.holder = null;
  m.ball = { x: 300, y: 330, vx: 0, vy: -250 };
  run(m, 1000);
  assert.equal(m.holder, opp.id);
});

test("shot clock gives the ball to the other team", () => {
  const m = new Match();
  run(m, RULES.shotClockMs + 100);
  assert.equal(holderOf(m).team, "B");
});

test("three goals wins the match", () => {
  const m = new Match();
  for (let i = 0; i < 3; i++) {
    m.phase = "play"; m.holder = null;
    m.ball = { x: 250, y: FIELD.H - 20, vx: 0, vy: 600 };
    run(m, 200);
  }
  assert.equal(m.score.B, 3);
  assert.equal(m.phase, "over");
  assert.equal(m.winner, "B");
});

test("a ball that stops on the grass goes to the nearest player", () => {
  const m = new Match();
  m.holder = null;
  m.ball = { x: 40, y: 450, vx: 0, vy: 0 };
  run(m, 50);
  assert.notEqual(m.holder, null);
});
