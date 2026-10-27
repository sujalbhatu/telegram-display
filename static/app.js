(function () {
    const $ = (id) => document.getElementById(id);
    const body = document.body;
    const spot = $('spot');
    const spotText = $('spotText');
    const spotMeta = $('spotMeta');
    const trail = $('trail');
    const statusEl = $('status');
    const countEl = $('count');
    const soundBtn = $('sound');
    const scene = $('scene');
    const prankEl = $('prank');

    let state = window.INITIAL.state;
    let messages = window.INITIAL.messages.slice();
    let messageCount = messages.length;
    let soundOn = false;
    let audioCtx = null;

    const THEMES = {
        party: { emoji: '🎪', welcome: 'Waiting for the show…', enter: 'pop', note: 660 },
        neon: { emoji: '📡', welcome: 'Awaiting transmission…', enter: 'zoom', note: 880 },
        matrix: { emoji: '🕶️', welcome: '> waiting for signal', enter: 'type', note: 220 },
        love: { emoji: '💌', welcome: 'Waiting for a love note…', enter: 'drop', note: 523 },
        retro: { emoji: '👾', welcome: 'READY.', enter: 'type', note: 330 },
        alert: { emoji: '🚨', welcome: 'STANDBY', enter: 'slam', note: 440 },
        chill: { emoji: '🌙', welcome: 'nothing yet, just vibes', enter: 'fade', note: 392 },
    };

    function theme() {
        return THEMES[state.theme] || THEMES.party;
    }

    // ---------- Messages ----------

    function fitText(el, box) {
        // Largest font size that still fits the box, by binary search
        el.classList.remove('breaky');
        let lo = 14;
        let hi = Math.min(box.clientHeight * 0.9, 260);
        el.style.fontSize = hi + 'px';
        if (el.scrollWidth <= box.clientWidth && el.offsetHeight <= box.clientHeight * 0.75) return;
        while (hi - lo > 1) {
            const mid = (lo + hi) / 2;
            el.style.fontSize = mid + 'px';
            if (el.scrollWidth <= box.clientWidth && el.offsetHeight <= box.clientHeight * 0.75) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        el.style.fontSize = lo + 'px';
        if (el.scrollWidth > box.clientWidth) el.classList.add('breaky');
    }

    let typing = null;

    function showSpot(msg, animate) {
        clearInterval(typing);
        spotText.className = 'spot-text';
        spotText.textContent = msg.text;
        spotMeta.textContent = state.names ? msg.sender + ' · ' + msg.time + ' UTC' : '';
        fitText(spotText, spot);

        if (!animate) return;

        const enter = theme().enter;
        if (enter === 'type') {
            const chars = Array.from(msg.text);
            let i = 0;
            spotText.textContent = '';
            spotText.classList.add('cursor');
            typing = setInterval(() => {
                spotText.textContent = chars.slice(0, ++i).join('');
                if (i % 2) beep(theme().note + Math.random() * 60, 0.03, 'square', 0.03);
                if (i >= chars.length) clearInterval(typing);
            }, Math.max(18, Math.min(70, 2000 / chars.length)));
        } else {
            void spotText.offsetWidth; // restart the animation
            spotText.classList.add('enter-' + enter);
        }
    }

    function renderTrail() {
        trail.textContent = '';
        messages.slice(-5, -1).forEach((m) => {
            const item = document.createElement('div');
            item.className = 'trail-item';
            if (state.names) {
                const who = document.createElement('span');
                who.className = 'who';
                who.textContent = m.sender + ':';
                item.appendChild(who);
            }
            item.appendChild(document.createTextNode(m.text));
            trail.appendChild(item);
        });
    }

    function renderCount() {
        countEl.textContent = messageCount + (messageCount === 1 ? ' message' : ' messages');
        body.classList.toggle('empty', messages.length === 0);
    }

    function addMessage(msg) {
        messages.push(msg);
        if (messages.length > 50) messages.shift();
        messageCount++;
        body.classList.remove('empty');
        renderTrail();
        showSpot(msg, true);
        renderCount();
        celebrate(msg);
    }

    // Each theme greets a new message its own way
    function celebrate(msg) {
        beep(theme().note, 0.15, 'triangle', 0.12);
        setTimeout(() => beep(theme().note * 1.5, 0.2, 'triangle', 0.1), 110);

        switch (state.theme) {
            case 'party': confetti(); break;
            case 'love': rain('💖', 40); break;
            case 'alert': shake(); break;
            case 'neon': fireworks(2); break;
            case 'chill': rain('✨', 25); break;
        }

        if (state.speak && soundOn && 'speechSynthesis' in window) {
            speechSynthesis.cancel();
            speechSynthesis.speak(new SpeechSynthesisUtterance(msg.text));
        }
    }

    function clearScreen() {
        messages = [];
        messageCount = 0;
        spotText.textContent = '';
        spotMeta.textContent = '';
        trail.textContent = '';
        renderCount();
        rain('🧹', 20);
    }

    // ---------- Themes ----------

    function applyState(next) {
        const themeChanged = next.theme !== state.theme;
        state = next;
        body.dataset.theme = state.theme;
        $('themeTag').textContent = state.theme;
        $('welcomeEmoji').textContent = theme().emoji;
        $('welcomeText').textContent = theme().welcome;
        if (themeChanged || !scene.childElementCount) buildScene();
        renderTrail();
        if (messages.length) showSpot(messages[messages.length - 1], themeChanged);
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function sprinkle(count, make) {
        for (let i = 0; i < count; i++) scene.appendChild(make(i));
    }

    function floater(cls, char, opts) {
        const el = document.createElement('span');
        el.className = cls;
        el.textContent = char;
        el.style.left = rand(0, 95) + 'vw';
        el.style.fontSize = rand(opts.min, opts.max) + 'px';
        el.style.animationDuration = rand(opts.slow, opts.fast) + 's';
        el.style.animationDelay = -rand(0, opts.fast) + 's';
        return el;
    }

    function buildScene() {
        scene.textContent = '';
        stopMatrix();

        switch (state.theme) {
            case 'party':
                sprinkle(10, () => floater('balloon', pick(['🎈', '🎈', '🎉', '🥳', '🎊']), { min: 40, max: 70, slow: 12, fast: 22 }));
                break;
            case 'neon':
                scene.innerHTML = '<div class="synth-sun"></div><div class="synth-grid"></div>';
                break;
            case 'matrix':
                startMatrix();
                break;
            case 'love':
                sprinkle(18, () => floater('heart', pick(['💖', '💕', '💗', '❤️', '💘']), { min: 20, max: 54, slow: 8, fast: 18 }));
                break;
            case 'alert':
                scene.innerHTML = '<div class="hazard top"></div><div class="hazard bottom"></div>';
                break;
            case 'chill':
                sprinkle(40, () => {
                    const s = document.createElement('i');
                    s.className = 'star';
                    s.style.left = rand(0, 100) + 'vw';
                    s.style.top = rand(0, 45) + 'vh';
                    s.style.animationDelay = -rand(0, 3) + 's';
                    return s;
                });
                sprinkle(4, (i) => {
                    const c = floater('cloud', '☁️', { min: 60, max: 120, slow: 60, fast: 110 });
                    c.style.left = '0';
                    c.style.top = (8 + i * 12) + 'vh';
                    return c;
                });
                break;
        }
    }

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    // ---------- Matrix rain (background canvas) ----------

    const bg = $('bg');
    const bgCtx = bg.getContext('2d');
    let matrixTimer = null;

    function startMatrix() {
        const glyphs = 'アカサタナハマヤラワ0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃ';
        const size = 18;
        let drops = [];

        function reset() {
            bg.width = innerWidth;
            bg.height = innerHeight;
            drops = Array.from({ length: Math.ceil(bg.width / size) }, () => rand(-50, 0));
        }

        reset();
        matrixTimer = setInterval(() => {
            if (bg.width !== innerWidth || bg.height !== innerHeight) reset();
            bgCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            bgCtx.fillRect(0, 0, bg.width, bg.height);
            bgCtx.font = size + 'px monospace';
            drops.forEach((y, i) => {
                bgCtx.fillStyle = Math.random() > 0.975 ? '#d4ffd0' : '#1fbf0f';
                bgCtx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * size, y * size);
                drops[i] = y * size > bg.height && Math.random() > 0.975 ? 0 : y + 1;
            });
        }, 50);
    }

    function stopMatrix() {
        clearInterval(matrixTimer);
        bgCtx.clearRect(0, 0, bg.width, bg.height);
    }

    // ---------- Particle effects (top canvas) ----------

    const fx = $('fx');
    const ctx = fx.getContext('2d');
    let particles = [];
    let running = false;

    function sizeFx() {
        fx.width = innerWidth;
        fx.height = innerHeight;
    }

    sizeFx();
    addEventListener('resize', () => {
        sizeFx();
        if (messages.length) fitText(spotText, spot);
    });

    function loop() {
        ctx.clearRect(0, 0, fx.width, fx.height);
        particles = particles.filter((p) => p.life > 0 && p.y < fx.height + 80);

        particles.forEach((p) => {
            p.vy += p.g;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            p.life--;

            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life / 30);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            if (p.emoji) {
                ctx.font = p.size + 'px serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.emoji, 0, 0);
            } else if (p.spark) {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            }
            ctx.restore();

            if (p.rocket && p.vy >= -1) {
                p.life = 0;
                burst(p.x, p.y, p.color);
            }
        });

        if (particles.length) {
            requestAnimationFrame(loop);
        } else {
            running = false;
            ctx.clearRect(0, 0, fx.width, fx.height);
        }
    }

    function spawn(p) {
        particles.push(Object.assign({ vx: 0, vy: 0, g: 0.25, drag: 0.99, rot: 0, vr: 0, life: 400, size: 10 }, p));
        if (!running) {
            running = true;
            requestAnimationFrame(loop);
        }
    }

    const COLORS = ['#ff3f8e', '#feca57', '#48dbfb', '#1dd1a1', '#ff9ff3', '#ffffff', '#6c3ce0'];

    function confetti() {
        [0, fx.width].forEach((x0) => {
            for (let i = 0; i < 90; i++) {
                const dir = x0 === 0 ? 1 : -1;
                spawn({
                    x: x0, y: fx.height,
                    vx: dir * rand(4, 16), vy: -rand(12, 24),
                    g: 0.3, drag: 0.985,
                    vr: rand(-0.3, 0.3), size: rand(8, 16),
                    color: pick(COLORS), life: rand(160, 260),
                });
            }
        });
        beep(1200, 0.08, 'sine', 0.06);
    }

    function burst(x, y, color) {
        for (let i = 0; i < 70; i++) {
            const a = rand(0, Math.PI * 2);
            const s = rand(2, 8);
            spawn({
                x, y, spark: true,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                g: 0.06, drag: 0.97, size: rand(1.5, 3.5),
                color: Math.random() > 0.3 ? color : '#ffffff', life: rand(60, 110),
            });
        }
        beep(rand(80, 140), 0.25, 'sawtooth', 0.05);
    }

    function fireworks(rounds) {
        for (let i = 0; i < rounds * 3; i++) {
            setTimeout(() => {
                spawn({
                    x: rand(fx.width * 0.15, fx.width * 0.85), y: fx.height,
                    vy: -rand(13, 18), vx: rand(-2, 2),
                    g: 0.2, drag: 1, rocket: true, spark: true, size: 3,
                    color: pick(COLORS), life: 200,
                });
            }, i * 350);
        }
    }

    function rain(emoji, count) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                spawn({
                    emoji, x: rand(0, fx.width), y: -40,
                    vx: rand(-1, 1), vy: rand(2, 5),
                    g: 0.08, drag: 0.995, vr: rand(-0.05, 0.05),
                    size: rand(28, 60), life: 600,
                });
            }, i * 60);
        }
    }

    function shake() {
        body.classList.remove('shake');
        void body.offsetWidth;
        body.classList.add('shake');
        setTimeout(() => body.classList.remove('shake'), 900);
        beep(70, 0.4, 'sawtooth', 0.1);
    }

    function flash() {
        const el = $('flash');
        el.classList.remove('go');
        void el.offsetWidth;
        el.classList.add('go');
    }

    let discoTimer = null;

    function disco() {
        body.classList.add('disco');
        clearTimeout(discoTimer);
        discoTimer = setTimeout(() => body.classList.remove('disco'), 10000);
        [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => setTimeout(() => beep(i % 2 ? 330 : 440, 0.15, 'square', 0.05), i * 250));
    }

    let countdownTimer = null;

    function countdown(from) {
        const el = $('countdown');
        let n = from;
        clearInterval(countdownTimer);
        el.classList.add('on');

        function show(text) {
            el.innerHTML = '';
            const span = document.createElement('span');
            span.className = 'tick';
            span.textContent = text;
            el.appendChild(span);
        }

        show(n);
        beep(600, 0.1, 'sine', 0.1);
        countdownTimer = setInterval(() => {
            n--;
            if (n > 0) {
                show(n);
                beep(600, 0.1, 'sine', 0.1);
            } else {
                clearInterval(countdownTimer);
                show('🎉');
                beep(1200, 0.4, 'sine', 0.12);
                confetti();
                fireworks(2);
                setTimeout(() => el.classList.remove('on'), 2000);
            }
        }, 1000);
    }

    const EFFECTS = {
        confetti, shake, flash, disco,
        fireworks: () => fireworks(3),
        rain: (arg) => rain(arg || '🎉', 60),
        countdown: (arg) => countdown(arg || 10),
    };

    // ---------- Pranks ----------

    let prankTimers = [];
    let activePrank = null;

    function every(ms, fn) {
        prankTimers.push(setInterval(fn, ms));
    }

    function line(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div;
    }

    const PRANKS = {
        bsod() {
            let qr = '';
            for (let i = 0; i < 121; i++) qr += Math.random() > 0.5 ? '<i></i>' : '<i class="w"></i>';
            prankEl.innerHTML =
                '<div class="p-bsod">' +
                '<div class="sad">:(</div>' +
                '<p>Your device ran into a problem and needs to restart. We\'re collecting some error info, and then we\'ll restart for you.</p>' +
                '<p><span id="pct">0</span>% complete</p>' +
                '<div class="row"><div class="qr">' + qr + '</div><div>' +
                '<p class="small">For more information about this issue and possible fixes, visit the support site.</p>' +
                '<p class="small">If you call a support person, give them this info:<br>Stop code: CRITICAL_PROCESS_DIED</p>' +
                '</div></div></div>';
            let pct = 0;
            every(900, () => {
                pct = Math.min(100, pct + Math.floor(rand(0, 9)));
                $('pct').textContent = pct;
            });
        },

        update() {
            prankEl.innerHTML =
                '<div class="p-update">' +
                '<div class="spinner"><i></i><i></i><i></i><i></i><i></i></div>' +
                '<div>Working on updates <span id="pct">0</span>% complete.</div>' +
                '<div>Don\'t turn off your computer.</div>' +
                '</div>';
            let pct = 0;
            every(2500, () => {
                // Creeps up, then gets stuck at 99 forever
                if (pct < 99) pct = Math.min(99, pct + Math.floor(rand(0, 6)));
                $('pct').textContent = pct;
            });
        },

        hacked() {
            prankEl.innerHTML =
                '<div class="p-hacked">' +
                '<div class="skull">💀</div>' +
                '<div class="glitch">SYSTEM COMPROMISED</div>' +
                '<div class="timer">deleting everything in <span id="timer">01:00</span></div>' +
                '<div class="log" id="log"></div>' +
                '</div>';
            const steps = [
                'bypassing firewall............ OK',
                'cracking password "password123"... OK',
                'downloading browser history... 4.2 GB',
                'reading WhatsApp chats........ yikes',
                'uploading embarrassing selfies...',
                'ordering 400 pizzas to your address...',
                'changing wallpaper to Nickelback...',
                'replacing all songs with baby shark...',
                'emailing your boss: "I quit"... sent',
                'liking every photo from 2014 on your ex\'s profile...',
                'encrypting files with AES-9000...',
                'mining crypto on your toaster...',
            ];
            const log = $('log');
            let i = 0;
            every(700, () => {
                log.appendChild(line('> ' + steps[i++ % steps.length]));
                while (log.childElementCount > 14) log.firstChild.remove();
                beep(rand(200, 900), 0.03, 'square', 0.03);
            });
            let secs = 60;
            every(1000, () => {
                secs = secs > 0 ? secs - 1 : 60;
                $('timer').textContent = '00:' + String(secs).padStart(2, '0');
            });
        },

        virus() {
            prankEl.innerHTML =
                '<div class="p-virus"><div class="win">' +
                '<div class="title">⚠ Security Scanner</div>' +
                '<div class="body">' +
                '<div class="big"><span id="threats">0</span> threats found!</div>' +
                '<div>Scanning: <span id="scanning">C:\\</span></div>' +
                '<div class="bar-out"><div class="bar-in" id="bar"></div></div>' +
                '<ul id="found"></ul>' +
                '</div></div></div>';
            const viruses = [
                'Trojan.RickRoll.exe', 'Worm.TooManyTabs', 'Spyware.MomIsWatching',
                'Adware.FreeIphone16', 'Ransomware.HomeworkDue', 'Rootkit.CatOnKeyboard',
                'Malware.ReplyAllEmail', 'Virus.MondayMorning', 'Trojan.CringePhotos2015',
                'Backdoor.UnpaidParkingTicket', 'Spyware.SpotifyWrapped', 'Worm.InfiniteScroll',
            ];
            const files = ['C:\\Windows\\System32', 'C:\\Users\\you\\Photos', 'C:\\secret_stuff', 'C:\\Downloads\\totally_legit.exe', 'C:\\homework_final_FINAL_v3'];
            let threats = 0;
            let pct = 0;
            const found = $('found');
            every(600, () => {
                pct = (pct + rand(1, 5)) % 100;
                $('bar').style.width = pct + '%';
                $('scanning').textContent = pick(files);
                if (Math.random() > 0.45) {
                    threats += Math.floor(rand(1, 40));
                    $('threats').textContent = threats.toLocaleString();
                    const li = document.createElement('li');
                    const name = document.createElement('b');
                    name.textContent = pick(viruses);
                    li.appendChild(name);
                    li.appendChild(document.createTextNode(' — severity: ' + pick(['HIGH', 'CRITICAL', 'UNHOLY', 'SPICY'])));
                    found.prepend(li);
                    while (found.childElementCount > 8) found.lastChild.remove();
                    beep(880, 0.08, 'square', 0.06);
                }
            });
        },

        lottery() {
            prankEl.innerHTML =
                '<div class="p-lottery">' +
                '<div class="trophy">🏆</div>' +
                '<div class="congrats">CONGRATULATIONS!</div>' +
                '<div>YOU ARE OUR 1,000,000TH VISITOR</div>' +
                '<div class="amount">₹10,00,00,000</div>' +
                '<div class="claim-timer">Claim before the timer runs out: <b id="timer">00:59</b></div>' +
                '<button type="button" id="claim">CLAIM NOW</button>' +
                '</div>';
            $('claim').onclick = () => gotcha();
            let secs = 59;
            every(1000, () => {
                secs = secs > 0 ? secs - 1 : 59;
                $('timer').textContent = '00:' + String(secs).padStart(2, '0');
            });
            every(2500, () => rain(pick(['💰', '💸', '🪙']), 12));
            confetti();
        },
    };

    function startPrank(name) {
        stopPrank();
        if (!PRANKS[name]) return;
        activePrank = name;
        PRANKS[name]();
        prankEl.classList.add('on');
    }

    function stopPrank() {
        prankTimers.forEach(clearInterval);
        prankTimers = [];
        prankEl.classList.remove('on');
        prankEl.innerHTML = '';
        const was = activePrank;
        activePrank = null;
        return was;
    }

    function gotcha() {
        stopPrank();
        const el = $('gotcha');
        el.classList.add('on');
        confetti();
        beep(523, 0.15, 'triangle', 0.12);
        setTimeout(() => beep(659, 0.15, 'triangle', 0.12), 150);
        setTimeout(() => beep(784, 0.3, 'triangle', 0.12), 300);
        setTimeout(() => el.classList.remove('on'), 3500);
    }

    // ---------- Sound ----------

    function beep(freq, duration, type, volume) {
        if (!soundOn || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume || 0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    // Browsers only allow audio after the viewer interacts with the page
    soundBtn.onclick = () => {
        soundOn = !soundOn;
        if (soundOn && !audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        soundBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Tap for sound';
        soundBtn.classList.toggle('on', soundOn);
        beep(880, 0.1, 'triangle', 0.1);
    };

    // ---------- Live stream ----------

    function connect() {
        const source = new EventSource('/stream');

        source.onmessage = (event) => {
            const payload = JSON.parse(event.data);

            switch (payload.type) {
                case 'message':
                    addMessage(payload.data);
                    break;
                case 'clear':
                    clearScreen();
                    break;
                case 'state':
                    applyState(payload.data);
                    break;
                case 'effect':
                    if (EFFECTS[payload.name]) EFFECTS[payload.name](payload.arg);
                    break;
                case 'prank':
                    if (payload.name) {
                        startPrank(payload.name);
                    } else if (activePrank) {
                        gotcha();
                    }
                    break;
            }
        };

        source.onopen = () => {
            statusEl.textContent = 'connected';
            body.classList.remove('offline');
        };

        source.onerror = () => {
            statusEl.textContent = 'reconnecting…';
            body.classList.add('offline');
            source.close();
            setTimeout(connect, 3000);
        };
    }

    // ---------- Start ----------

    applyState(state);
    renderCount();
    renderTrail();
    if (messages.length) showSpot(messages[messages.length - 1], false);
    connect();

    // Fonts change text width, so refit once they arrive
    if (document.fonts) {
        document.fonts.ready.then(() => {
            if (messages.length) fitText(spotText, spot);
        });
    }
})();
