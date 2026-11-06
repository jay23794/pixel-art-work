#!/usr/bin/env bash
# Build a study and export it as a 1080×1920 MP4 reel (or a 3× still PNG).
#
#   art/scripts/reel.sh <study> [seconds=10] [--still] [--asset NAME]
#   art/scripts/reel.sh --scene art/scenes/<file>.json [seconds]
#
# <study>    art/studies/<study>.px.js. Which asset is exported:
#              MP4:     <study>_loop if the study has it, else <study>, else every anim in it
#                       (reels/<anim>.mp4).
#              --still: <study>, else every anim's first frame.
# seconds    reel length; must be a whole number of animation cycles. The cycle is the anim's
#            frames / fps (24 f @ 12 fps = 2 s, 48 f @ 12 fps = 4 s); other lengths fail.
# --still    export art/out/reels/<study>.png (1080×1920, 3×) instead of an MP4.
# --asset    export another asset from the study file (e.g. its anim) as reels/<asset>.*
# --scene    a night scene JSON (art/scenes/README.md): validates it, builds it through
#            art/lib/night_scene.px.js, and exports both reels/<name>.png and reels/<name>_loop.mp4
#            (seconds default: the shortest whole number of cycles ≥ 10 s), with every check below
#            plus the motion budget against the scene's motion.budget target.
#
# Every run checks that every pixel of every frame is a palette colour (fails otherwise), and, if
# the study defines a part _<asset>_static, that its opaque pixels never change (fails otherwise).
# Loops also get a motion-budget report: % of screen pixels changing per frame (targets in
# art/CLAUDE.md; reported, never fails).
set -euo pipefail

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

study="" seconds="" still=0 asset="" scene="" target=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --still) still=1 ;;
    --asset) asset="${2:?--asset needs a name}"; shift ;;
    --scene) scene="${2:?--scene needs a JSON file}"; shift ;;
    -h|--help) usage ;;
    -*) echo "unknown option: $1" >&2; usage ;;
    *) if [[ -z "$study" ]]; then study="$1"; else seconds="$1"; fi ;;
  esac
  shift
done
if [[ -n "$scene" ]]; then
  [[ -z "$study" ]] || seconds="$study" # with --scene the only positional is the length
  study=""
fi
[[ -n "$study" || -n "$scene" ]] || usage
[[ -z "$seconds" || "$seconds" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "error: seconds must be a number, got '$seconds'" >&2; exit 2; }

ART="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$ART/.." && pwd)"
PXL="$ROOT/.claude/skills/pxl-pixel-art/bin/pxl.js"
OUT="$ART/out"
REELS="$OUT/reels"
if [[ -n "$scene" ]]; then
  # scene.mjs validates the JSON (clear errors, exit 2) and writes the wrapper study.
  info="$(node "$ART/scripts/scene.mjs" "$scene")" || exit 2
  echo "$info" | grep -v '^scene '
  read -r _ study FILE _ cycle _ bname blo bhi <<<"$(grep '^scene ' <<<"$info")"
  target="$bname:$blo:$bhi"
  if [[ -z "$seconds" ]]; then seconds="$(node -e "const c=$cycle; console.log(Math.ceil(10 / c) * c)")"; fi
else
  FILE="$ART/studies/$study.px.js"
  [[ -f "$FILE" ]] || { echo "error: no study at $FILE" >&2; exit 2; }
fi
seconds="${seconds:-10}"
command -v ffmpeg >/dev/null || { echo "error: ffmpeg not found" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$REELS"

export_asset() {
  local asset="$1"
  # 1. Build (writes scenes/, anims/ and _preview/ under art/out).
  node "$PXL" build "$FILE" --out "$OUT" --only "$asset"

  # 2. Palette check + frames.
  if [[ $still == 1 ]]; then
    node "$ART/scripts/frames.mjs" "$FILE" "$asset" --first "$TMP/still.png"
    ffmpeg -v error -y -i "$TMP/still.png" -vf "format=rgb24,scale=1080:1920:flags=neighbor" -pix_fmt rgb24 "$REELS/$asset.png"
    echo "-> $REELS/$asset.png"
    return
  fi
  rm -rf "$TMP/seq"
  node "$ART/scripts/frames.mjs" "$FILE" "$asset" --seconds "$seconds" --dir "$TMP/seq" ${target:+--target "$target"}

  # 3. Encode. pxl writes palette-indexed PNGs; converting to rgb24 before scaling keeps the
  #    colours exact (ffmpeg's direct pal8 scaling is off by ±1 per channel).
  ffmpeg -v error -y -framerate 24 -i "$TMP/seq/%05d.png" \
    -vf "format=rgb24,scale=1080:1920:flags=neighbor" \
    -c:v libx264 -pix_fmt yuv420p -crf 20 -r 24 -movflags +faststart \
    "$REELS/$asset.mp4"
  echo "-> $REELS/$asset.mp4"
}

if [[ -n "$scene" ]]; then
  still=1; export_asset "$study"
  still=0; export_asset "${study}_loop"
elif [[ -n "$asset" ]]; then
  export_asset "$asset"
else
  # Assets in the study: "<kind> <name> <file:line>" per line.
  list="$(node "$PXL" list "$FILE")"
  has() { awk -v n="$1" '$2 == n { found = 1 } END { exit !found }' <<<"$list"; }
  if [[ $still == 0 ]] && has "${study}_loop"; then
    export_asset "${study}_loop" # a study with both <study> and <study>_loop: the reel is the loop
  elif has "$study"; then
    export_asset "$study"
  else
    anims="$(awk '$1 == "anim" && $2 !~ /^_/ { print $2 }' <<<"$list")"
    [[ -n "$anims" ]] || { echo "error: no asset '$study' and no anims in $FILE" >&2; exit 2; }
    for a in $anims; do export_asset "$a"; done
  fi
fi
