# 🎬 Audio to Video Creator

Convert audio + captions into beautiful videos — right in the browser.

## Features
- 🎵 Audio upload (MP3, WAV)
- 📝 Timed captions with 5 animations
- 🎨 Gradient / Solid / Image / Video backgrounds
- 📚 Multiple text layers
- 🌊 Waveform visualizer
- 📹 Export as WebM or MP4 (FFmpeg.wasm)
- 📄 SRT import support
- 🤖 Auto-split script to captions

## Deploy to Netlify

### Option 1: Drag & Drop
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this folder onto the page
3. Done! ✅

### Option 2: GitHub
1. Push this folder to a GitHub repo
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "Add new site" → "Import from Git"
4. Connect your repo
5. Build settings: **none** (it's static)
6. Publish directory: `.`
7. Click Deploy! 🚀

## Important
The `netlify.toml` and `_headers` files are **required** for MP4 export
(FFmpeg.wasm needs COOP/COEP headers).
