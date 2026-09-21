#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="public/models/source"
OUTPUT_DIR="public/models"
TEXTURE_SIZE="${TEXTURE_SIZE:-1024}"

if ! command -v gltf-transform >/dev/null 2>&1; then
  echo "gltf-transform CLI was not found. Run: npm install" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

shopt -s nullglob
models=("$SOURCE_DIR"/*.glb)

if (( ${#models[@]} == 0 )); then
  echo "No .glb files found in $SOURCE_DIR" >&2
  exit 0
fi

for source_file in "${models[@]}"; do
  file_name="$(basename "$source_file")"
  output_file="$OUTPUT_DIR/$file_name"

  echo "Compressing $source_file -> $output_file"
  gltf-transform optimize "$source_file" "$output_file" \
    --compress draco \
    --texture-compress ktx2 \
    --texture-size "$TEXTURE_SIZE"
done

echo "Compressed ${#models[@]} GLB model(s) into $OUTPUT_DIR"
