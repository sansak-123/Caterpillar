#!/bin/sh
# Copies the Unity WebGL build into the app so Expo web serves it at /sim/index.html
# Usage (from mobile/):  sh scripts/copy-sim.sh ~/Desktop/hackathon-web/sim
set -e
SRC="${1:-../unity/OperatorSim/BuildWebGL}"
if [ ! -f "$SRC/index.html" ]; then echo "No index.html in $SRC - point this at the folder that holds index.html and Build/"; exit 1; fi
rm -rf public/sim
mkdir -p public/sim
cp -R "$SRC"/. public/sim/
echo "Copied $SRC -> mobile/public/sim"
