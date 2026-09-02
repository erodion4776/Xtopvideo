const EXAMPLES = {
    memorial: `<!DOCTYPE html>
<html>
<head>
<style>
body {
    margin: 0;
    color: white;
    font-family: 'Georgia', serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 60px 40px;
    box-sizing: border-box;
    overflow: hidden;
}
h1 {
    color: #d4af37;
    font-size: 68px;
    font-weight: normal;
    letter-spacing: 3px;
    text-shadow: 0 4px 20px rgba(0,0,0,0.8);
    margin: 0;
}
.subtitle {
    color: #ddd;
    font-size: 24px;
    letter-spacing: 5px;
    text-transform: uppercase;
    margin-top: 10px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.9);
}
#caption {
    background: rgba(0,0,0,0.75);
    color: white;
    padding: 20px 40px;
    border-radius: 8px;
    font-size: 42px;
    line-height: 1.4;
    text-align: center;
    max-width: 85%;
    opacity: 0;
    transition: opacity 0.4s;
    text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
    border: 1px solid rgba(212, 175, 55, 0.3);
}
.header { text-align: center; }
</style>
</head>
<body>
<div class="header">
    <h1>In Loving Memory</h1>
    <div class="subtitle">Forever In Our Hearts</div>
</div>
<div id="caption"></div>
<div style="height:20px;"></div>
<script>
const captions = [
    { start: 11, end: 13, text: "We remember you" },
    { start: 14, end: 16, text: "Today, Dad" },
    { start: 17, end: 19, text: "With every breath" },
    { start: 20, end: 22, text: "We take" },
    { start: 23, end: 25, text: "Not just for how you left us" },
    { start: 26, end: 31, text: "But the hearts you left to ache" },
    { start: 32, end: 41, text: "But for how deeply you loved us" },
    { start: 42, end: 45, text: "A light that never dies" },
    { start: 46, end: 51, text: "We saw your strength through every pain" },
    { start: 52, end: 57, text: "Within your weary eyes" },
    { start: 58, end: 65, text: "Your love still holds us close" },
    { start: 66, end: 70, text: "Even though you've flown away" },
    { start: 71, end: 76, text: "We miss your voice, your laughter" },
    { start: 77, end: 81, text: "In every single day" },
    { start: 82, end: 94, text: "Forever in our hearts" }
];
window.__updateAtTime = function(time) {
    const el = document.getElementById('caption');
    if (!el) return;
    const active = captions.find(c => time >= c.start && time <= c.end);
    if (active) {
        if (el.textContent !== active.text) el.textContent = active.text;
        el.style.opacity = '1';
    } else {
        el.style.opacity = '0';
    }
};
</script>
</body>
</html>`,

    karaoke: `<!DOCTYPE html>
<html>
<head>
<style>
body {
    margin: 0;
    color: white;
    font-family: 'Arial Black', sans-serif;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}
#caption {
    text-align: center;
    font-size: 72px;
    font-weight: 900;
    line-height: 1.3;
    max-width: 85%;
    text-shadow: 0 0 30px rgba(0,0,0,0.9);
}
.word {
    display: inline-block;
    margin: 0 8px;
    color: white;
    transition: all 0.2s;
}
.word.active {
    color: #ffe600;
    transform: scale(1.2);
    text-shadow: 0 0 40px rgba(255,230,0,0.9);
}
</style>
</head>
<body>
<div id="caption"></div>
<script>
const captions = [
    { start: 0, end: 4, text: "Turn your dreams into reality" },
    { start: 4, end: 8, text: "Never give up on yourself" },
    { start: 8, end: 12, text: "Rise above every challenge" }
];
window.__updateAtTime = function(time) {
    const el = document.getElementById('caption');
    if (!el) return;
    const active = captions.find(c => time >= c.start && time <= c.end);
    if (!active) { el.innerHTML = ''; return; }
    const words = active.text.split(' ');
    const wordDur = (active.end - active.start) / words.length;
    const idx = Math.min(Math.floor((time - active.start) / wordDur), words.length - 1);
    el.innerHTML = words.map((w, i) => 
        '<span class="word ' + (i <= idx ? 'active' : '') + '">' + w + '</span>'
    ).join('');
};
</script>
</body>
</html>`,

    quote: `<!DOCTYPE html>
<html>
<head>
<style>
body {
    margin: 0;
    color: white;
    font-family: 'Georgia', serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    box-sizing: border-box;
}
.mark { font-size: 200px; color: #ffd700; line-height: 1; opacity: 0.3; }
#caption {
    font-size: 52px;
    line-height: 1.5;
    font-style: italic;
    text-align: center;
    max-width: 900px;
    opacity: 0;
    transition: opacity 0.5s;
    text-shadow: 0 4px 20px rgba(0,0,0,0.8);
}
.author { margin-top: 40px; font-size: 28px; color: #ffd700; letter-spacing: 3px; }
</style>
</head>
<body>
<div class="mark">"</div>
<div id="caption"></div>
<div class="author">— Author</div>
<script>
const captions = [
    { start: 0, end: 4, text: "The only way to do great work is to love what you do." },
    { start: 4, end: 8, text: "If you haven't found it yet, keep looking." },
    { start: 8, end: 12, text: "Don't settle." }
];
window.__updateAtTime = function(time) {
    const el = document.getElementById('caption');
    if (!el) return;
    const active = captions.find(c => time >= c.start && time <= c.end);
    if (active) {
        if (el.textContent !== active.text) el.textContent = active.text;
        el.style.opacity = '1';
    } else {
        el.style.opacity = '0';
    }
};
</script>
</body>
</html>`
};
