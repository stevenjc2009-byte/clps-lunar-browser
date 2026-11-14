# 30-second demo video

**File:** `docs/demo-video.mp4`. It is 29.5 seconds long, 1920×1080, 30 fps, H.264, with **no sound**. The English subtitles are burned into the picture.

## Rules the video meets (official 2026 guide)

- **30 seconds or less:** 29.5 s, checked with ffprobe.
- **English subtitles:** burned in, from `video-subtitles.srt`.
- **No NASA logo** or other NASA branding.
- **No photos, video or voices of any person.** At least one team member is under 18, so the video is a silent screen recording of the site only.
- **AI watermark.** An AI assistant (Claude) scripted and recorded the video automatically, so a visible line sits in the bottom-right corner the whole time: "AI-made video (Claude) - automated screen recording".
- **Still to do by the team:** upload it publicly (for example YouTube unlisted, or Google Drive with "anyone with the link"), so it opens without a login. Then paste the link into the Project Page's "Link to Project Demo" field. It cannot be uploaded to the Space Apps site itself.

## What it shows

Recorded from the new app (7 sites, terrain skyline), 29.5 s, silent.

| Time | Caption | Screen |
|---|---|---|
| 0:00-0:03 | The Big Four: Lunar Landing Site Navigator | Top of the page |
| 0:03-0:06 | Real NASA LOLA terrain skyline | Sky graph with the grey terrain shape |
| 0:06-0:09 | Sun dots behind hills are hidden | Pointer moves over the sky graph |
| 0:09-0:12.5 | Seven sites, one date, compared | The comparison cards |
| 0:12.5-0:15.5 | Rim and ridge: about 86% Sun | Pointer on the Shackleton rim verdict |
| 0:15.5-0:19.5 | Too close to call? We say so | The "too close to call" notes |
| 0:19.5-0:22 | Best landing dates, day by day | Best landing dates heatmap |
| 0:22-0:25 | Click a day to set the date | "Use this date" pressed, date marker moves |
| 0:25-0:27.5 | Model presets and DSN link check | Model settings panel |
| 0:27.5-0:29.5 | Share this exact view with one link | "Copy link" pressed |

## How to remake it

The video is made by two scripts in `video/`, from the app served locally (`npx vite preview --port 5197` in `frontend/`; `record.mjs` takes any URL as an argument):

```
cd video
npm install
npx playwright install chromium-headless-shell
node record.mjs        # headless Chromium records out/raw.webm, with every action pinned to a time
bash render.sh         # ffmpeg: trim, cut at 29.5 s, caption band, subtitles, watermark -> docs/demo-video.mp4
```

`render.sh` expects ffmpeg at `C:/ffmpeg/bin/ffmpeg`. To use another copy, set `FFMPEG=/path/to/ffmpeg`.
