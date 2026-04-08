#!/usr/bin/env bash
#
# sprite-atlas-generator.sh
# Generates sprite atlases from frame sequences
# Usage: ./sprite-atlas-generator.sh <input-folder> <output-prefix>
#

set -euo pipefail

INPUT_FOLDER="${1:-}"
OUTPUT_PREFIX="${2:-atlas}"

if [[ -z "$INPUT_FOLDER" ]] || [[ ! -d "$INPUT_FOLDER" ]]; then
    echo "Error: Invalid input folder '$INPUT_FOLDER'" >&2
    exit 1
fi

echo "Processing frames from: $INPUT_FOLDER"

# Collect PNG files sorted numerically (handles 00000.png, 00001.png etc.)
mapfile -d '' FILES < <(find "$INPUT_FOLDER" -maxdepth 1 -name "*.png" -type f -print0 | sort -zV)

FRAME_COUNT=${#FILES[@]}
if (( FRAME_COUNT == 0 )); then
    echo "No PNG files found in $INPUT_FOLDER" >&2
    exit 1
fi

echo "Found $FRAME_COUNT frame(s)"

# Get dimensions of first frame to establish uniform size
FIRST_FRAME_DIMS=$(identify -format "%wx%h" "${FILES[0]}" 2>/dev/null)
IFS='x' read -r WIDTH HEIGHT <<< "$FIRST_FRAME_DIMS"
echo "Frame dimensions: ${WIDTH}x${HEIGHT}"

# Calculate optimal grid layout (square-ish aspect ratio)
GRID_COLS=$(awk "BEGIN {printf \"%d\", sqrt($FRAME_COUNT) + 0.5}")
GRID_ROWS=$(( (FRAME_COUNT + GRID_COLS - 1) / GRID_COLS ))

echo "Grid layout: ${GRID_COLS} columns × ${GRID_ROWS} rows"

# Create atlas using montage with zero spacing (tight packing)
ATLAS_FILE="${OUTPUT_PREFIX}.png"
montage \
    "${FILES[@]}" \
    -tile "${GRID_COLS}x${GRID_ROWS}" \
    -geometry "+0+0" \
    -background transparent \
    "$ATLAS_FILE"

echo "Atlas created: $ATLAS_FILE ($(stat -c%s "$ATLAS_FILE") bytes)"

# Generate JSON metadata
METADATA_FILE="${OUTPUT_PREFIX}.json"
{
    echo "{"
    echo '  "frames": ['
    
    # Normalize to texture space
    TEX_WIDTH=$((${GRID_COLS} * WIDTH))
    TEX_HEIGHT=$((${GRID_ROWS} * HEIGHT))
    
    for i in "${!FILES[@]}"; do
        COL=$((i % GRID_COLS))
        ROW=$((i / GRID_COLS))
        
        X=$((COL * WIDTH))
        Y=$((ROW * HEIGHT))
        
        # Add comma between entries (except first)
        if (( i > 0 )); then
            printf ",\n"
        fi
        
        printf '    {"index": %d, "x": %d, "y": %d, "w": %d, "h": %d}' "$i" "$X" "$Y" "$WIDTH" "$HEIGHT"
    done
    
    echo ""
    echo "  ],"
    printf '  "atlas": {"image_src":"%s", "size": {"width": %d, "height": %d}}\n' "$(basename "$ATLAS_FILE")" "$TEX_WIDTH" "$TEX_HEIGHT"
    echo "}"
} > "$METADATA_FILE"

echo "Metadata created: $METADATA_FILE"

# Summary
cat << EOF

=== Atlas Generation Complete ===
Input folder:     $INPUT_FOLDER
Output atlas:     $ATLAS_FILE
Output metadata:  $METADATA_FILE
Grid layout:      ${GRID_COLS} × ${GRID_ROWS} (${FRAME_COUNT} frames)
Frame size:       ${WIDTH}×${HEIGHT} pixels
Atlas size:       ${TEX_WIDTH}×${TEX_HEIGHT} pixels
EOF
