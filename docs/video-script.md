# 30-second demo video

**File:** `docs/demo-video.mp4`. It is 29.5 seconds long, 1920×1080, 30 fps, H.264, with an AAC voiceover track. The voice is **synthetic text-to-speech**, not a person. The English subtitles are burned into the picture and match the voiceover word for word.

## Rules the video meets (official 2026 guide)

- **30 seconds or less:** 29.5 s, checked with ffprobe.
- **English subtitles:** burned in, from `video-subtitles.srt`.
- **No NASA logo** or other NASA branding.
- **No photos, video or voices of any person.** At least one team member is under 18, so the video is a screen recording of the site only. The voiceover is a computer voice: Microsoft's neural text-to-speech voice "en-GB-RyanNeural", made through the free `edge-tts` Python package. No team member's voice is used.
- **AI watermark and SI audio acknowledgement.** An AI assistant (Claude) scripted and recorded the video and the voice is synthetic, so a visible line sits in the bottom-right corner the whole time: "AI-made video (Claude) - screen recording + synthetic TTS voice". The same is stated in the README and the Project Page text, and in the file's own metadata (mp4 `title`, `comment` and `description` tags, written by `render.sh`).
- **Still to do by the team:** upload it publicly (for example YouTube unlisted, or Google Drive with "anyone with the link"), so it opens without a login. Then paste the link into the Project Page's "Link to Project Demo" field. It cannot be uploaded to the Space Apps site itself.

## What it shows

Recorded from the live site (7 sites, terrain skyline), 29.5 s. Five slow scenes, each with a yellow ring around the part the voice is talking about.

| Time | Voiceover (= subtitles) | Screen |
|---|---|---|
| 0:00-0:06 | Landing near the Moon's south pole? You need sunlight for power, and Earth in view for radio. | Top of the page, pointer over the three steps |
| 0:06-0:14.7 | This is one site's sky for a year. Grey is the real NASA terrain skyline. When the Sun sinks behind it, the lander goes dark. | Sky graph ringed; pointer runs along the grey skyline, then rests on a Sun dot just above it and its tooltip shows (Sun, az 0.0°, el 0.11°) |
| 0:14.7-0:20.6 | Each card scores a site: time in sunlight, time Earth is in view, and the longest dark spell. | Shackleton rim card; each of its three rows ringed in turn as the voice names it |
| 0:20.6-26 | The heatmap shows the best days to land. Click one, and every number updates. | Pointer sweeps along the Shackleton rim row, clicks a day (6 May 2027); the cards are shown again with new numbers (86.2% to 84.7%) |
| 0:26-0:29.5 | Too close to call? It tells you, honestly. | The "too close to call" note ringed |

## How to remake it

The video is made by three scripts in `video/`. `record.mjs` takes any URL as an argument (the live site, or the app served locally with `npx vite preview --port 5197` in `frontend/`):

```
cd video
npm install
npx playwright install chromium-headless-shell
py -3 -m pip install edge-tts   # the voice; needs internet
node record.mjs "https://stevenjc2009-byte.github.io/clps-lunar-browser/#d=2026-11-15&w=365&s=shackleton-rim,connecting-ridge,peak-near-shackleton,im2,im1&g=shackleton-rim"
bash render.sh                  # runs voice/make.sh, then ffmpeg: trim, cut at 29.5 s, caption band, subtitles, watermark, voice -> docs/demo-video.mp4
```

- `voice/lines.txt` holds the five spoken lines; `voice/make.sh` speaks each one, trims its silence, and places it at its start time (0.3, 6.2, 14.8, 20.7, 26.1 s). If you change a line, re-time `docs/video-subtitles.srt` and the scene times in `record.mjs` to match.
- The page is drawn with a 1.5× CSS zoom for a sharp 1080p picture. Plotly's hover and the heatmap canvas read the mouse without that zoom, so `record.mjs` aims the real mouse at the unzoomed spot and draws its own pointer where the hit really lands. Without this, the Sun tooltip does not appear and the heatmap picks the wrong row. Real visitors are not affected (browser zoom works differently).
- `render.sh` expects ffmpeg at `C:/ffmpeg/bin/ffmpeg`. To use another copy, set `FFMPEG=/path/to/ffmpeg`.
