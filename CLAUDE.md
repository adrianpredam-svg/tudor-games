# CLAUDE.md — rules for Tudor's games

Kids' games at https://tudor.preda.app. Family members ask Claude for new games or changes.

- Plain HTML, CSS and JavaScript only. No frameworks, no build step, no external scripts or trackers.
- One folder per game: `site/<game>/index.html`. Add a card for each new game to `site/index.html`.
- Shared look lives in `site/style.css`; reuse it.
- Phone first: works at 375px wide, big buttons, touch and keyboard controls, no tiny text.
- Kid-safe: no ads, no links to other sites, no collecting names or data, no chat. Scores may be kept in localStorage only (wrap in try/catch).
- Only original characters and artwork. Do not copy characters, logos or names from existing games, cartoons or brands.
- Sound must have an on/off button and be quiet by default level.
- Open a pull request with a short, plain description of the new game and how to play it. Never push to `main` directly.
