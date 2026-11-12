# Tudor's Games

Simple games for kids, live at **https://tudor.preda.app**.
Games are plain HTML/CSS/JavaScript in `site/` (one folder per game). A small Node server in `server/` serves them and runs the online football matches.

| Game | Folder |
| --- | --- |
| Tudor's Goal Kick (balls roll down 4 ramps, Tudor heads or kicks them into the goal) | `site/goal-kick/` |
| Memory (find animal pairs) | `site/memory/` |
| Balloon Pop (60 seconds) | `site/balloons/` |
| Design Your Flag (stripes, colours, shapes, name; saved in My flags) | `site/flag/` |
| Spring Football (2 players online, club code needed) | `site/fusbal/` + `server/game.js` |

**Add a game:** create `site/<name>/index.html`, then add a card for it in `site/index.html`.
**Try locally:** `cd server && npm install && npm start`, then open http://localhost:3000. Football rules have tests: `npm test`.

**Football club code:** set `FUSBAL_CODE` in Coolify (default `PREDA-FC`). Friends type it once with their name.
**Deploy:** Coolify builds the `Dockerfile` (Node, port 3000) on every push to `main`.
