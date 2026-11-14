# Backup slides

`docs/slides.pptx` and `docs/slides.pdf`: 7 slides, made by the SI assistant (Claude) and marked "AI-made" on every slide. The pictures are screenshots of our own live site; there are no photos, people or NASA logos.

To remake them:

```
cd slides
npm install
npx playwright install chromium-headless-shell
node shots.mjs      # screenshots of the live site -> img/
node build.cjs      # -> ../docs/slides.pptx
soffice --headless --convert-to pdf --outdir ../docs ../docs/slides.pptx
```

`build.cjs` can also write the theme colours into the file: set `APPLY_THEME` to the path of a pptx-skill `apply_theme.js` and `NODE_PATH` to `slides/node_modules`. Without it the slides still look the same; only PowerPoint's theme palette stays the stock one.
