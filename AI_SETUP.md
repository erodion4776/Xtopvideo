# XTOP Video Studio — AI setup

The AI tools use Google Gemini. The API key is kept in a Netlify Function for normal text generation and voiceovers; it is not embedded in the page source.

## 1. Deploy the repository through Netlify

Connect `erodion4776/Xtopvideo` to Netlify and publish the repository root (`.`). The repository's `netlify.toml` points Netlify to `netlify/functions`.

A static GitHub Pages deployment will not run this server function. Do not paste a Gemini API key into GitHub files.

## 2. Create a Gemini API key

1. Open [Google AI Studio API keys](https://aistudio.google.com/api-keys).
2. Create a key for the Gemini API.
3. Keep it private. Do not put it in `studio.html`, GitHub, or a public message.

## 3. Add Netlify environment variables

In the Netlify site dashboard, open **Site configuration → Environment variables** and add:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Your private Google AI Studio key |
| `XTOP_STUDIO_AI_PASSWORD` | A strong, private password that you choose |

Optional model overrides:

| Variable | Default |
|---|---|
| `GEMINI_TEXT_MODEL` | `gemini-3.8-flash` |
| `GEMINI_TTS_MODEL` | `gemini-3.8-flash-tts` |

Set the variables in Netlify's dashboard, not in `netlify.toml`. Make sure the variables are available to Functions. Trigger a new deploy after saving them so the function receives the updated values.

## 4. Connect the editor

1. Open `studio.html` on the Netlify site.
2. In **XTOP AI Creative Assistant**, enter the value you chose for `XTOP_STUDIO_AI_PASSWORD`.
3. Tap **Check secure AI connection**.
4. Use the AI content generator, timed subtitles, or AI voiceover.

The Gemini API key remains server-side for these normal requests.

## 5. Large media and image/video generation

Netlify Functions have a 6 MB buffered request/response limit. Base64 encoding reduces the practical binary upload ceiling to roughly 4.5 MB. XTOP routes small AI requests through the secure function. For larger selected-video uploads, the editor offers an optional personal Gemini key used directly from the current browser tab.

The same optional personal key is required for AI image and AI video generation because their media payloads can exceed the serverless function response limit. That direct key is held only in the page's JavaScript memory and input field; it is not saved to GitHub or browser storage. Use it only on a device you trust, and clear the field when finished. It is not suitable for a shared public kiosk.

**Cost warning:** Gemini text generation and Gemini 3.8 Flash TTS currently list a free tier, subject to quotas. Gemini 3.1 Flash Image has no free API tier and currently costs about **US$0.067 per 1K image**. Gemini Omni Flash video generation is paid-only and is approximately **US$0.10 per second of 720p video**. The editor asks for confirmation before starting image or video generation. Check Google's live pricing and your account's limits before use.

**Privacy:** Google's pricing page marks free-tier content as being used to improve its products. Avoid sending private, confidential, customer, or sensitive video/audio/text through the free tier. Paid-tier data handling differs; check Google's current terms.

## Current AI features

- Gemini-assisted video titles, captions, hashtags, scripts, content packs and edit suggestions.
- AI speech transcription into timed SRT subtitle cues from a selected video.
- AI voiceover generation with selectable voice and delivery style; voiceover is kept as a separate audio track alongside music.
- AI image generation, with an option to place the image over the video and include it in WebM export.
- AI video generation, with the generated clip added to the video timeline.

Large uploads, model availability, regional access, free-tier quotas and paid billing can affect individual requests. A successful GitHub commit does not mean the Netlify function is deployed or that your Gemini account has been configured.

## Official references

- [Google AI Studio API keys](https://aistudio.google.com/api-keys)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini video generation and editing](https://ai.google.dev/gemini-api/docs/omni)
- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Netlify Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Netlify Functions configuration and payload limits](https://docs.netlify.com/build/functions/configuration/)
