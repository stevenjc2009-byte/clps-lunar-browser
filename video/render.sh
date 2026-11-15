#!/usr/bin/env bash
# Turns out/raw.webm (from record.mjs) into the final demo video: trims the
# page-load lead-in, cuts at exactly 29.5 s, burns in the English subtitles
# from docs/video-subtitles.srt and a visible AI watermark, and adds the
# synthetic voiceover built by voice/make.sh (text-to-speech, no real voice).
#
#   node record.mjs && bash render.sh      -> ../docs/demo-video.mp4
set -euo pipefail
cd "$(dirname "$0")"
bash voice/make.sh
cd out
FFMPEG=${FFMPEG:-/c/ffmpeg/bin/ffmpeg}
cp ../../docs/video-subtitles.srt captions.srt
T0=$(cat t0.txt)

# The filter lives in a file so the Windows font path needs no shell quoting.
cat > filter.txt <<'EOF'
fps=30,
pad=1920:1080:0:0:color=0x0a0f1e,
subtitles=captions.srt:force_style='FontName=Segoe UI,Fontsize=15,Bold=1,PrimaryColour=&H00FFFFFF,BorderStyle=3,Outline=6,BackColour=&H00000000,OutlineColour=&H22000000,Shadow=0,MarginV=18',
drawtext=fontfile='C\:/Windows/Fonts/segoeuib.ttf':text='AI-made video (Claude) - screen recording + synthetic TTS voice':fontsize=22:fontcolor=white:box=1:boxcolor=0x000000@0.65:boxborderw=8:x=w-tw-24:y=h-th-14
EOF

"$FFMPEG" -v error -y -ss "$T0" -i raw.webm -i voice.wav -t 29.5 -filter_script:v filter.txt -map 0:v -map 1:a \
  -c:a aac -b:a 160k -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart ../../docs/demo-video.mp4
echo "wrote docs/demo-video.mp4"
