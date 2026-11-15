# Backup slides

`docs/slides.pptx` and `docs/slides.pdf`: 7 slides, made by the SI assistant (Claude) and marked "AI-made" on every slide. The pictures are screenshots of our own site, plus the team logo on the title slide (supplied by the team); there are no photos of team members and no NASA logos.

To remake them:

```
cd slides
npm install
npx playwright install chromium-headless-shell
(cd ../frontend && npm run build && npx vite preview --port 5197 --strictPort)   # in a second terminal
node shots.mjs      # screenshots of http://localhost:5197 (or pass a URL) -> img/
node build.cjs      # -> ../docs/slides.pptx
soffice --headless --convert-to pdf --outdir ../docs ../docs/slides.pptx
```

`build.cjs` can also write the theme colours into the file: set `APPLY_THEME` to the path of a pptx-skill `apply_theme.js` and `NODE_PATH` to `slides/node_modules`. Without it the slides still look the same; only PowerPoint's theme palette stays the stock one.
