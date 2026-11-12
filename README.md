# Tudor's Games

Simple games for kids, live at **https://tudor.preda.app**.
Plain HTML/CSS/JavaScript, no build step. Each game lives in its own folder under `site/`.

| Game | Folder |
| --- | --- |
| Tudor's Goal Kick (balls roll down 4 ramps, Tudor heads or kicks them into the goal) | `site/goal-kick/` |
| Memory (find animal pairs) | `site/memory/` |
| Balloon Pop (60 seconds) | `site/balloons/` |
| Design Your Flag (stripes, colours, shapes, name; saved in My flags) | `site/flag/` |

**Add a game:** create `site/<name>/index.html`, then add a card for it in `site/index.html`.
**Try locally:** open `site/index.html` with any small web server, e.g. `npx serve site`.
**Deploy:** Coolify builds the `Dockerfile` (nginx) on every push to `main`.
