const TEMPLATES = {

memorial: `<!-- 🕊️ MEMORIAL TRIBUTE -->
<!-- Upload your photos as scenes, they auto-fill scene1, scene2... -->
<style>
    body {
        margin: 0; width: 100%; height: 100%;
        font-family: 'Georgia', serif;
        color: white;
        overflow: hidden;
    }

    /* === SCENE SYSTEM === */
    .scene {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0;
        transition: opacity 1.5s ease-in-out;
    }
    .scene.active {
        opacity: 1;
    }
    .scene::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.45);
    }

    /* === HEADER === */
    .header {
        position: absolute;
        top: 50px;
        left: 0; right: 0;
        text-align: center;
        z-index: 20;
    }
    .header h1 {
        font-size: 62px;
        font-weight: normal;
        color: #d4af37;
        text-shadow: 0 4px 20px rgba(0,0,0,0.8);
        margin: 0;
    }
    .header .sub {
        font-size: 20px;
        color: #ccc;
        letter-spacing: 6px;
        text-transform: uppercase;
        margin-top: 8px;
    }

    /* === CAPTION === */
    #caption {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 30;
        background: rgba(0,0,0,0.7);
        padding: 16px 36px;
        border-radius: 8px;
        font-size: 40px;
        text-align: center;
        max-width: 85%;
        opacity: 0;
        transition: opacity 0.4s;
        text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
        border: 1px solid rgba(212,175,55,0.25);
    }

    /* === PROGRESS BAR === */
    #progress {
        position: absolute;
        bottom: 0; left: 0;
        height: 5px;
        background: #d4af37;
        z-index: 40;
        transition: width 0.2s linear;
    }
</style>

<div class="header">
    <h1>In Loving Memory</h1>
    <div class="sub">Forever In Our Hearts</div>
</div>

<!-- Scene containers (auto-filled by engine) -->
<div id="scene0" class="scene active"></div>
<div id="scene1" class="scene"></div>
<div id="scene2" class="scene"></div>
<div id="scene3" class="scene"></div>
<div id="scene4" class="scene"></div>
<div id="scene5" class="scene"></div>
<div id="scene6" class="scene"></div>
<div id="scene7" class="scene"></div>
<div id="scene8" class="scene"></div>
<div id="scene9" class="scene"></div>

<div id="caption"></div>
<div id="progress" style="width:0%"></div>

<script>
    // === SCENE TIMING ===
    // Each scene shows for this many seconds
    // Adjust these to control when each photo appears!
    var sceneTiming = [
        { scene: 0, start: 0,   end: 20 },
        { scene: 1, start: 20,  end: 40 },
        { scene: 2, start: 40,  end: 60 },
        { scene: 3, start: 60,  end: 80 },
        { scene: 4, start: 80,  end: 100 },
        { scene: 5, start: 100, end: 120 },
        { scene: 6, start: 120, end: 140 },
        { scene: 7, start: 140, end: 155 },
        { scene: 8, start: 155, end: 165 },
        { scene: 9, start: 165, end: 180 }
    ];

    // === CAPTIONS ===
    var captions = [
        { start: 11, end: 13, text: "We remember you" },
        { start: 14, end: 16, text: "Today, Dad" },
        { start: 17, end: 19, text: "With every breath" },
        { start: 20, end: 22, text: "We take" },
        { start: 23, end: 25, text: "Not just for how" },
        { start: 26, end: 28, text: "You left us" },
        { start: 29, end: 31, text: "But the hearts you left" },
        { start: 32, end: 35, text: "To ache" },
        { start: 36, end: 41, text: "But for how deeply you loved us" },
        { start: 42, end: 45, text: "A light that never dies" },
        { start: 46, end: 51, text: "We saw your strength through every pain" },
        { start: 52, end: 57, text: "Within your weary eyes" },
        { start: 58, end: 65, text: "Your love still holds us close" },
        { start: 66, end: 70, text: "Even though you've flown away" },
        { start: 71, end: 73, text: "We miss your voice" },
        { start: 74, end: 76, text: "Your laughter" },
        { start: 77, end: 81, text: "In every single day" },
        { start: 82, end: 88, text: "Forever in our hearts" },
        { start: 89, end: 94, text: "Forever in our hearts" },
        { start: 101, end: 104, text: "We felt your silent courage" },
        { start: 105, end: 108, text: "Even when the world grew still" },
        { start: 109, end: 112, text: "The hospital days they broke us" },
        { start: 113, end: 116, text: "But they couldn't break your will" },
        { start: 117, end: 120, text: "Your presence is our heartbeat" },
        { start: 121, end: 124, text: "Where the heavenly light starts" },
        { start: 125, end: 128, text: "Rest well our dearest father" },
        { start: 129, end: 134, text: "Forever in our hearts" },
        { start: 135, end: 141, text: "Your love still holds us close" },
        { start: 142, end: 146, text: "Even though you've flown away" },
        { start: 147, end: 149, text: "We miss your voice" },
        { start: 150, end: 152, text: "Your laughter" },
        { start: 153, end: 157, text: "In every single day" },
        { start: 158, end: 164, text: "Forever in our hearts" },
        { start: 165, end: 170, text: "Forever in our hearts" }
    ];

    // === MAIN UPDATE FUNCTION ===
    window.__updateAtTime = function(time) {
        var images = window.__images || [];
        var totalDuration = window.__totalDuration || 180;

        // --- Update Scenes ---
        sceneTiming.forEach(function(st) {
            var el = document.getElementById('scene' + st.scene);
            if (!el) return;

            // Set image if available
            if (images[st.scene] && !el.style.backgroundImage) {
                el.style.backgroundImage = 'url(' + images[st.scene] + ')';
            }

            // Show/hide
            if (time >= st.start && time < st.end) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // --- Update Captions ---
        var captionEl = document.getElementById('caption');
        var active = null;
        for (var i = 0; i < captions.length; i++) {
            if (time >= captions[i].start && time <= captions[i].end) {
                active = captions[i];
                break;
            }
        }
        if (active) {
            if (captionEl.textContent !== active.text) {
                captionEl.textContent = active.text;
            }
            captionEl.style.opacity = '1';
        } else {
            captionEl.style.opacity = '0';
        }

        // --- Update Progress ---
        var prog = document.getElementById('progress');
        if (prog) {
            prog.style.width = ((time / totalDuration) * 100) + '%';
        }
    };
</script>`,

slideshow: `<!-- 🖼️ PHOTO SLIDESHOW -->
<style>
    body {
        margin: 0; width: 100%; height: 100%;
        font-family: 'Helvetica', sans-serif;
        color: white; overflow: hidden;
        background: #111;
    }
    .scene {
        position: absolute; inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0;
        transition: opacity 1s ease;
        transform: scale(1);
    }
    .scene.active {
        opacity: 1;
        animation: slowZoom 8s ease forwards;
    }
    @keyframes slowZoom {
        from { transform: scale(1); }
        to { transform: scale(1.08); }
    }
    .scene::after {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(transparent 50%, rgba(0,0,0,0.6));
    }
    #caption {
        position: absolute;
        bottom: 60px; left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        font-size: 36px;
        text-align: center;
        max-width: 80%;
        opacity: 0;
        transition: opacity 0.5s;
        text-shadow: 0 4px 20px rgba(0,0,0,0.9);
    }
    #counter {
        position: absolute;
        top: 30px; right: 40px;
        z-index: 20;
        font-size: 18px;
        color: rgba(255,255,255,0.5);
    }
</style>

<div id="scene0" class="scene active"></div>
<div id="scene1" class="scene"></div>
<div id="scene2" class="scene"></div>
<div id="scene3" class="scene"></div>
<div id="scene4" class="scene"></div>
<div id="scene5" class="scene"></div>
<div id="scene6" class="scene"></div>
<div id="scene7" class="scene"></div>
<div id="scene8" class="scene"></div>
<div id="scene9" class="scene"></div>
<div id="caption"></div>
<div id="counter"></div>

<script>
    // Auto-distribute scenes evenly across audio duration
    window.__updateAtTime = function(time) {
        var images = window.__images || [];
        var total = window.__totalDuration || 60;
        var count = images.length || 1;
        var perScene = total / count;

        // Which scene is active?
        var activeIdx = Math.min(Math.floor(time / perScene), count - 1);

        for (var i = 0; i < 10; i++) {
            var el = document.getElementById('scene' + i);
            if (!el) continue;
            if (images[i] && !el.style.backgroundImage) {
                el.style.backgroundImage = 'url(' + images[i] + ')';
            }
            if (i === activeIdx) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }

        // Counter
        var counter = document.getElementById('counter');
        if (counter && images.length > 0) {
            counter.textContent = (activeIdx + 1) + ' / ' + count;
        }
    };
</script>`,

lyrics: `<!-- 🎤 LYRICS VIDEO -->
<style>
    body {
        margin: 0; width: 100%; height: 100%;
        font-family: 'Arial Black', sans-serif;
        color: white; overflow: hidden;
    }
    .scene {
        position: absolute; inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0;
        transition: opacity 1.5s;
    }
    .scene.active { opacity: 1; }
    .scene::after {
        content: '';
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.55);
    }
    #caption {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 20;
        text-align: center;
        font-size: 64px;
        font-weight: 900;
        max-width: 85%;
        text-shadow: 0 0 30px rgba(0,0,0,0.9);
    }
    .word {
        display: inline-block;
        margin: 0 6px;
        transition: all 0.15s;
        color: rgba(255,255,255,0.4);
    }
    .word.lit {
        color: #ffe600;
        transform: scale(1.15);
        text-shadow: 0 0 30px rgba(255,230,0,0.8);
    }
</style>

<div id="scene0" class="scene active"></div>
<div id="scene1" class="scene"></div>
<div id="scene2" class="scene"></div>
<div id="scene3" class="scene"></div>
<div id="scene4" class="scene"></div>
<div id="caption"></div>

<script>
    var lyrics = [
        { start: 0, end: 5, text: "Every moment counts" },
        { start: 5, end: 10, text: "Make it worth remembering" },
        { start: 10, end: 15, text: "Life is beautiful" },
        { start: 15, end: 20, text: "When you live it fully" }
    ];

    window.__updateAtTime = function(time) {
        var images = window.__images || [];
        var total = window.__totalDuration || 60;
        var count = Math.max(images.length, 1);
        var perScene = total / count;
        var activeIdx = Math.min(Math.floor(time / perScene), count - 1);

        for (var i = 0; i < 5; i++) {
            var el = document.getElementById('scene' + i);
            if (!el) continue;
            if (images[i]) el.style.backgroundImage = 'url(' + images[i] + ')';
            el.classList.toggle('active', i === activeIdx);
        }

        var cap = document.getElementById('caption');
        var line = null;
        for (var j = 0; j < lyrics.length; j++) {
            if (time >= lyrics[j].start && time <= lyrics[j].end) {
                line = lyrics[j]; break;
            }
        }
        if (!line) { cap.innerHTML = ''; return; }

        var words = line.text.split(' ');
        var dur = (line.end - line.start) / words.length;
        var idx = Math.min(Math.floor((time - line.start) / dur), words.length - 1);
        cap.innerHTML = words.map(function(w, i) {
            return '<span class="word ' + (i <= idx ? 'lit' : '') + '">' + w + '</span>';
        }).join('');
    };
</script>`,

story: `<!-- 📖 STORY / NARRATION -->
<style>
    body {
        margin: 0; width: 100%; height: 100%;
        font-family: 'Georgia', serif;
        color: white; overflow: hidden;
    }
    .scene {
        position: absolute; inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0;
        transition: opacity 2s;
    }
    .scene.active { opacity: 1; }
    .scene::after {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2));
    }
    #caption {
        position: absolute;
        bottom: 80px; left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        font-size: 32px;
        line-height: 1.6;
        max-width: 80%;
        text-align: center;
        font-style: italic;
        opacity: 0;
        transition: opacity 0.5s;
        text-shadow: 0 2px 15px rgba(0,0,0,0.9);
    }
    .chapter {
        position: absolute;
        top: 40px; left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        font-size: 18px;
        color: rgba(255,255,255,0.4);
        letter-spacing: 8px;
        text-transform: uppercase;
    }
</style>

<div class="chapter">Chapter One</div>
<div id="scene0" class="scene active"></div>
<div id="scene1" class="scene"></div>
<div id="scene2" class="scene"></div>
<div id="scene3" class="scene"></div>
<div id="scene4" class="scene"></div>
<div id="caption"></div>

<script>
    var narration = [
        { start: 0, end: 6, text: "In the beginning, there was silence." },
        { start: 6, end: 12, text: "But silence held a story waiting to be told." },
        { start: 12, end: 18, text: "And so the journey began." }
    ];

    window.__updateAtTime = function(time) {
        var images = window.__images || [];
        var total = window.__totalDuration || 60;
        var count = Math.max(images.length, 1);
        var per = total / count;
        var idx = Math.min(Math.floor(time / per), count - 1);

        for (var i = 0; i < 5; i++) {
            var el = document.getElementById('scene' + i);
            if (!el) continue;
            if (images[i]) el.style.backgroundImage = 'url(' + images[i] + ')';
            el.classList.toggle('active', i === idx);
        }

        var cap = document.getElementById('caption');
        var line = null;
        for (var j = 0; j < narration.length; j++) {
            if (time >= narration[j].start && time <= narration[j].end) {
                line = narration[j]; break;
            }
        }
        if (line) {
            if (cap.textContent !== line.text) cap.textContent = line.text;
            cap.style.opacity = '1';
        } else {
            cap.style.opacity = '0';
        }
    };
</script>`

};
