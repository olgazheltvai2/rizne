// pencil.js - Глобальний інструмент малювання для всіх ігор
(function() {
    // Захист від дублювання та вимкнення на Вчительській панелі
    if (document.getElementById('global-draw-container') || window.location.pathname.includes('teacher_panel.html')) return;

    const drawContainer = document.createElement('div');
    drawContainer.id = 'global-draw-container';
    drawContainer.innerHTML = `
        <style>
            #global-draw-container { font-family: Arial, sans-serif; }
            #draw-canvas-global { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 90000; }
            #toggle-draw-btn-global { position: fixed; bottom: 85px; right: 20px; z-index: 99999; width: auto; padding: 10px 15px; border-radius: 25px; background-color: #f39c12; color: white; border: 2px solid white; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px; }
            #draw-panel-global { position: fixed; bottom: 140px; right: 20px; z-index: 99998; background: white; border: 1px solid #ccc; border-radius: 10px; padding: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); width: 250px; display: none; color: #333; }
        </style>
        <button id="toggle-draw-btn-global" title="Відкрити панель малювання">✏️ Малювати</button>
        <div id="draw-panel-global">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 16px;">Малювання</h3>
                <button id="close-draw-panel-global" style="background: none; border: none; font-size: 16px; cursor: pointer;">❌</button>
            </div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #e74c3c; cursor: pointer; background: #fdf5e6; padding: 8px; border-radius: 5px; border: 1px solid #f39c12;">
                <input type="checkbox" id="draw-mode-switch-global" style="transform: scale(1.2); margin-right: 8px;"> Увімкнути олівець
            </label>
            <p style="font-size: 11px; color: #666; margin: 0 0 10px 0;">(Коли увімкнено, кнопки гри не натискаються)</p>
            <div id="draw-controls-global" style="display: none; flex-direction: column; gap: 10px; margin-top: 15px;">
                <label style="font-size: 14px; font-weight: bold;">Інструмент:</label>
                <div style="display: flex; gap: 10px; font-size: 14px;">
                    <label><input type="radio" name="draw-tool-global" value="pencil" checked> ✏️ Олів</label>
                    <label><input type="radio" name="draw-tool-global" value="eraser"> 🧽 Гумка</label>
                </div>
                <label style="font-size: 14px; font-weight: bold;">Товщина: <span id="size-val-global">5</span>px</label>
                <input type="range" id="draw-size-global" min="1" max="100" value="5">
                <label style="font-size: 14px; font-weight: bold;">Колір:</label>
                <input type="color" id="draw-color-global" value="#e74c3c" style="width: 100%; border: none; height: 30px; cursor: pointer;">
                <button id="draw-clear-btn-global" style="background: #e74c3c; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 5px;">🗑️ Очистити все</button>
            </div>
        </div>
        <canvas id="draw-canvas-global"></canvas>
    `;
    document.body.appendChild(drawContainer);

    const canvas = document.getElementById('draw-canvas-global');
    const ctx = canvas.getContext('2d');
    const drawPanel = document.getElementById('draw-panel-global');
    const toggleDrawBtn = document.getElementById('toggle-draw-btn-global');
    const closeDrawBtn = document.getElementById('close-draw-panel-global');
    const drawModeSwitch = document.getElementById('draw-mode-switch-global');
    const drawControls = document.getElementById('draw-controls-global');
    const drawSize = document.getElementById('draw-size-global');
    const sizeVal = document.getElementById('size-val-global');
    const drawColor = document.getElementById('draw-color-global');
    const drawClearBtn = document.getElementById('draw-clear-btn-global');
    const toolRadios = document.getElementsByName('draw-tool-global');

    function resizeCanvas() {
        const data = canvas.toDataURL();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); };
        img.src = data;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    toggleDrawBtn.addEventListener('click', () => { drawPanel.style.display = 'block'; toggleDrawBtn.style.display = 'none'; });
    closeDrawBtn.addEventListener('click', () => { drawPanel.style.display = 'none'; toggleDrawBtn.style.display = 'flex'; });

    drawModeSwitch.addEventListener('change', (e) => {
        if (e.target.checked) { canvas.style.pointerEvents = 'auto'; drawControls.style.display = 'flex'; } 
        else { canvas.style.pointerEvents = 'none'; drawControls.style.display = 'none'; }
    });
    drawSize.addEventListener('input', (e) => { sizeVal.innerText = e.target.value; });

    let isDrawing = false, lastX = 0, lastY = 0;
    function getTool() { for (let r of toolRadios) { if (r.checked) return r.value; } return 'pencil'; }
    function getEventPos(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

    function startDraw(e) {
        if (!drawModeSwitch.checked) return;
        isDrawing = true;
        const pos = getEventPos(e);
        lastX = pos.x; lastY = pos.y;
    }

    function draw(e) {
        if (!isDrawing || !drawModeSwitch.checked) return;
        e.preventDefault(); 
        const pos = getEventPos(e);
        const tool = getTool(), size = drawSize.value, color = drawColor.value;

        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            db.ref('game_action').set({
                senderId: myName, timestamp: Date.now(), type: 'draw_line',
                data: { x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, color: color, size: size, isEraser: tool === 'eraser', w: window.innerWidth, h: window.innerHeight }
            });
        }
        drawLineLocal(lastX, lastY, pos.x, pos.y, color, size, tool === 'eraser');
        lastX = pos.x; lastY = pos.y;
    }
    function stopDraw() { isDrawing = false; }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    window.addEventListener('touchend', stopDraw);

    function drawLineLocal(x0, y0, x1, y1, color, size, isEraser) {
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = size; ctx.strokeStyle = color;
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();
    }

    drawClearBtn.addEventListener('click', () => {
        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            db.ref('game_action').set({ senderId: myName, timestamp: Date.now(), type: 'clear_canvas', data: {} });
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    const checkDbInterval = setInterval(() => {
        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            clearInterval(checkDbInterval);
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
})();