// pencil.js - Глобальний інструмент малювання для всіх ігор (Мінімалістичний, draggable, з кнопками)
(function() {
    if (document.getElementById('global-draw-container') || window.location.pathname.includes('teacher_panel.html')) return;

    const drawContainer = document.createElement('div');
    drawContainer.id = 'global-draw-container';
    drawContainer.innerHTML = `
        <style>
            #global-draw-container { font-family: Arial, sans-serif; user-select: none; }
            #draw-canvas-global { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 90000; }
            #toggle-draw-btn-global { position: fixed; bottom: 85px; right: 20px; z-index: 99999; width: auto; padding: 10px 15px; border-radius: 25px; background-color: #f39c12; color: white; border: 2px solid white; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px; }
            
            /* Draggable Panel Styles */
            #draw-panel-global { 
                position: fixed; top: 100px; right: 20px; z-index: 99998; 
                background: white; border: 1px solid #ccc; border-radius: 12px; 
                padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); 
                width: 200px; display: none; color: #333; 
            }
            #draw-drag-handle { 
                cursor: grab; background: #f8f9fa; padding: 6px; margin: -12px -12px 10px -12px; 
                border-top-left-radius: 12px; border-top-right-radius: 12px; 
                font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee;
            }
            #draw-drag-handle:active { cursor: grabbing; }
            
            .draw-tool-btn {
                flex: 1; padding: 8px; border: 2px solid #ddd; background: #f8f9fa; 
                border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; 
                display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.2s;
            }
            .draw-tool-btn.active { background: #3498db; color: white; border-color: #2980b9; }
        </style>

        <button id="toggle-draw-btn-global" title="Панель малювання">✏️ Малювати</button>
        
        <div id="draw-panel-global">
            <div id="draw-drag-handle">
                <span>✋ Малювання</span>
                <button id="close-draw-panel-global" style="background: none; border: none; font-size: 14px; cursor: pointer; font-weight: bold;">✕</button>
            </div>
            
            <label style="display: flex; align-items: center; margin-bottom: 10px; font-weight: bold; color: #e74c3c; cursor: pointer; background: #fdf5e6; padding: 6px 8px; border-radius: 6px; border: 1px solid #f39c12; font-size: 13px;">
                <input type="checkbox" id="draw-mode-switch-global" style="transform: scale(1.2); margin-right: 6px;"> Увімкнути
            </label>
            
            <div id="draw-controls-global" style="display: none; flex-direction: column; gap: 8px;">
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="tool-pencil" class="draw-tool-btn active">✏️ Олівець</button>
                    <button type="button" id="tool-eraser" class="draw-tool-btn">🧽 Гумка</button>
                </div>

                <div style="font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>Товщина:</span>
                    <span id="size-val-global">5</span>px
                </div>
                <input type="range" id="draw-size-global" min="1" max="50" value="5" style="width: 100%; cursor: pointer;">

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: bold;">
                    <span>Колір:</span>
                    <input type="color" id="draw-color-global" value="#e74c3c" style="width: 40px; border: none; height: 26px; cursor: pointer; background: none;">
                </div>

                <button id="draw-clear-btn-global" style="background: #e74c3c; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; margin-top: 4px;">🗑️ Очистити</button>
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
    const toolPencil = document.getElementById('tool-pencil');
    const tooleraser = document.getElementById('tool-eraser');
    const dragHandle = document.getElementById('draw-drag-handle');

    let currentTool = 'pencil'; // 'pencil' або 'eraser'

    toolPencil.addEventListener('click', () => {
        currentTool = 'pencil';
        toolPencil.classList.add('active');
        tooleraser.classList.remove('active');
    });

    tooleraser.addEventListener('click', () => {
        currentTool = 'eraser';
        tooleraser.classList.add('active');
        toolPencil.classList.remove('active');
    });

    // --- Drag and Drop логіка для панелі ---
    let isDragging = false, dragX = 0, dragY = 0;
    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragX = e.clientX - drawPanel.offsetLeft;
        dragY = e.clientY - drawPanel.offsetTop;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        drawPanel.style.left = (e.clientX - dragX) + 'px';
        drawPanel.style.top = (e.clientY - dragY) + 'px';
        drawPanel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Також підтримка пальців для мобільних/планшетів
    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        dragX = touch.clientX - drawPanel.offsetLeft;
        dragY = touch.clientY - drawPanel.offsetTop;
    }, {passive: true});
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        drawPanel.style.left = (touch.clientX - dragX) + 'px';
        drawPanel.style.top = (touch.clientY - dragY) + 'px';
        drawPanel.style.right = 'auto';
    }, {passive: true});
    window.addEventListener('touchend', () => { isDragging = false; });

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

    let drawing = false, lastX = 0, lastY = 0;
    function getEventPos(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

    function startDraw(e) {
        if (!drawModeSwitch.checked) return;
        drawing = true;
        const pos = getEventPos(e);
        lastX = pos.x; lastY = pos.y;
    }

    function draw(e) {
        if (!drawing || !drawModeSwitch.checked) return;
        e.preventDefault(); 
        const pos = getEventPos(e);
        const size = drawSize.value, color = drawColor.value;
        const isEraser = (currentTool === 'eraser');

        if (typeof db !== 'undefined' && typeof myName !== 'undefined') {
            db.ref('game_action').set({
                senderId: myName, timestamp: Date.now(), type: 'draw_line',
                data: { x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, color: color, size: size, isEraser: isEraser, w: window.innerWidth, h: window.innerHeight }
            });
        }
        drawLineLocal(lastX, lastY, pos.x, pos.y, color, size, isEraser);
        lastX = pos.x; lastY = pos.y;
    }
    function stopDraw() { drawing = false; }

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
        ctx.lineWidth = size;
        ctx.strokeStyle = color;
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
