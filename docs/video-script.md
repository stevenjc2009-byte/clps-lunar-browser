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

| Time | Caption | Screen |
|---|---|---|
| 0:00-0:03 | We're The Big Four, for the Lunar Landing Site Navigator challenge. | Top of the live site |
| 0:03-0:08 | At the Moon's south pole, the Sun skims the horizon. Landers need sunlight for power and Earth in view to call home. | Sky graph for Shackleton rim |
| 0:08-0:11 | This is CLPS Lunar Mission Browser. | Scroll up to the controls |
| 0:11-0:18 | Pick a landing date and compare sites: sunlight, Earth time, longest night and a verdict, from NASA JPL data. | Date set to 10 Jun 2027, look-ahead switched to 30 days, cards update |
| 0:18-0:22 | See when the Sun and Earth next rise or set after landing. | The after-landing lines on each card are outlined |
| 0:22-0:26 | Add any spot on the Moon of your own. | "Add to comparison" is pressed and a fourth card appears |
| 0:26-0:29.5 | Students can press "Explain it to me". Clearer landing choices, for everyone. | "Explain it to me" is pressed and the notes open |

## How to remake it

The video is made by two scripts in `video/`, from the live site:

```
cd video
npm install
npx playwright install chromium-headless-shell
node record.mjs        # headless Chromium records out/raw.webm, with every action pinned to a time
bash render.sh         # ffmpeg: trim, cut at 29.5 s, caption band, subtitles, watermark -> docs/demo-video.mp4
```

`render.sh` expects ffmpeg at `C:/ffmpeg/bin/ffmpeg`. To use another copy, set `FFMPEG=/path/to/ffmpeg`.
