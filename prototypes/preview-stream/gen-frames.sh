#!/bin/sh
# Pre-render a 10 s testsrc into JPEG sequences (node-canvas is not installed here).
set -e
cd "$(dirname "$0")"
for size in 320x180 640x360; do
  dir="frames/$size"
  rm -rf "$dir"; mkdir -p "$dir"
  ffmpeg -v error -f lavfi -i "testsrc2=size=$size:rate=15:duration=10" -q:v 5 "$dir/%03d.jpg"
  echo "$size: $(ls "$dir" | wc -l | tr -d ' ') frames, $(du -sk "$dir" | cut -f1) kB"
done
