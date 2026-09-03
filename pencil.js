// pencil.js - Глобальний інструмент малювання (БРОНЕБІЙНА ВЕРСІЯ)
(function() {
    if (document.getElementById('global-draw-canvas') || window.location.pathname.includes('teacher_panel.html')) return;

    // Знищуємо старі елементи
    ['draw-canvas', 'drawing-toolbar', 'draw-toggle-btn', 'draw-controls'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // 1. Створюємо САМЕ ПОЛОТНО (окремо, без обгорток)
    const canvas = document.createElement('canvas');
    canvas.id = 'global-draw-canvas';
    // ВАЖЛИВО: display: none повністю вилучає його з екрану!
    canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 90000; pointer-events: auto; display: none; touch-action: none; background: transparent;';
    document.body.appendChild(canvas);

    // 2. Створюємо КНОПКИ (окремо, ніяких блоків на весь екран)
    const ui = document.createElement('div');
    ui.id = 'global-draw-ui';
    ui.style.cssText = 'position: fixed; bottom: 0; right: 0; width: 0; height: 0; z-index: 99999; font-family: Arial, sans-serif;';
    ui.innerHTML = `
        <button id="pencil-open-btn" style="position: fixed; bottom: 85px; right: 20px; padding: 10px 15px; border-radius: 25px; background: #8e44ad; color: white; border: 2px solid white; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;">✏️ Малювати</button>
        <div id="pencil-panel" style="position: fixed; bottom: 140px; right: 20px; background: white; padding: 15px; border-radius: 10px; border: 1px solid #ccc; box-shadow: 0 10px 20px rgba(0,0,0,0.3); width: 250px; color: #333; display: none;">
            <div id="pencil-header" style="display: flex; justify-content: flex-end; padding-bottom: 5px; margin-bottom: 15px; border-bottom: 1px solid #eee; cursor: grab; background: url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%23999\\' stroke-width=\\'2\\'><line x1=\\'8\\' y1=\\'6\\' x2=\\'21\\' y2=\\'6\\'/><line x1=\\'8\\' y1=\\'12\\' x2=\\'21\\' y2=\\'12\\'/><line x1=\\'8\\' y1=\\'18\\' x2=\\'21\\' y2=\\'18\\'/><line x1=\\'3\\' y1=\\'6\\' x2=\\'3.01\\' y2=\\'6\\'/><line x1=\\'3\\' y1=\\'12\\' x2=\\'3.01\\' y2=\\'12\\'/><line x1=\\'3\\' y1=\\'18\\' x2=\\'3.01\\' y2=\\'18\\'/></svg>') no-repeat left center;">
                <button id="pencil-close-btn" style="background:none; border:none; cursor:pointer; font-size:16px;">❌</button>
            </div>
            <div style="display:flex; gap:10px; font-size:14px; margin-bottom:15px;">
                <label><input type="radio" name="p-tool" value="pencil" checked> ✏️ Олівець</label>
                <label><input type="radio" name="p-tool" value="eraser"> 🧽 Гумка</label>
            </div>
            <label style="font-size:14px; font-weight:bold;">Товщина: <span id="p-size-val">4</span>px</label>
            <input type="range" id="p-size" min="1" max="50" value="4" style="width:100%; margin-bottom:10px; cursor:pointer;">
            <input type="color" id="p-color" value="#e74c3c" style="width:100%; height:35px; border:none; cursor:pointer; margin-bottom:10px; border-radius:5px;">
            <button id="p-clear-btn" style="width:100%; padding:10px; background:#e74c3c; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">🗑️ Очистити все</button>
        </div>
    `;
    document.body.appendChild(ui);

    const ctx = canvas.getContext('2d');
    const panel = document.getElementById('pencil-panel');
    const btnOpen = document.getElementById('pencil-open-btn');
    const btnClose = document.getElementById('pencil-close-btn');
    const sizeInput = document.getElementById('p-size');
    const colorInput = document.getElementById('p-color');
    const tools = document.getElementsByName('p-tool');
    const header = document.getElementById('pencil-header');

    function resize() {
        const data = canvas.toDataURL();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data;
    }
    window.addEventListener('resize', resize);
    resize();

    btnOpen.addEventListener('click', () => {
        panel.style.display = 'block';
        btnOpen.style.display = 'none';
        canvas.style.display = 'block'; // Полотно існує ТІЛЬКИ коли панель відкрита
    });

    btnClose.addEventListener('click', () => {
        panel.style.display = 'none';
        btnOpen.style.display = 'block';
        canvas.style.display = 'none'; // Полотно повністю зникає!
    });

    sizeInput.addEventListener('input', e => document.getElementById('p-size-val').innerText = e.target.value);

    let isDrawing = false, lastX = 0, lastY = 0;
    
    const getPos = e => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };
    
    const getTool = () => Array.from(tools).find(r => r.checked).value;

    function start(e) {
        if (canvas.style.display === 'none') return;
        isDrawing = true;
        const pos = getPos(e);
        lastX = pos.x; lastY = pos.y;
    }

    function draw(e) {
        if (!isDrawing || canvas.style.display === 'none') return;
        e.preventDefault();
        const pos = getPos(e);
        const tool = getTool(), size = sizeInput.value, color = colorInput.value;

        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            db.ref('game_action').set({
                senderId: myName, timestamp: Date.now(), type: 'draw_line',
                data: { x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, color, size, isEraser: tool === 'eraser', w: window.innerWidth, h: window.innerHeight }
            });
        }
        drawLineLocal(lastX, lastY, pos.x, pos.y, color, size, tool === 'eraser');
        lastX = pos.x; lastY = pos.y;
    }

    function stop() { isDrawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    window.addEventListener('touchend', stop);

    function drawLineLocal(x0, y0, x1, y1, color, size, isEraser) {
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = size; ctx.strokeStyle = color;
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();
    }

    document.getElementById('p-clear-btn').addEventListener('click', () => {
        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            db.ref('game_action').set({ senderId: myName, timestamp: Date.now(), type: 'clear_canvas', data: {} });
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    const checkDb = setInterval(() => {
        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            clearInterval(checkDb);
            db.ref('game_action').on('value', snap => {
                const val = snap.val();
                if (!val || val.senderId === myName) return;
                if (val.type === 'draw_line') {
                    const { x0, y0, x1, y1, color, size, isEraser, w, h } = val.data;
                    drawLineLocal(x0 * (window.innerWidth / w), y0 * (window.innerHeight / h), x1 * (window.innerWidth / w), y1 * (window.innerHeight / h), color, size, isEraser);
                } else if (val.type === 'clear_canvas') {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            });
        }
    }, 500);

    // Перетягування панелі
    let dragging = false, sX, sY, iX, iY;
    const startDrag = e => {
        dragging = true;
        sX = e.touches ? e.touches[0].clientX : e.clientX;
        sY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = panel.getBoundingClientRect();
        iX = rect.left; iY = rect.top;
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    };
    const drag = e => {
        if (!dragging) return;
        const cX = e.touches ? e.touches[0].clientX : e.clientX;
        const cY = e.touches ? e.touches[0].clientY : e.clientY;
        panel.style.left = `${iX + (cX - sX)}px`;
        panel.style.top = `${iY + (cY - sY)}px`;
    };
    const stopDrag = () => dragging = false;

    header.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDrag);
    header.addEventListener('touchstart', startDrag, {passive: true});
    window.addEventListener('touchmove', drag, {passive: true});
    window.addEventListener('touchend', stopDrag);
})();
