# CLAUDE.md — rules for Tudor's games

Kids' games at https://tudor.preda.app. Family members ask Claude for new games or changes.

- Games: plain HTML, CSS and JavaScript only. No frameworks, no build step, no external scripts or trackers.
- `server/` is a small Node server (static files + online football over WebSocket, only dependency `ws`). Football rules live in `server/game.js` with tests in `server/game.test.js`; run `cd server && npm test` after changing them. The real club code is set with `FUSBAL_CODE` in Coolify; the default in `server.js` is only a fallback — never write the real code into the repo.
- One folder per game: `site/<game>/index.html`. Add a card for each new game to `site/index.html`.
- Shared look lives in `site/style.css`; reuse it.
- Phone first: works at 375px wide, big buttons, touch and keyboard controls, no tiny text.
- Kid-safe: no ads, no links to other sites, no chat, no collecting personal data. Football player names live only in server memory during a match. Scores may be kept in localStorage only (wrap in try/catch).
- Only original characters and artwork. Do not copy characters, logos or names from existing games, cartoons or brands.
- Sound must have an on/off button and be quiet by default level.
- Open a pull request with a short, plain description of the new game and how to play it. Never push to `main` directly.
