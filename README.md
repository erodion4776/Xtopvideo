# XTOP Video Studio

A mobile-first browser video editor. The app is a standalone HTML/CSS/JavaScript project; the main editor is `studio.html` and `index.html` opens it.

## Current editor features

- Import and select multiple video clips.
- Trim the selected clip and arrange a sequential clip timeline.
- Preview playback, aspect ratios, filters and playback speed.
- Background music and a separate AI voiceover track.
- Editable text overlays and timed subtitles.
- Edit/remove subtitle cues and export SRT.
- 120 transition presets and 120 visual-effect presets.
- WebM export with canvas rendering, text/subtitle overlays, audio mixing and transitions.
- AI-assisted titles, captions, hashtags, content packs and edit suggestions.
- AI speech-to-text subtitles from a selected video.
- AI voiceover generation.
- AI image generation and AI video generation (Google paid models; direct Gemini key required).

## Run locally

Open `index.html` or `studio.html` in a modern browser. Video preview and WebM export work best in current Chrome-based browsers. Some mobile devices may restrict codecs, memory, long recordings or media playback.

The secure AI proxy is a Netlify Function, so AI server-proxy features require a Netlify deployment. Opening the files directly from local storage does not run the function.

## Deploy to Netlify

1. Import this GitHub repository into Netlify.
2. Use the repository root as the publish directory (`.`).
3. Keep the functions directory as `netlify/functions` (already configured in `netlify.toml`).
4. Add the AI environment variables described in [AI_SETUP.md](AI_SETUP.md).
5. Deploy, then open the site and check the secure AI connection.

Do not put API keys in repository files. Do not treat a successful GitHub commit as proof that the Netlify site or its functions have deployed.

## AI setup and cost controls

Read [AI_SETUP.md](AI_SETUP.md) before enabling AI. It explains the server-side Gemini key, the private Studio password, the optional personal key needed for large media requests, free-tier data handling, and paid image/video-generation costs.

## Export limitations

The current editor exports WebM through browser MediaRecorder. MP4 conversion is not yet implemented in this editor. MP4 support, long-form export reliability, project save/load and full multi-track audio editing remain future work.
