#!/usr/bin/env bash
# Builds the synthetic voiceover (out/voice.wav, 29.5 s) from lines.txt.
# Voice: Microsoft neural text-to-speech (en-GB-RyanNeural) through the
# edge-tts Python package (pip install edge-tts). No person's voice is used.
# Each line is trimmed of silence and placed at its start time below, which
# record.mjs and docs/video-subtitles.srt are timed to.
set -euo pipefail
cd "$(dirname "$0")"
FFMPEG=${FFMPEG:-/c/ffmpeg/bin/ffmpeg}
STARTS=(0.3 6.2 14.8 20.7 26.1)   # seconds; one per line of lines.txt
mkdir -p ../out
i=0
while IFS= read -r line; do
  i=$((i+1))
  py -3 -m edge_tts --voice en-GB-RyanNeural --rate=+8% --text "$line" --write-media "raw$i.mp3"
  "$FFMPEG" -v error -y -i "raw$i.mp3" -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" -ar 48000 -ac 1 "t$i.wav"
done < lines.txt
inputs=(); filt=""; mix=""
for n in 1 2 3 4 5; do
  ms=$(py -3 -c "print(int(${STARTS[$((n-1))]}*1000))")
  inputs+=(-i "t$n.wav"); filt+="[$((n-1)):a]adelay=${ms}:all=1[a$n];"; mix+="[a$n]"
done
"$FFMPEG" -v error -y "${inputs[@]}" -filter_complex "${filt}${mix}amix=inputs=5:normalize=0,apad=whole_dur=29.5,atrim=0:29.5[out]" -map "[out]" -ar 48000 ../out/voice.wav
echo "wrote out/voice.wav"
