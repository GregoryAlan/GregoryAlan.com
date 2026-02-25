// ─── Glitch Effects ──────────────────────────────────────────
//
// Visual effects library for GregOS.
// All effects are triggered via runGlitchEffect(name, opts).
// DOM elements are accessed via Terminal.el (set up by terminal.js).

const glitchChars = '░▒▓█▄▀■□▪▫◊○●◘◙';

function corruptString(str, intensity) {
    intensity = intensity || 0.3;
    return str.split('').map(c =>
        Math.random() < intensity ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : c
    ).join('');
}

function runGlitchEffect(name, opts) {
    opts = opts || {};
    const effects = {
        screenFlicker() {
            Terminal.el.terminal.classList.add('screen-flicker');
            setTimeout(() => Terminal.el.terminal.classList.remove('screen-flicker'), 300);
        },
        heavyFlicker() {
            Terminal.el.terminal.classList.add('heavy-flicker');
            setTimeout(() => Terminal.el.terminal.classList.remove('heavy-flicker'), 500);
        },
        scanlines() {
            const dur = opts.duration || 10000;
            let overlay = document.getElementById('scanline-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'scanline-overlay';
                overlay.className = 'scanlines';
                document.body.appendChild(overlay);
            }
            overlay.style.display = '';
            if (!opts.persistent) {
                setTimeout(() => { overlay.style.display = 'none'; }, dur);
            }
        },
        crtBand() {
            const band = document.createElement('div');
            band.className = 'crt-band';
            document.body.appendChild(band);
            setTimeout(() => band.remove(), 3000);
        },
        phantomLine() {
            const texts = opts.texts || ['something is wrong'];
            const text = texts[Math.floor(Math.random() * texts.length)];
            const line = document.createElement('div');
            line.className = 'phantom-line';
            line.textContent = text;
            Terminal.el.output.appendChild(line);
            requestAnimationFrame(() => line.classList.add('visible'));
            setTimeout(() => line.classList.remove('visible'), 4000);
            setTimeout(() => line.remove(), 6000);
        },
        promptCorruption() {
            if (effects._promptCorrupting) return;
            effects._promptCorrupting = true;
            const original = Terminal.el.prompt.textContent;
            let count = 0;
            const interval = setInterval(() => {
                Terminal.el.prompt.textContent = corruptString(original, 0.4);
                count++;
                if (count > 8) {
                    clearInterval(interval);
                    Terminal.el.prompt.textContent = original;
                    effects._promptCorrupting = false;
                }
            }, 150);
        },
        textCorruption() {
            const outputs = Terminal.el.output.querySelectorAll('.output');
            const last = outputs[outputs.length - 1];
            if (!last) return;
            const original = last.innerHTML;
            last.innerHTML = corruptString(last.textContent, 0.2);
            setTimeout(() => { last.innerHTML = original; }, 2000);
        },
        screenTear() {
            const outputs = Terminal.el.output.querySelectorAll('.output');
            const items = [];
            outputs.forEach(el => {
                const offset = (Math.random() - 0.5) * 40;
                el.style.transform = 'translateX(' + offset + 'px)';
                items.push(el);
            });
            setTimeout(() => {
                items.forEach(el => { el.style.transform = ''; });
            }, 400);
        },
        majorGlitch() {
            effects.heavyFlicker();
            setTimeout(() => effects.screenTear(), 200);
            setTimeout(() => effects.phantomLine(), 500);
            setTimeout(() => effects.crtBand(), 800);
        }
    };
    if (effects[name]) effects[name]();
}
