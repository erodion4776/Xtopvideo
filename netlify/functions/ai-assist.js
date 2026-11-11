const crypto = require("node:crypto");

const recentCalls = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 10;
const ALLOWED_VOICES = new Set([
  "Kore", "Puck", "Charon", "Aoede", "Fenrir", "Zephyr"
]);

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0"
    },
    body: JSON.stringify(payload)
  };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && left.length > 0 &&
    crypto.timingSafeEqual(left, right);
}

function extractText(data) {
  return (data && data.candidates || [])
    .flatMap(candidate => candidate.content && candidate.content.parts || [])
    .map(part => part.text || "")
    .join("\n")
    .trim();
}

async function callGeminiText(apiKey, model, prompt, jsonMode) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You are the AI writing assistant inside XTOP Video Studio. Be concise, accurate, creative, and never invent factual details that the user did not provide."
          }]
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: jsonMode ? 1200 : 300,
          ...(jsonMode ? { responseMimeType: "application/json" } : {})
        }
      }),
      signal: AbortSignal.timeout(45000)
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 429
      ? "Gemini free-tier rate limit reached. Wait a little and try again."
      : response.status === 401 || response.status === 403
        ? "Gemini rejected the API key or model access. Check the key in Google AI Studio."
        : "Gemini text generation failed. Check the configured model and try again.";
    const error = new Error(message);
    error.statusCode = response.status === 429 ? 429 : 502;
    throw error;
  }

  const text = extractText(data);
  if (!text) {
    const error = new Error("Gemini returned no text. Please try again.");
    error.statusCode = 502;
    throw error;
  }
  return text;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Use POST for AI requests." });
  }

  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
  );
  const origin = headers.origin;
  const host = (headers["x-forwarded-host"] || headers.host || "").split(",")[0].trim();
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return reply(403, { error: "Cross-origin AI requests are not allowed." });
      }
    } catch (_) {
      return reply(403, { error: "Invalid request origin." });
    }
  }

  const password = process.env.XTOP_STUDIO_AI_PASSWORD;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!password) {
    return reply(503, {
      error: "AI is not configured yet. Add XTOP_STUDIO_AI_PASSWORD in Netlify environment variables."
    });
  }
  if (!safeEqual(headers["x-studio-password"], password)) {
    return reply(401, { error: "Enter the correct XTOP Studio AI access password." });
  }
  if (!apiKey) {
    return reply(503, {
      error: "Gemini is not connected yet. Add GEMINI_API_KEY in Netlify environment variables."
    });
  }

  const ip = headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const recent = (recentCalls.get(ip) || []).filter(time => now - time < WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    return reply(429, { error: "AI request limit reached for this connection. Wait 10 minutes and try again." });
  }
  recent.push(now);
  recentCalls.set(ip, recent);

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "");
    if (Buffer.byteLength(raw, "utf8") > 12000) {
      return reply(413, { error: "AI request is too large. Shorten the text and try again." });
    }
    body = JSON.parse(raw || "{}");
  } catch (_) {
    return reply(400, { error: "Invalid JSON request." });
  }

  const action = body.action;
  const textModel = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash-lite";
  const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";

  if (action === "status") {
    return reply(200, {
      configured: true,
      provider: "Google Gemini",
      textModel,
      ttsModel
    });
  }

  try {
    if (action === "caption") {
      const brief = String(body.brief || "").trim();
      if (!brief || brief.length > 1800) {
        return reply(400, { error: "Enter a video description between 1 and 1,800 characters." });
      }
      const platform = String(body.platform || "General").slice(0, 40);
      const tone = String(body.tone || "Natural").slice(0, 40);
      const text = await callGeminiText(
        apiKey,
        textModel,
        "Write one polished social-video caption for " + platform +
          ". Tone: " + tone + ". Base it only on this brief. Do not invent prices, dates, claims, names, or offers. " +
          "Keep it engaging and concise, with at most 4 relevant hashtags. Return only the caption.\n\nBrief:\n" + brief,
        false
      );
      return reply(200, { ok: true, text });
    }

    if (action === "split") {
      const script = String(body.script || "").trim();
      if (!script || script.length > 7000) {
        return reply(400, { error: "Enter a script between 1 and 7,000 characters." });
      }
      const raw = await callGeminiText(
        apiKey,
        textModel,
        "Split the following spoken script into short subtitle cues for a video. Preserve the original wording and order; do not add or remove information. Each cue should be easy to read, normally 3–8 words and no more than 42 characters. Return ONLY a JSON object in this exact shape: {\"segments\":[\"cue one\",\"cue two\"]}. Use no more than 60 cues.\n\nSCRIPT:\n" + script,
        true
      );
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/^\uFEFF/, "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
      } catch (_) {
        const error = new Error("AI could not format the subtitle cues. Please try again.");
        error.statusCode = 502;
        throw error;
      }
      const segments = Array.isArray(parsed.segments)
        ? parsed.segments.map(item => String(item).trim()).filter(Boolean).slice(0, 60)
        : [];
      if (!segments.length) {
        const error = new Error("AI returned no subtitle cues. Please try again.");
        error.statusCode = 502;
        throw error;
      }
      return reply(200, { ok: true, segments });
    }

    if (action === "voiceover") {
      const input = String(body.text || "").trim();
      if (!input || input.length > 1800) {
        return reply(400, { error: "Enter voiceover text between 1 and 1,800 characters." });
      }
      const voice = ALLOWED_VOICES.has(body.voice) ? body.voice : "Kore";
      const style = String(body.style || "Warm, clear, natural narration").slice(0, 240);
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: ttsModel,
          input: [{
            type: "user_input",
            content: [{
              type: "text",
              text: input,
              annotations: [{
                type: "speech_metadata",
                style
              }]
            }]
          }],
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [{ voice }]
          }
        }),
        signal: AbortSignal.timeout(90000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 429
          ? "Gemini voice quota or rate limit reached. Try again later."
          : "Gemini voice generation failed. Check the TTS model and API key permissions.";
        const error = new Error(message);
        error.statusCode = response.status === 429 ? 429 : 502;
        throw error;
      }
      const blocks = (data.steps || []).flatMap(step => step.content || []);
      const audio = data.output_audio && data.output_audio.data ||
        (blocks.find(block => block.type === "audio" && block.data) || {}).data ||
        (blocks.find(block => block.data) || {}).data;
      if (!audio) {
        const error = new Error("Gemini returned no voiceover audio. Please try again.");
        error.statusCode = 502;
        throw error;
      }
      if (audio.length > 5200000) {
        return reply(413, { error: "Generated voiceover is too large for this browser export. Shorten the script." });
      }
      return reply(200, { ok: true, mime: "audio/wav", audio });
    }

    return reply(400, { error: "Unknown AI action." });
  } catch (error) {
    return reply(error.statusCode || 502, {
      error: error.message || "AI request failed. Please try again."
    });
  }
};
