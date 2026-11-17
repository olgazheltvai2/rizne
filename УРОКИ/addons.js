/* ============================================================================
   addons.js — Розширені модулі для Візуальної Дошки Уроків
   Включає:
   1. Приховування всієї панелі інструментів та фільтрів під кнопку "👁️" (за замовчуванням сховано)
   2. Інтерактивний календар при редагуванні дати/теми уроку
   3. Окремі текстові завдання (📝 Текст) + рідер та вікно для 2-го монітора
   4. Вільне перетягування (Pan & Zoom) збільшеної картинки у всі боки (верх/краї)
   5. Візуальний каталог-пікер ігор із папок/тем (📚 З бази) без виходу з уроку учня
   6. Перевірка "Чи давала гру?", історія призначень (👥) та "🖼️ Мапа картинок"
   ============================================================================ */

(function () {
    if (!window.VLB) {
        console.warn('VLB bridge not found. Make sure window.VLB is added at the very end of index.html');
        return;
    }

    const VLB = window.VLB;
    const BS = String.fromCharCode(92);
    let topicMapModeActive = false;
    let isRenderingMap = false;

    const LS_COMPACT_HEADER_KEY = 'vlb_compact_eye_v3';
    const LS_CAL_AUTOSAVE_KEY = 'vlb_calendar_autosave_v1';

    // За замовчуванням панель інструментів схована під око (true)
    let isHeaderCompact = true;
    try {
        const savedCompact = window.localStorage.getItem(LS_COMPACT_HEADER_KEY);
        if (savedCompact !== null) {
            isHeaderCompact = savedCompact === '1';
        }
    } catch (e) {}

    let calendarAutoSave = true;
    try {
        const savedAuto = window.localStorage.getItem(LS_CAL_AUTOSAVE_KEY);
        if (savedAuto !== null) calendarAutoSave = savedAuto === '1';
    } catch (e) {}

    let activeModalMode = 'standard'; // 'standard' | 'text' | 'catalog'
    let currentEditingTextCardId = null;
    let selectedTextCardTheme = 'amber';
    let catalogSelectedBoardId = null;
    let catalogSearchQuery = '';
    let catalogTypeFilter = 'all';

    /* ------------------------------------------------------------------------
       0. ДОДАТКОВІ СТИЛІ (ПРИХОВУВАННЯ ПІД ОКО, ТЕКСТОВІ КАРТКИ, КАЛЕНДАР, ЗУМ)
       ------------------------------------------------------------------------ */
    function injectCustomStyles() {
        if (document.getElementById('vlbAddonsStyles')) return;
        const st = document.createElement('style');
        st.id = 'vlbAddonsStyles';
        st.textContent = [
            '/* Ховаємо дубльований рядок вкладок піддошок/учнів у верхній панелі */',
            '#boardTabsBar { display: none !important; }',
            '#breadcrumbBar + div.w-px { display: none !important; }',
            '',
            '/* Назавжди ховаємо текстове нагадування "1 клік — копіює шлях..." у стрічці фільтрів */',
            '#infoBanner span.hidden { display: none !important; }',
            '',
            '/* Коли око закрите — ховаємо праву панель інструментів, кнопки дошки та фільтр рамок */',
            'header.vlb-header-compact #vlbRightToolbar,',
            'header.vlb-header-compact #infoBanner,',
            'header.vlb-header-compact #vlbBoardManageGroup {',
            '    display: none !important;',
            '}',
            '',
            '/* Рамка для текстових завдань (Насичена бурштиново-золота) */',
            '.frame-text {',
            '    border: 3.5px solid #f59e0b !important;',
            '    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.38), inset 0 0 0 1.5px #090d16 !important;',
            '}',
            '.frame-text:hover {',
            '    border-color: #fbbf24 !important;',
            '    box-shadow: 0 6px 16px rgba(245, 158, 11, 0.62), inset 0 0 0 1.5px #090d16 !important;',
            '}',
            '',
            '/* Курсори для вільного перетягування картинки в зумі */',
            '#lbViewport {',
            '    overflow: hidden !important;',
            '    position: relative !important;',
            '    user-select: none !important;',
            '    touch-action: none !important;',
            '}',
            '#lbMainImage {',
            '    transition: none !important;',
            '    transform-origin: center center !important;',
            '    will-change: transform;',
            '}',
            '#lbMainImage.lb-can-pan { cursor: grab !important; }',
            '#lbMainImage.lb-is-panning { cursor: grabbing !important; }'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ------------------------------------------------------------------------
       1. ПРИХОВУВАННЯ ВСІХ ІНСТРУМЕНТІВ ТА ФІЛЬТРІВ ПІД КНОПКУ "👁️"
       ------------------------------------------------------------------------ */
    function setupHeaderCompactToggle() {
        const header = document.querySelector('header');
        if (!header) return;

        const topFlexRow = header.firstElementChild;
        if (!topFlexRow) return;

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const rightBlock = searchInput.closest('div.ml-auto');
            if (rightBlock && !rightBlock.id) {
                rightBlock.id = 'vlbRightToolbar';
            }
        }

        const addBoardBtn = document.getElementById('addBoardBtn');
        if (addBoardBtn && addBoardBtn.parentElement && !addBoardBtn.parentElement.id) {
            addBoardBtn.parentElement.id = 'vlbBoardManageGroup';
        }

        let toggleBtn = document.getElementById('vlbHeaderCompactBtn');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.id = 'vlbHeaderCompactBtn';
            toggleBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                isHeaderCompact = !isHeaderCompact;
                try {
                    window.localStorage.setItem(LS_COMPACT_HEADER_KEY, isHeaderCompact ? '1' : '0');
                } catch (err) {}
                applyHeaderCompactState();
            });
            topFlexRow.appendChild(toggleBtn);
        }
        applyHeaderCompactState();
    }

    function applyHeaderCompactState() {
        const header = document.querySelector('header');
        const toggleBtn = document.getElementById('vlbHeaderCompactBtn');
        if (!header || !toggleBtn) return;

        if (isHeaderCompact) {
            header.classList.add('vlb-header-compact');
            toggleBtn.className = 'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-indigo-600 text-gray-200 hover:text-white border border-gray-700 hover:border-indigo-400 text-xs font-bold transition cursor-pointer shadow-sm';
            toggleBtn.innerHTML = '<span>👁️</span>';
            toggleBtn.title = 'Показати приховані інструменти, пошук, хмару та фільтр рамок';
        } else {
            header.classList.remove('vlb-header-compact');
            toggleBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-rose-600/80 text-indigo-200 hover:text-white border border-indigo-500/60 text-xs font-bold transition cursor-pointer shadow-sm';
            toggleBtn.innerHTML = '<span>👁️</span><span>Сховати</span>';
            toggleBtn.title = 'Сховати панель інструментів та фільтр рамок під око';
        }
    }

    /* ------------------------------------------------------------------------
       2. ІНТЕРАКТИВНИЙ КАЛЕНДАР ПРИ РЕДАГУВАННІ ДАТИ / ТЕМИ УРОКУ
       ------------------------------------------------------------------------ */
    const UK_MONTHS = [
        'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    const UK_DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

    function parseDateFromLessonTitle(str) {
        if (!str) return null;
        const m = String(str).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!m) return null;
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        if (mo >= 0 && mo < 12 && d >= 1 && d <= 31) {
            return { day: d, month: mo, year: y, rawMatch: m[0] };
        }
        return null;
    }

    function formatDateUA(year, monthZeroBased, day) {
        const dd = String(day).padStart(2, '0');
        const mm = String(monthZeroBased + 1).padStart(2, '0');
        return dd + '.' + mm + '.' + year;
    }

    function applyPickedDateToLessonInput(dateStr, triggerSaveIfAuto) {
        const inp = document.getElementById('dlgLessonTitle');
        if (!inp) return;
        const currentVal = (inp.value || '').trim();
        const existingDateRegex = /\d{1,2}\.\d{1,2}\.\d{4}/;

        if (!currentVal) {
            inp.value = dateStr;
        } else if (existingDateRegex.test(currentVal)) {
            inp.value = currentVal.replace(existingDateRegex, dateStr);
        } else {
            inp.value = dateStr + ' ' + currentVal;
        }

        if (triggerSaveIfAuto && calendarAutoSave) {
            const confirmBtn = document.getElementById('dialogModalConfirmBtn');
            if (confirmBtn) confirmBtn.click();
        }
    }

    function injectInteractiveCalendarIntoDialog() {
        const titleInp = document.getElementById('dlgLessonTitle');
        if (!titleInp || document.getElementById('vlbLessonCalendarWidget')) return;

        const now = new Date();
        const parsed = parseDateFromLessonTitle(titleInp.value);
        let viewYear = parsed ? parsed.year : now.getFullYear();
        let viewMonth = parsed ? parsed.month : now.getMonth();

        const widget = document.createElement('div');
        widget.id = 'vlbLessonCalendarWidget';
        widget.className = 'mt-3 bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-2.5 select-none';

        function renderCalendarMonth() {
            const currentParsed = parseDateFromLessonTitle(titleInp.value);
            const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

            let daysHtml = '';
            UK_DAYS_SHORT.forEach(function (dName, idx) {
                const isWeekend = idx >= 5;
                daysHtml += '<div class="text-center text-[10px] font-bold py-1 ' + (isWeekend ? 'text-rose-400/80' : 'text-gray-500') + '">' + dName + '</div>';
            });

            for (let i = 0; i < startOffset; i++) {
                daysHtml += '<div></div>';
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const isSelected = currentParsed && currentParsed.year === viewYear && currentParsed.month === viewMonth && currentParsed.day === day;
                const isToday = now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
                const dStr = formatDateUA(viewYear, viewMonth, day);

                let btnCls = 'h-8 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ';
                if (isSelected) {
                    btnCls += 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-300';
                } else if (isToday) {
                    btnCls += 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 hover:bg-indigo-600 hover:text-white';
                } else {
                    btnCls += 'bg-gray-900 hover:bg-indigo-600 text-gray-200 hover:text-white border border-gray-800/80';
                }

                daysHtml += '<button type="button" data-cal-day="' + dStr + '" class="' + btnCls + '">' + day + '</button>';
            }

            widget.innerHTML =
                '<div class="flex items-center justify-between gap-1 flex-wrap border-b border-gray-800 pb-2">' +
                    '<span class="text-[11px] font-bold text-indigo-300">📅 Оберіть дату кліком:</span>' +
                    '<div class="flex items-center gap-1">' +
                        '<button type="button" data-cal-quick="-1" class="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 text-[11px] text-gray-300 border border-gray-700 cursor-pointer">Вчора</button>' +
                        '<button type="button" data-cal-quick="0" class="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-800 text-[11px] text-emerald-300 border border-emerald-600/50 font-semibold cursor-pointer">Сьогодні</button>' +
                        '<button type="button" data-cal-quick="1" class="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 text-[11px] text-gray-300 border border-gray-700 cursor-pointer">Завтра</button>' +
                    '</div>' +
                '</div>' +
                '<div class="flex items-center justify-between px-1">' +
                    '<button type="button" data-cal-nav="-1" class="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-bold border border-gray-800 cursor-pointer">◀</button>' +
                    '<div class="text-xs font-extrabold text-white tracking-wide">' + UK_MONTHS[viewMonth] + ' ' + viewYear + '</div>' +
                    '<button type="button" data-cal-nav="1" class="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-bold border border-gray-800 cursor-pointer">▶</button>' +
                '</div>' +
                '<div class="grid grid-cols-7 gap-1">' + daysHtml + '</div>' +
                '<label class="flex items-center gap-2 pt-1 border-t border-gray-800/80 text-[11px] text-gray-400 cursor-pointer">' +
                    '<input type="checkbox" id="vlbCalAutoSaveChk" ' + (calendarAutoSave ? 'checked' : '') + ' class="accent-indigo-500 rounded cursor-pointer">' +
                    '<span>⚡ Зберігати одразу при кліку на день календаря</span>' +
                '</label>';
        }

        widget.addEventListener('click', function (e) {
            e.stopPropagation();
            const navBtn = e.target.closest('[data-cal-nav]');
            if (navBtn) {
                const delta = parseInt(navBtn.dataset.calNav, 10);
                viewMonth += delta;
                if (viewMonth < 0) { viewMonth = 11; viewYear--; }
                if (viewMonth > 11) { viewMonth = 0; viewYear++; }
                renderCalendarMonth();
                return;
            }

            const quickBtn = e.target.closest('[data-cal-quick]');
            if (quickBtn) {
                const offsetDays = parseInt(quickBtn.dataset.calQuick, 10);
                const d = new Date();
                d.setDate(d.getDate() + offsetDays);
                viewYear = d.getFullYear();
                viewMonth = d.getMonth();
                const formatted = formatDateUA(viewYear, viewMonth, d.getDate());
                applyPickedDateToLessonInput(formatted, true);
                renderCalendarMonth();
                return;
            }

            const dayBtn = e.target.closest('[data-cal-day]');
            if (dayBtn) {
                applyPickedDateToLessonInput(dayBtn.dataset.calDay, true);
                renderCalendarMonth();
            }
        });

        widget.addEventListener('change', function (e) {
            if (e.target && e.target.id === 'vlbCalAutoSaveChk') {
                calendarAutoSave = !!e.target.checked;
                try {
                    window.localStorage.setItem(LS_CAL_AUTOSAVE_KEY, calendarAutoSave ? '1' : '0');
                } catch (err) {}
            }
        });

        titleInp.parentNode.appendChild(widget);
        renderCalendarMonth();
    }

    /* ------------------------------------------------------------------------
       3. ТЕКСТОВІ ЗАВДАННЯ (📝 ТЕКСТ) + ВІКНО ПЕРЕГЛЯДУ ТА 2-Й МОНІТОР
       ------------------------------------------------------------------------ */
    const TEXT_THEMES = {
        amber: { bg1: '#78350f', bg2: '#b45309', accent: '#fcd34d', name: 'Бурштинова' },
        emerald: { bg1: '#064e3b', bg2: '#047857', accent: '#6ee7b7', name: 'Смарагдова' },
        indigo: { bg1: '#1e1b4b', bg2: '#4338ca', accent: '#a5b4fc', name: 'Індиго' },
        rose: { bg1: '#4c0519', bg2: '#be123c', accent: '#fda4af', name: 'Малинова' }
    };

    function isTextTaskCard(card) {
        if (!card) return false;
        return Boolean(card.textContent && String(card.textContent).trim().length > 0) || card.badge === 'text';
    }

    function generateTextCardThumbnail(title, textContent, themeKey) {
        const theme = TEXT_THEMES[themeKey] || TEXT_THEMES.amber;
        const canvas = document.createElement('canvas');
        canvas.width = 280;
        canvas.height = 170;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, theme.bg1);
        grad.addColorStop(1, theme.bg2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(9, 13, 22, 0.45)';
        ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

        const headerText = (title || '📝 ТЕКСТОВЕ ЗАВДАННЯ').trim().slice(0, 26);
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(headerText, 20, 32);

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(20, 40);
        ctx.lineTo(canvas.width - 20, 40);
        ctx.stroke();

        ctx.fillStyle = '#f9fafb';
        ctx.font = '500 13px Inter, sans-serif';

        const rawLines = String(textContent || '').replace(/\r/g, '').split('\n');
        const wrappedLines = [];
        const maxCharsPerLine = 30;

        rawLines.forEach(function (line) {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.length <= maxCharsPerLine) {
                wrappedLines.push(trimmed);
            } else {
                const words = trimmed.split(/\s+/);
                let cur = '';
                words.forEach(function (w) {
                    if ((cur + ' ' + w).trim().length <= maxCharsPerLine) {
                        cur = (cur + ' ' + w).trim();
                    } else {
                        if (cur) wrappedLines.push(cur);
                        cur = w.slice(0, maxCharsPerLine);
                    }
                });
                if (cur) wrappedLines.push(cur);
            }
        });

        const maxVisibleLines = 5;
        wrappedLines.slice(0, maxVisibleLines).forEach(function (ln, idx) {
            const suffix = (idx === maxVisibleLines - 1 && wrappedLines.length > maxVisibleLines) ? '…' : '';
            ctx.fillText(ln + suffix, 20, 62 + idx * 20);
        });

        const out = canvas.toDataURL('image/webp', 0.82);
        return out.indexOf('data:image/webp') === 0 ? out : canvas.toDataURL('image/jpeg', 0.84);
    }

    function openTextCardReaderModal(lessonId, cardId) {
        const found = VLB.findLessonAndCard(lessonId, cardId);
        if (!found || !found.card) return;
        const card = found.card;
        const lesson = found.lesson;

        ensureTextReaderModalExists();
        const modal = document.getElementById('vlbTextReaderModal');
        modal.dataset.lessonId = lessonId;
        modal.dataset.cardId = cardId;

        document.getElementById('vlbTrTitle').textContent = card.title || (lesson ? lesson.number + ' — Текстове завдання' : 'Текстове завдання');
        const contentBox = document.getElementById('vlbTrContent');
        contentBox.textContent = card.textContent || '';

        const editBox = document.getElementById('vlbTrQuickEditArea');
        editBox.classList.add('hidden');
        contentBox.classList.remove('hidden');
        document.getElementById('vlbTrSaveQuickEditBtn').classList.add('hidden');

        modal.classList.remove('hidden');
    }

    function openTextSecondMonitorPopup(lessonId, cardId) {
        const found = VLB.findLessonAndCard(lessonId, cardId);
        if (!found || !found.card) return;
        const card = found.card;
        const title = card.title || 'Текстове завдання';
        const text = card.textContent || '';

        const popup = window.open('', '_blank', 'width=1050,height=780,resizable=yes,scrollbars=yes');
        if (!popup) {
            VLB.showToast('Дозвольте спливаючі вікна у браузері для відкриття на 2-му моніторі', 'rose');
            return;
        }

        const safeTitle = VLB.escapeHtml(title);
        const safeTextJson = JSON.stringify(text);
        const T_SCR_O = '<scr' + 'ipt>';
        const T_SCR_C = '<\/scr' + 'ipt>';

        const html = '<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>📝 ' + safeTitle + '</title>' +
            '<style>' +
            '*{box-sizing:border-box;}body{margin:0;font-family:Inter,Arial,sans-serif;display:flex;flex-direction:column;height:100vh;transition:background 0.2s,color 0.2s;}' +
            'body.theme-dark{background:#090d16;color:#f9fafb;}' +
            'body.theme-warm{background:#fef3c7;color:#1f2937;}' +
            'body.theme-light{background:#ffffff;color:#111827;}' +
            'header{padding:10px 18px;background:#111827;color:#f3f4f6;border-bottom:1px solid #374151;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}' +
            '.btn{background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;}' +
            '.btn:hover{background:#374151;color:#fff;}' +
            '#readerArea{flex:1;overflow-y:auto;padding:36px 48px;max-width:1100px;width:100%;margin:0 auto;white-space:pre-wrap;line-height:1.65;font-size:28px;font-weight:500;}' +
            '</style></head><body class="theme-dark">' +
            '<header>' +
                '<div style="font-weight:800;font-size:15px;color:#fbbf24;">📝 ' + safeTitle + '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                    '<button class="btn" onclick="changeFont(-4)">A−</button>' +
                    '<span id="fontLbl" style="font-family:monospace;font-size:13px;min-width:48px;text-align:center;">28px</span>' +
                    '<button class="btn" onclick="changeFont(4)">A+</button>' +
                    '<button class="btn" onclick="setTheme(\'dark\')">🌙 Темний</button>' +
                    '<button class="btn" onclick="setTheme(\'warm\')">📜 Кремовий</button>' +
                    '<button class="btn" onclick="setTheme(\'light\')">☀️ Світлий</button>' +
                '</div>' +
            '</header>' +
            '<div id="readerArea"></div>' +
            T_SCR_O +
                'const rawText = ' + safeTextJson + ';' +
                'let fSize = 28;' +
                'const area = document.getElementById("readerArea");' +
                'area.textContent = rawText;' +
                'function changeFont(d){ fSize = Math.max(16, Math.min(72, fSize + d)); area.style.fontSize = fSize + "px"; document.getElementById("fontLbl").textContent = fSize + "px"; }' +
                'function setTheme(t){ document.body.className = "theme-" + t; }' +
            T_SCR_C +
            '</body></html>';

        popup.document.open();
        popup.document.write(html);
        popup.document.close();
    }

    function ensureTextReaderModalExists() {
        if (document.getElementById('vlbTextReaderModal')) return;
        const modal = document.createElement('div');
        modal.id = 'vlbTextReaderModal';
        modal.className = 'fixed inset-0 z-50 hidden modal-bg flex items-center justify-center p-3 sm:p-6';
        modal.innerHTML =
            '<div class="bg-[#111827] border-2 border-amber-500/60 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">' +
                '<div class="px-5 py-3.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-3 flex-wrap">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<span class="px-2.5 py-1 rounded-lg bg-amber-500 text-gray-950 font-extrabold text-xs">📝 Текст</span>' +
                        '<h3 id="vlbTrTitle" class="font-bold text-sm sm:text-base text-white truncate">Текстове завдання</h3>' +
                    '</div>' +
                    '<div class="flex items-center gap-1.5 flex-wrap">' +
                        '<div class="flex items-center bg-gray-950 border border-gray-800 rounded-xl p-0.5">' +
                            '<button type="button" id="vlbTrFontMinus" class="px-2.5 py-1 text-gray-300 hover:text-white text-xs font-bold cursor-pointer">A−</button>' +
                            '<span id="vlbTrFontLabel" class="px-2 text-xs font-mono text-amber-300">22px</span>' +
                            '<button type="button" id="vlbTrFontPlus" class="px-2.5 py-1 text-gray-300 hover:text-white text-xs font-bold cursor-pointer">A+</button>' +
                        '</div>' +
                        '<button type="button" id="vlbTrSecondMonBtn" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer">🖥️ На 2-й монітор</button>' +
                        '<button type="button" id="vlbTrCopyBtn" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">📋 Скопіювати</button>' +
                        '<button type="button" id="vlbTrToggleEditBtn" class="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs font-semibold cursor-pointer">✏️ Редагувати</button>' +
                        '<button type="button" id="vlbTrCloseBtn" class="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-rose-600 text-gray-200 hover:text-white text-xs font-bold cursor-pointer">✕</button>' +
                    '</div>' +
                '</div>' +
                '<div class="p-6 overflow-y-auto flex-1 bg-[#0b101d]">' +
                    '<div id="vlbTrContent" style="font-size:22px;line-height:1.65;" class="text-gray-100 whitespace-pre-wrap font-medium selection:bg-amber-500 selection:text-gray-950"></div>' +
                    '<textarea id="vlbTrQuickEditArea" rows="10" class="hidden w-full bg-gray-950 border border-amber-500/60 rounded-xl p-4 text-base text-white focus:outline-none leading-relaxed"></textarea>' +
                '</div>' +
                '<div class="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between gap-2">' +
                    '<span class="text-[11px] text-gray-400">Можна збільшити шрифт кнопками A+ / A− або вивести у чисте вікно на 2-й монітор</span>' +
                    '<div class="flex items-center gap-2">' +
                        '<button type="button" id="vlbTrSaveQuickEditBtn" class="hidden px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow">💾 Зберегти зміни тексту</button>' +
                        '<button type="button" id="vlbTrCloseBottomBtn" class="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer">Закрити</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        let readerFontSize = 22;
        const updateReaderFont = function (delta) {
            readerFontSize = Math.max(14, Math.min(56, readerFontSize + delta));
            document.getElementById('vlbTrContent').style.fontSize = readerFontSize + 'px';
            document.getElementById('vlbTrFontLabel').textContent = readerFontSize + 'px';
        };

        document.getElementById('vlbTrFontMinus').addEventListener('click', function () { updateReaderFont(-3); });
        document.getElementById('vlbTrFontPlus').addEventListener('click', function () { updateReaderFont(3); });

        const closeTr = function () { modal.classList.add('hidden'); };
        document.getElementById('vlbTrCloseBtn').addEventListener('click', closeTr);
        document.getElementById('vlbTrCloseBottomBtn').addEventListener('click', closeTr);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeTr(); });

        document.getElementById('vlbTrSecondMonBtn').addEventListener('click', function () {
            openTextSecondMonitorPopup(modal.dataset.lessonId, modal.dataset.cardId);
        });

        document.getElementById('vlbTrCopyBtn').addEventListener('click', function () {
            const txt = document.getElementById('vlbTrContent').textContent || '';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt).catch(function () {});
            }
            VLB.showToast('Текст скопійовано в буфер обміну!', 'emerald');
        });

        document.getElementById('vlbTrToggleEditBtn').addEventListener('click', function () {
            const contentBox = document.getElementById('vlbTrContent');
            const editBox = document.getElementById('vlbTrQuickEditArea');
            const saveBtn = document.getElementById('vlbTrSaveQuickEditBtn');
            if (editBox.classList.contains('hidden')) {
                editBox.value = contentBox.textContent || '';
                contentBox.classList.add('hidden');
                editBox.classList.remove('hidden');
                saveBtn.classList.remove('hidden');
                editBox.focus();
            } else {
                contentBox.classList.remove('hidden');
                editBox.classList.add('hidden');
                saveBtn.classList.add('hidden');
            }
        });

        document.getElementById('vlbTrSaveQuickEditBtn').addEventListener('click', function () {
            const found = VLB.findLessonAndCard(modal.dataset.lessonId, modal.dataset.cardId);
            if (!found || !found.card) return;
            const newTxt = document.getElementById('vlbTrQuickEditArea').value;
            found.card.textContent = newTxt;
            found.card.badge = 'text';
            found.card.image = generateTextCardThumbnail(found.card.title, newTxt, found.card.textBg || 'amber');
            found.card.thumbReady = true;

            document.getElementById('vlbTrContent').textContent = newTxt;
            document.getElementById('vlbTrQuickEditArea').classList.add('hidden');
            document.getElementById('vlbTrContent').classList.remove('hidden');
            document.getElementById('vlbTrSaveQuickEditBtn').classList.add('hidden');

            VLB.saveState();
            VLB.renderLessonsList();
            VLB.showToast('Текст завдання оновлено!', 'emerald');
        });
    }

    /* ------------------------------------------------------------------------
       4. ВІЛЬНЕ ПЕРЕТЯГУВАННЯ КАРТИНКИ ПРИ НАБЛИЖЕННІ (PAN & ZOOM У LIGHTBOX)
       ------------------------------------------------------------------------ */
    let lbPanX = 0;
    let lbPanY = 0;
    let lbCurrentScale = 1;
    let isDraggingLb = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;

    function applyEnhancedLightboxTransform() {
        const img = document.getElementById('lbMainImage');
        const lbl = document.getElementById('lbZoomPercent');
        if (!img) return;

        if (lbCurrentScale <= 1.01) {
            lbPanX = 0;
            lbPanY = 0;
            img.classList.remove('lb-can-pan', 'lb-is-panning');
        } else {
            img.classList.add('lb-can-pan');
        }

        img.style.transform = 'translate3d(' + Math.round(lbPanX) + 'px, ' + Math.round(lbPanY) + 'px, 0) scale(' + lbCurrentScale + ')';
        if (lbl) lbl.textContent = Math.round(lbCurrentScale * 100) + '%';
    }

    function resetLightboxPanAndZoom() {
        lbPanX = 0;
        lbPanY = 0;
        lbCurrentScale = 1;
        applyEnhancedLightboxTransform();
    }

    function setupLightboxPanAndZoom() {
        const viewport = document.getElementById('lbViewport');
        const img = document.getElementById('lbMainImage');
        if (!viewport || !img || viewport.dataset.panInitialized === '1') return;
        viewport.dataset.panInitialized = '1';

        img.removeAttribute('data-action');

        viewport.addEventListener('wheel', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const rect = viewport.getBoundingClientRect();
            const cursorX = e.clientX - (rect.left + rect.width / 2);
            const cursorY = e.clientY - (rect.top + rect.height / 2);

            const factor = e.deltaY < 0 ? 1.22 : (1 / 1.22);
            const nextScale = Math.min(5, Math.max(0.5, +(lbCurrentScale * factor).toFixed(3)));

            if (nextScale <= 1.02) {
                lbCurrentScale = 1;
                lbPanX = 0;
                lbPanY = 0;
            } else {
                const ratio = nextScale / lbCurrentScale;
                lbPanX = cursorX - (cursorX - lbPanX) * ratio;
                lbPanY = cursorY - (cursorY - lbPanY) * ratio;
                lbCurrentScale = nextScale;
            }
            applyEnhancedLightboxTransform();
        }, { capture: true, passive: false });

        img.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            if (lbCurrentScale <= 1.01) {
                const rect = viewport.getBoundingClientRect();
                const cursorX = e.clientX - (rect.left + rect.width / 2);
                const cursorY = e.clientY - (rect.top + rect.height / 2);
                const nextScale = 1.85;
                lbPanX = cursorX - cursorX * (nextScale / lbCurrentScale);
                lbPanY = cursorY - cursorY * (nextScale / lbCurrentScale);
                lbCurrentScale = nextScale;
                applyEnhancedLightboxTransform();
                return;
            }
            isDraggingLb = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            panStartX = lbPanX;
            panStartY = lbPanY;
            img.classList.add('lb-is-panning');
        });

        window.addEventListener('mousemove', function (e) {
            if (!isDraggingLb) return;
            lbPanX = panStartX + (e.clientX - dragStartX);
            lbPanY = panStartY + (e.clientY - dragStartY);
            applyEnhancedLightboxTransform();
        });

        window.addEventListener('mouseup', function () {
            if (isDraggingLb) {
                isDraggingLb = false;
                img.classList.remove('lb-is-panning');
            }
        });

        img.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1 && lbCurrentScale > 1.01) {
                isDraggingLb = true;
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                panStartX = lbPanX;
                panStartY = lbPanY;
            }
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            if (!isDraggingLb || e.touches.length !== 1) return;
            lbPanX = panStartX + (e.touches[0].clientX - dragStartX);
            lbPanY = panStartY + (e.touches[0].clientY - dragStartY);
            applyEnhancedLightboxTransform();
        }, { passive: true });

        window.addEventListener('touchend', function () {
            isDraggingLb = false;
        });

        img.addEventListener('dblclick', function (e) {
            e.preventDefault();
            e.stopPropagation();
            resetLightboxPanAndZoom();
        });

        const lbModal = document.getElementById('lightboxModal');
        if (lbModal) {
            lbModal.addEventListener('click', function (e) {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const act = btn.dataset.action;
                if (act === 'lb-zoom-in') {
                    e.stopImmediatePropagation();
                    lbCurrentScale = Math.min(5, +(lbCurrentScale + 0.35).toFixed(2));
                    applyEnhancedLightboxTransform();
                } else if (act === 'lb-zoom-out') {
                    e.stopImmediatePropagation();
                    lbCurrentScale = Math.max(0.5, +(lbCurrentScale - 0.35).toFixed(2));
                    if (lbCurrentScale <= 1.02) { lbPanX = 0; lbPanY = 0; }
                    applyEnhancedLightboxTransform();
                } else if (act === 'lb-zoom-reset') {
                    e.stopImmediatePropagation();
                    resetLightboxPanAndZoom();
                } else if (act === 'lb-prev-img' || act === 'lb-next-img') {
                    setTimeout(resetLightboxPanAndZoom, 10);
                }
            }, true);

            const lbObs = new MutationObserver(function () {
                if (!lbModal.classList.contains('hidden')) {
                    resetLightboxPanAndZoom();
                }
            });
            lbObs.observe(lbModal, { attributes: true, attributeFilter: ['class'] });
        }
    }

    /* ------------------------------------------------------------------------
       5. РОЗУМНЕ ПОРІВНЯННЯ ІГОР ТА МОДЕРНІЗАЦІЯ МОДАЛКИ "ДОДАТИ ЗАВДАННЯ"
       ------------------------------------------------------------------------ */
    function normalizeUrlKey(rawUrl) {
        let u = VLB.cleanPathQuotes(rawUrl || '').toLowerCase();
        if (!u) return '';
        u = u.replace(/\/+$/, '');
        if (u.length > 3 && u.charAt(1) === ':' && (u.charAt(2) === BS || u.charAt(2) === '/')) {
            return 'local_rel:' + u.slice(2).replace(/\//g, BS);
        }
        return 'url:' + u;
    }

    function getCardMatchSignatures(card) {
        if (!card) return [];
        const sigs = [];
        const urlKey = normalizeUrlKey(card.url);
        if (urlKey) sigs.push(urlKey);

        const cleanTitle = (card.title || '').trim().toLowerCase();
        if (cleanTitle && cleanTitle.length >= 3) {
            sigs.push('title:' + cleanTitle);
        }

        if (card.textContent && String(card.textContent).trim().length >= 5) {
            sigs.push('text:' + String(card.textContent).trim().slice(0, 80).toLowerCase());
        }

        if (sigs.length === 0 && card.image && card.image.length > 120) {
            sigs.push('img:' + card.image.length + ':' + card.image.slice(-80));
        }
        return sigs;
    }

    function doCardsMatch(cardA, cardB) {
        const sigsA = getCardMatchSignatures(cardA);
        const sigsB = getCardMatchSignatures(cardB);
        if (sigsA.length === 0 || sigsB.length === 0) return false;

        const urlA = normalizeUrlKey(cardA.url);
        const urlB = normalizeUrlKey(cardB.url);
        if (urlA && urlB) {
            return urlA === urlB;
        }
        for (let i = 0; i < sigsA.length; i++) {
            if (sigsB.indexOf(sigsA[i]) !== -1) return true;
        }
        return false;
    }

    function isStudentBoard(boardId) {
        const state = VLB.getState();
        if (!state || !boardId) return false;
        if (boardId === 'b_root_students' || boardId === 'b_root_topics') return false;

        const path = VLB.getBoardBreadcrumbPath(boardId);
        if (!path || path.length === 0) return false;

        const rootBoard = path[0];
        if (rootBoard.id === 'b_root_students') return true;
        if (rootBoard.id === 'b_root_topics') return false;

        const rootName = (rootBoard.name || '').toLowerCase();
        if (rootName.indexOf('тем') !== -1) return false;
        return true;
    }

    function findCardOccurrencesEverywhere(referenceCard, excludeCardId) {
        const state = VLB.getState();
        const studentHits = [];
        const currentBoardHits = [];
        const allHits = [];

        if (!state || !Array.isArray(state.boards)) {
            return { studentHits: studentHits, currentBoardHits: currentBoardHits, allHits: allHits };
        }

        state.boards.forEach(function (board) {
            const isStud = isStudentBoard(board.id);
            const fullBoardName = VLB.getBoardFullTitle(board.id);
            (board.lessons || []).forEach(function (lesson) {
                (lesson.cards || []).forEach(function (c) {
                    if (excludeCardId && c.id === excludeCardId) return;
                    if (doCardsMatch(referenceCard, c)) {
                        const hit = {
                            boardId: board.id,
                            boardName: board.name,
                            boardFullTitle: fullBoardName,
                            isStudent: isStud,
                            lessonId: lesson.id,
                            lessonNumber: lesson.number || 'Урок',
                            lessonTitle: lesson.title || '',
                            lessonDate: lesson.date || '',
                            cardId: c.id,
                            cardTitle: c.title || '',
                            cardUrl: c.url || '',
                            cardImage: c.image || ''
                        };
                        allHits.push(hit);
                        if (isStud) studentHits.push(hit);
                        if (board.id === state.activeBoardId) currentBoardHits.push(hit);
                    }
                });
            });
        });

        return {
            studentHits: studentHits,
            currentBoardHits: currentBoardHits,
            allHits: allHits
        };
    }

    function setupCardModalModesAndCatalog() {
        const cardModal = document.getElementById('cardModal');
        if (!cardModal || document.getElementById('vlbModalModeBar')) return;

        const modalDialogBox = cardModal.firstElementChild;
        const scrollContainer = cardModal.querySelector('div.p-5.space-y-4');
        const lessonSelectBox = scrollContainer ? scrollContainer.firstElementChild : null;
        if (!scrollContainer || !lessonSelectBox) return;

        const standardFieldsWrap = document.createElement('div');
        standardFieldsWrap.id = 'vlbModalStandardPane';
        standardFieldsWrap.className = 'space-y-4';

        while (lessonSelectBox.nextSibling) {
            standardFieldsWrap.appendChild(lessonSelectBox.nextSibling);
        }

        const modeBar = document.createElement('div');
        modeBar.id = 'vlbModalModeBar';
        modeBar.className = 'grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800';
        modeBar.innerHTML =
            '<button type="button" data-vlb-modal-mode="standard" class="py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5">' +
                '<span>🖼️</span><span>Скріншот / Посилання</span>' +
            '</button>' +
            '<button type="button" data-vlb-modal-mode="text" class="py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5">' +
                '<span>📝</span><span>Текстове завдання</span>' +
            '</button>' +
            '<button type="button" data-vlb-modal-mode="catalog" class="py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5">' +
                '<span>📚</span><span>З бази тем / уроків</span>' +
            '</button>';

        const textPane = document.createElement('div');
        textPane.id = 'vlbModalTextPane';
        textPane.className = 'hidden space-y-3.5 bg-gray-900/60 border border-amber-500/30 rounded-xl p-4';
        textPane.innerHTML =
            '<div>' +
                '<label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">1. Заголовок текстового завдання (необов\'язково):</label>' +
                '<input id="vlbTextCardTitleInput" type="text" placeholder="Напр.: Слова для читання, Задача №3, Словниковий диктант..." ' +
                    'class="w-full bg-gray-950 border border-gray-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none">' +
            '</div>' +
            '<div>' +
                '<label class="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">2. Текст завдання (напишіть або вставте через Ctrl + V):</label>' +
                '<textarea id="vlbTextCardContentInput" rows="7" placeholder="Введіть або вставте сюди текст завдання..." ' +
                    'class="w-full bg-gray-950 border border-gray-700 focus:border-amber-500 rounded-xl p-3.5 text-sm text-white focus:outline-none leading-relaxed"></textarea>' +
            '</div>' +
            '<div class="flex items-center justify-between flex-wrap gap-2 pt-1">' +
                '<span class="text-xs text-gray-400 font-medium">Колір обкладинки картки:</span>' +
                '<div id="vlbTextThemePicker" class="flex items-center gap-2">' +
                    '<button type="button" data-text-theme="amber" class="px-3 py-1 rounded-lg text-xs font-bold bg-amber-700 text-white ring-2 ring-white cursor-pointer">🟠 Бурштинова</button>' +
                    '<button type="button" data-text-theme="emerald" class="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-800 text-emerald-100 cursor-pointer">🟢 Смарагдова</button>' +
                    '<button type="button" data-text-theme="indigo" class="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-800 text-indigo-100 cursor-pointer">🔵 Індиго</button>' +
                    '<button type="button" data-text-theme="rose" class="px-3 py-1 rounded-lg text-xs font-bold bg-rose-800 text-rose-100 cursor-pointer">🔴 Малинова</button>' +
                '</div>' +
            '</div>';

        const catalogPane = document.createElement('div');
        catalogPane.id = 'vlbModalCatalogPane';
        catalogPane.className = 'hidden space-y-3';
        catalogPane.innerHTML =
            '<div class="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">' +
                '<div class="relative flex-1 min-w-[200px]">' +
                    '<input id="vlbCatalogSearchInput" type="text" placeholder="🔍 Швидкий пошук гри по всіх темах або за назвою..." ' +
                        'class="w-full bg-gray-950 border border-gray-700 focus:border-indigo-500 rounded-xl pl-3 pr-8 py-1.5 text-xs sm:text-sm text-white focus:outline-none">' +
                '</div>' +
                '<div class="flex items-center gap-1 flex-wrap text-[11px]" id="vlbCatalogTypeFilterBar">' +
                    '<button type="button" data-cat-type="all" class="px-2.5 py-1 rounded-lg font-bold bg-indigo-600 text-white cursor-pointer">Усі</button>' +
                    '<button type="button" data-cat-type="web" class="px-2 py-1 rounded-lg font-semibold bg-sky-950 text-sky-300 border border-sky-500/40 cursor-pointer">🌐 Сайт</button>' +
                    '<button type="button" data-cat-type="local" class="px-2 py-1 rounded-lg font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40 cursor-pointer">💻 ПК</button>' +
                    '<button type="button" data-cat-type="pdf" class="px-2 py-1 rounded-lg font-semibold bg-rose-950 text-rose-300 border border-rose-500/40 cursor-pointer">📄 PDF</button>' +
                    '<button type="button" data-cat-type="gallery" class="px-2 py-1 rounded-lg font-semibold bg-purple-950 text-purple-300 border border-purple-500/40 cursor-pointer">🖥️ Картинки</button>' +
                    '<button type="button" data-cat-type="text" class="px-2 py-1 rounded-lg font-semibold bg-amber-950 text-amber-300 border border-amber-500/40 cursor-pointer">📝 Текст</button>' +
                '</div>' +
            '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[380px] max-h-[54vh]">' +
                '<div id="vlbCatalogFoldersList" class="md:col-span-4 bg-gray-950 border border-gray-800 rounded-xl p-2.5 overflow-y-auto space-y-1 max-h-[54vh]"></div>' +
                '<div id="vlbCatalogCardsArea" class="md:col-span-8 bg-gray-950 border border-gray-800 rounded-xl p-3 overflow-y-auto space-y-3 max-h-[54vh]"></div>' +
            '</div>';

        scrollContainer.appendChild(modeBar);
        scrollContainer.appendChild(standardFieldsWrap);
        scrollContainer.appendChild(textPane);
        scrollContainer.appendChild(catalogPane);

        modeBar.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-vlb-modal-mode]');
            if (!btn) return;
            e.stopPropagation();
            switchCardModalMode(btn.dataset.vlbModalMode);
        });

        document.getElementById('vlbTextThemePicker').addEventListener('click', function (e) {
            const tBtn = e.target.closest('[data-text-theme]');
            if (!tBtn) return;
            selectedTextCardTheme = tBtn.dataset.textTheme;
            document.querySelectorAll('#vlbTextThemePicker [data-text-theme]').forEach(function (b) {
                if (b.dataset.textTheme === selectedTextCardTheme) {
                    b.classList.add('ring-2', 'ring-white');
                } else {
                    b.classList.remove('ring-2', 'ring-white');
                }
            });
        });

        document.getElementById('vlbCatalogSearchInput').addEventListener('input', function (e) {
            catalogSearchQuery = e.target.value || '';
            renderCatalogCardsArea();
        });

        document.getElementById('vlbCatalogTypeFilterBar').addEventListener('click', function (e) {
            const fBtn = e.target.closest('[data-cat-type]');
            if (!fBtn) return;
            catalogTypeFilter = fBtn.dataset.catType;
            document.querySelectorAll('#vlbCatalogTypeFilterBar [data-cat-type]').forEach(function (b) {
                if (b.dataset.catType === catalogTypeFilter) {
                    b.classList.add('ring-2', 'ring-white');
                } else {
                    b.classList.remove('ring-2', 'ring-white');
                }
            });
            renderCatalogCardsArea();
        });

        const saveMainBtn = cardModal.querySelector('[data-action="save-card-main"]');
        if (saveMainBtn) {
            saveMainBtn.addEventListener('click', function (e) {
                if (activeModalMode === 'text') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    saveTextTaskFromModal();
                }
            }, true);
        }

        function switchCardModalMode(mode) {
            activeModalMode = mode;
            const saveBtn = cardModal.querySelector('[data-action="save-card-main"]');

            document.querySelectorAll('#vlbModalModeBar [data-vlb-modal-mode]').forEach(function (b) {
                const isAct = b.dataset.vlbModalMode === mode;
                b.className = isAct
                    ? 'py-2 px-3 rounded-lg text-xs font-extrabold bg-indigo-600 text-white shadow cursor-pointer flex items-center justify-center gap-1.5'
                    : 'py-2 px-3 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-900 cursor-pointer flex items-center justify-center gap-1.5';
            });

            standardFieldsWrap.classList.toggle('hidden', mode !== 'standard');
            textPane.classList.toggle('hidden', mode !== 'text');
            catalogPane.classList.toggle('hidden', mode !== 'catalog');

            if (modalDialogBox) {
                if (mode === 'catalog') {
                    modalDialogBox.classList.remove('max-w-2xl');
                    modalDialogBox.classList.add('max-w-5xl');
                } else {
                    modalDialogBox.classList.remove('max-w-5xl');
                    modalDialogBox.classList.add('max-w-2xl');
                }
            }

            if (saveBtn) {
                saveBtn.classList.toggle('hidden', mode === 'catalog');
            }

            if (mode === 'text') {
                setTimeout(function () {
                    const ta = document.getElementById('vlbTextCardContentInput');
                    if (ta) ta.focus();
                }, 40);
            } else if (mode === 'catalog') {
                renderCatalogFoldersSidebar();
                renderCatalogCardsArea();
            }
        }

        window._vlbSwitchCardModalMode = switchCardModalMode;
    }

    function saveTextTaskFromModal() {
        const state = VLB.getState();
        const board = VLB.getBoardById(state.activeBoardId);
        if (!board) return;

        const selectedLessonId = document.getElementById('modalLessonSelect').value || state.activeLessonId;
        const targetLesson = (board.lessons || []).find(function (l) { return l.id === selectedLessonId; }) || board.lessons[0];
        if (!targetLesson) return;

        const title = (document.getElementById('vlbTextCardTitleInput').value || '').trim();
        const textContent = (document.getElementById('vlbTextCardContentInput').value || '').trim();

        if (!textContent) {
            VLB.showToast('Введіть або вставте текст завдання!', 'rose');
            return;
        }

        const thumbDataUrl = generateTextCardThumbnail(title, textContent, selectedTextCardTheme);

        if (currentEditingTextCardId) {
            const found = VLB.findLessonAndCard(selectedLessonId, currentEditingTextCardId);
            const cardObj = found && found.card ? found.card : null;
            if (cardObj) {
                cardObj.title = title;
                cardObj.textContent = textContent;
                cardObj.textBg = selectedTextCardTheme;
                cardObj.badge = 'text';
                cardObj.image = thumbDataUrl;
                cardObj.thumbReady = true;
            }
            currentEditingTextCardId = null;
            VLB.showToast('Текстове завдання оновлено!', 'emerald');
        } else {
            if (!Array.isArray(targetLesson.cards)) targetLesson.cards = [];
            targetLesson.cards.push({
                id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                title: title,
                url: '',
                badge: 'text',
                textContent: textContent,
                textBg: selectedTextCardTheme,
                image: thumbDataUrl,
                galleryCount: 1,
                thumbReady: true
            });
            VLB.showToast('Текстове завдання додано у «' + targetLesson.number + '»!', 'emerald');
        }

        document.getElementById('cardModal').classList.add('hidden');
        VLB.saveState();
        VLB.renderLessonsList();
    }

    /* ------------------------------------------------------------------------
       КАТАЛОГ ІГОР ІЗ ТЕМ / КАТЕГОРІЙ УСЕРЕДИНІ МОДАЛКИ ДОДАВАННЯ
       ------------------------------------------------------------------------ */
    function getCatalogBoardTreeOrdered() {
        const state = VLB.getState();
        if (!state || !Array.isArray(state.boards)) return [];

        const result = [];
        const visited = {};

        function walk(parentId, depth) {
            const children = VLB.getChildBoards(parentId);
            children.sort(function (a, b) {
                if (a.id === 'b_root_topics') return -1;
                if (b.id === 'b_root_topics') return 1;
                return 0;
            });
            children.forEach(function (ch) {
                if (visited[ch.id]) return;
                visited[ch.id] = true;
                const cardsTotal = (ch.lessons || []).reduce(function (s, l) {
                    return s + (l.cards ? l.cards.length : 0);
                }, 0);
                result.push({
                    board: ch,
                    depth: depth,
                    lessonsCount: (ch.lessons || []).length,
                    cardsCount: cardsTotal
                });
                walk(ch.id, depth + 1);
            });
        }

        walk(null, 0);
        return result;
    }

    function renderCatalogFoldersSidebar() {
        const listEl = document.getElementById('vlbCatalogFoldersList');
        if (!listEl) return;

        const tree = getCatalogBoardTreeOrdered();
        const state = VLB.getState();

        if (!catalogSelectedBoardId || !VLB.getBoardById(catalogSelectedBoardId)) {
            const firstTopicWithCards = tree.find(function (item) {
                return item.cardsCount > 0 && !isStudentBoard(item.board.id) && item.board.id !== state.activeBoardId;
            }) || tree.find(function (item) { return item.cardsCount > 0; });
            if (firstTopicWithCards) {
                catalogSelectedBoardId = firstTopicWithCards.board.id;
            }
        }

        let html = '<div class="text-[11px] font-bold uppercase tracking-wider text-indigo-300 px-2 py-1">📂 Оберіть тему або папку:</div>';
        tree.forEach(function (item) {
            const b = item.board;
            const isSelected = b.id === catalogSelectedBoardId && !catalogSearchQuery.trim();
            const indentPx = Math.min(item.depth * 12, 48);
            const isRootGroup = item.depth === 0 && item.cardsCount === 0;

            if (isRootGroup) {
                html += '<div class="px-2 pt-2 pb-1 text-[11px] font-extrabold text-amber-300 uppercase tracking-wider border-t border-gray-800/80 mt-1">' +
                    VLB.escapeHtml(b.name) + '</div>';
                return;
            }

            html +=
                '<button type="button" data-cat-board-id="' + b.id + '" style="padding-left:' + (10 + indentPx) + 'px" ' +
                    'class="w-full text-left py-1.5 pr-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-between gap-1.5 cursor-pointer ' +
                    (isSelected ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-900 hover:text-white') + '">' +
                    '<span class="truncate">📁 ' + VLB.escapeHtml(b.name) + '</span>' +
                    (item.cardsCount > 0
                        ? '<span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ' + (isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-gray-800 text-gray-400') + '">' + item.cardsCount + '</span>'
                        : '') +
                '</button>';
        });

        listEl.innerHTML = html;

        listEl.onclick = function (e) {
            const btn = e.target.closest('[data-cat-board-id]');
            if (!btn) return;
            catalogSelectedBoardId = btn.dataset.catBoardId;
            const searchInp = document.getElementById('vlbCatalogSearchInput');
            if (searchInp && searchInp.value.trim()) {
                catalogSearchQuery = '';
                searchInp.value = '';
            }
            renderCatalogFoldersSidebar();
            renderCatalogCardsArea();
        };
    }

    function renderCatalogCardsArea() {
        const area = document.getElementById('vlbCatalogCardsArea');
        if (!area) return;

        const state = VLB.getState();
        const activeStudentBoard = VLB.getBoardById(state.activeBoardId);
        const targetLessonId = document.getElementById('modalLessonSelect')
            ? document.getElementById('modalLessonSelect').value
            : state.activeLessonId;

        const q = (catalogSearchQuery || '').trim().toLowerCase();
        let boardsToShow = [];

        if (q) {
            boardsToShow = state.boards || [];
        } else {
            const selB = VLB.getBoardById(catalogSelectedBoardId);
            if (selB) {
                boardsToShow = [selB];
                const subChildren = VLB.getChildBoards(selB.id);
                subChildren.forEach(function (sc) { boardsToShow.push(sc); });
            }
        }

        const lessonBlocksHtml = [];

        boardsToShow.forEach(function (b) {
            const fullBTitle = VLB.getBoardFullTitle(b.id);
            (b.lessons || []).forEach(function (lesson) {
                const matchingCards = (lesson.cards || []).filter(function (c) {
                    const cType = isTextTaskCard(c) ? 'text' : VLB.classifyCard(c);
                    if (catalogTypeFilter !== 'all' && cType !== catalogTypeFilter) return false;
                    if (!q) return true;
                    const hay = ((b.name || '') + ' ' + (lesson.number || '') + ' ' + (lesson.title || '') + ' ' + (c.title || '') + ' ' + (c.url || '') + ' ' + (c.textContent || '')).toLowerCase();
                    return hay.indexOf(q) !== -1;
                });

                if (matchingCards.length === 0) return;

                let cardsGridHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">';
                matchingCards.forEach(function (card) {
                    const isTxt = isTextTaskCard(card);
                    const cType = isTxt ? 'text' : VLB.classifyCard(card);
                    const galCount = VLB.getCardGalleryCount(card);
                    const fInfo = isTxt
                        ? { frameClass: 'frame-text', badgeText: '📝 Текст', badgeClass: 'bg-amber-500 text-gray-950' }
                        : VLB.getFrameInfo(cType, galCount);

                    const occ = findCardOccurrencesEverywhere(card, null);
                    const alreadyInThisBoard = occ.currentBoardHits;
                    const alreadyBadgeHtml = alreadyInThisBoard.length > 0
                        ? '<span class="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-amber-500 text-gray-950 font-extrabold text-[9px] shadow">⚠️ Вже є (' + VLB.escapeHtml(alreadyInThisBoard[0].lessonNumber) + ')</span>'
                        : '';

                    const labelText = card.title || (card.url ? card.url.split(BS).pop().split('/').pop() : (isTxt ? 'Текстове завдання' : 'Завдання'));

                    cardsGridHtml +=
                        '<div data-cat-card-wrap="1" class="bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-xl p-1.5 flex flex-col justify-between gap-1.5 transition shadow">' +
                            '<div data-cat-pick-lesson="' + lesson.id + '" data-cat-pick-card="' + card.id + '" ' +
                                'title="Клікніть, щоб одразу додати це завдання у поточний урок" ' +
                                'class="relative h-24 w-full rounded-lg bg-gray-950 overflow-hidden cursor-pointer flex items-center justify-center ' + fInfo.frameClass + '">' +
                                '<img src="' + (card.image || '') + '" loading="lazy" class="h-full w-auto max-w-full object-contain pointer-events-none">' +
                                alreadyBadgeHtml +
                                '<span class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ' + fInfo.badgeClass + '">' + fInfo.badgeText + '</span>' +
                                '<button type="button" data-cat-zoom-lesson="' + lesson.id + '" data-cat-zoom-card="' + card.id + '" ' +
                                    'title="Збільшити для перегляду" ' +
                                    'class="absolute top-1 right-1 z-20 w-6 h-6 rounded bg-gray-950/90 hover:bg-amber-500 text-amber-300 hover:text-gray-950 text-xs flex items-center justify-center cursor-pointer">🔍</button>' +
                            '</div>' +
                            '<div class="flex items-center justify-between gap-1 px-0.5">' +
                                '<div class="text-[11px] text-gray-300 font-medium truncate" title="' + VLB.escapeHtml(labelText) + '">' + VLB.escapeHtml(labelText) + '</div>' +
                                '<button type="button" data-cat-pick-lesson="' + lesson.id + '" data-cat-pick-card="' + card.id + '" ' +
                                    'class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-emerald-600 text-white text-[10px] font-bold shrink-0 cursor-pointer transition">+ В урок</button>' +
                            '</div>' +
                        '</div>';
                });
                cardsGridHtml += '</div>';

                lessonBlocksHtml.push(
                    '<div class="bg-gray-900/50 border border-gray-800/90 rounded-xl p-3 space-y-2">' +
                        '<div class="flex items-center justify-between gap-2 border-b border-gray-800 pb-1.5">' +
                            '<div class="flex items-center gap-2 flex-wrap">' +
                                '<span class="text-xs font-extrabold text-indigo-300">📂 ' + VLB.escapeHtml(fullBTitle) + '</span>' +
                                '<span class="px-2 py-0.5 rounded bg-indigo-600/25 text-indigo-200 font-bold text-xs">' + VLB.escapeHtml(lesson.number) + '</span>' +
                                (lesson.title ? '<span class="text-xs text-gray-400">' + VLB.escapeHtml(lesson.title) + '</span>' : '') +
                            '</div>' +
                            '<span class="text-[11px] text-gray-500">' + matchingCards.length + ' шт.</span>' +
                        '</div>' +
                        cardsGridHtml +
                    '</div>'
                );
            });
        });

        if (lessonBlocksHtml.length === 0) {
            area.innerHTML =
                '<div class="h-full flex flex-col items-center justify-center text-center py-14 text-gray-400 space-y-2">' +
                    '<div class="text-3xl">🗂️</div>' +
                    '<div class="text-xs sm:text-sm font-semibold">У вибраній папці поки немає карток або за запитом нічого не знайдено</div>' +
                    '<div class="text-[11px] text-gray-500">Оберіть іншу тему ліворуч або введіть назву гри у поле пошуку вище</div>' +
                '</div>';
        } else {
            area.innerHTML =
                '<div class="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-700/40 rounded-lg px-3 py-1.5 flex items-center justify-between">' +
                    '<span>💡 Клікніть по картинці або кнопці <b>«+ В урок»</b> — і завдання миттєво додасться у вибраний урок (' + VLB.escapeHtml(activeStudentBoard ? activeStudentBoard.name : '') + ')!</span>' +
                '</div>' +
                lessonBlocksHtml.join('');
        }

        area.onclick = function (e) {
            const zoomBtn = e.target.closest('[data-cat-zoom-card]');
            if (zoomBtn) {
                e.stopPropagation();
                const lId = zoomBtn.dataset.catZoomLesson;
                const cId = zoomBtn.dataset.catZoomCard;
                const found = VLB.findLessonAndCard(lId, cId);
                if (found && found.card && isTextTaskCard(found.card)) {
                    openTextCardReaderModal(lId, cId);
                } else {
                    VLB.openLightbox(lId, cId);
                }
                return;
            }

            const pickEl = e.target.closest('[data-cat-pick-card]');
            if (pickEl) {
                e.stopPropagation();
                const fromLessonId = pickEl.dataset.catPickLesson;
                const fromCardId = pickEl.dataset.catPickCard;
                const destLessonId = document.getElementById('modalLessonSelect').value || targetLessonId;

                const srcFound = VLB.findLessonAndCard(fromLessonId, fromCardId);
                if (!srcFound || !srcFound.card) return;

                if (isTextTaskCard(srcFound.card)) {
                    const destFound = VLB.findLessonAndCard(destLessonId, null);
                    if (destFound && destFound.lesson) {
                        if (!Array.isArray(destFound.lesson.cards)) destFound.lesson.cards = [];
                        destFound.lesson.cards.push({
                            id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                            title: srcFound.card.title || '',
                            url: '',
                            badge: 'text',
                            textContent: srcFound.card.textContent,
                            textBg: srcFound.card.textBg || 'amber',
                            image: srcFound.card.image,
                            galleryCount: 1,
                            thumbReady: true
                        });
                        VLB.saveState();
                        VLB.renderLessonsList();
                        VLB.showToast('Текстове завдання додано в урок!', 'emerald');
                    }
                } else {
                    VLB.moveOrCopyCardBetweenLessons(fromLessonId, fromCardId, destLessonId, null, true);
                }

                const cardWrapper = pickEl.closest('[data-cat-card-wrap]');
                if (cardWrapper) {
                    const btn = cardWrapper.querySelector('button[data-cat-pick-card]');
                    if (btn) {
                        btn.textContent = '✓ Додано!';
                        btn.className = 'px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-extrabold shrink-0 cursor-pointer';
                    }
                }
            }
        };
    }

    /* ------------------------------------------------------------------------
       6. ПРИКРАШАННЯ КАРТОК У РЯДКАХ УРОКІВ + ШВИДКІ КНОПКИ "+ 📝 ТЕКСТ" І "+ 📚 З БАЗИ"
       ------------------------------------------------------------------------ */
    function decorateRenderedCardsAndRows() {
        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);
        const inStudBoard = currentBoard && isStudentBoard(currentBoard.id);

        const addBtns = document.querySelectorAll('#lessonsContainer button[data-action="open-add-card"]');
        addBtns.forEach(function (addBtn) {
            if (addBtn.dataset.quickBtnsInjected === '1') return;
            addBtn.dataset.quickBtnsInjected = '1';
            const lessonId = addBtn.dataset.lessonId;

            const quickWrap = document.createElement('div');
            quickWrap.className = 'flex flex-col gap-1 shrink-0';
            quickWrap.style.height = 'var(--thumb-h)';
            quickWrap.innerHTML =
                '<button type="button" data-addon-action="quick-open-catalog" data-lesson-id="' + lessonId + '" ' +
                    'title="Швидко обрати гру зі списку ваших Тем та уроків (з мініатюрами)" ' +
                    'class="flex-1 px-2.5 rounded-xl border border-dashed border-indigo-500/60 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-900/50 text-indigo-300 hover:text-white text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer">' +
                    '<span>📚</span><span>З бази</span>' +
                '</button>' +
                '<button type="button" data-addon-action="quick-open-text" data-lesson-id="' + lessonId + '" ' +
                    'title="Додати окреме текстове завдання (написати або вставити текст)" ' +
                    'class="flex-1 px-2.5 rounded-xl border border-dashed border-amber-500/60 hover:border-amber-400 bg-amber-950/25 hover:bg-amber-900/45 text-amber-300 hover:text-white text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer">' +
                    '<span>📝</span><span>Текст</span>' +
                '</button>';

            addBtn.parentNode.appendChild(quickWrap);
        });

        const cards = document.querySelectorAll('#lessonsContainer .card-thumb-box[data-card-id]');
        cards.forEach(function (cardEl) {
            if (cardEl.dataset.historyDecorated === '1') return;
            cardEl.dataset.historyDecorated = '1';

            const lessonId = cardEl.dataset.lessonId;
            const cardId = cardEl.dataset.cardId;
            const found = VLB.findLessonAndCard(lessonId, cardId);
            if (!found || !found.card) return;
            const card = found.card;

            if (isTextTaskCard(card)) {
                cardEl.classList.remove('frame-web', 'frame-local', 'frame-pdf', 'frame-gallery');
                cardEl.classList.add('frame-text');
                const bottomBadge = cardEl.querySelector('span.absolute.bottom-1.left-1');
                if (bottomBadge) {
                    bottomBadge.textContent = '📝 Текст';
                    bottomBadge.className = 'absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-gray-950 shadow pointer-events-none';
                }
            }

            const occ = findCardOccurrencesEverywhere(card, null);
            const actionBar = cardEl.querySelector('div.absolute.top-1.right-1');
            if (actionBar) {
                const histBtn = document.createElement('button');
                histBtn.type = 'button';
                histBtn.dataset.addonAction = 'open-card-history';
                histBtn.dataset.lessonId = lessonId;
                histBtn.dataset.cardId = cardId;
                histBtn.title = 'Подивитися, кому з учнів і коли вже давали це завдання';
                histBtn.className = 'w-6 h-6 rounded flex items-center justify-center text-emerald-300 hover:bg-emerald-600 hover:text-white text-xs cursor-pointer';
                histBtn.textContent = '👥';
                actionBar.insertBefore(histBtn, actionBar.firstChild);
            }

            if (!inStudBoard && occ.studentHits.length > 0) {
                const uniqueStudents = {};
                occ.studentHits.forEach(function (h) { uniqueStudents[h.boardName] = true; });
                const studNames = Object.keys(uniqueStudents);

                const pill = document.createElement('button');
                pill.type = 'button';
                pill.dataset.addonAction = 'open-card-history';
                pill.dataset.lessonId = lessonId;
                pill.dataset.cardId = cardId;
                pill.title = 'Вже призначали учням: ' + studNames.join(', ');
                pill.className = 'absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-purple-900/90 hover:bg-purple-600 text-purple-100 border border-purple-400/60 text-[9px] font-extrabold shadow cursor-pointer transition';
                pill.textContent = '👥 ' + studNames.length + ' уч.';
                cardEl.appendChild(pill);
            }

            if (inStudBoard && occ.currentBoardHits.length > 1) {
                const repeatPill = document.createElement('button');
                repeatPill.type = 'button';
                repeatPill.dataset.addonAction = 'open-card-history';
                repeatPill.dataset.lessonId = lessonId;
                repeatPill.dataset.cardId = cardId;
                repeatPill.title = 'Це завдання вже давалося цьому учню у декількох уроках (' + occ.currentBoardHits.length + ' раз.)';
                repeatPill.className = 'absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-amber-600/95 hover:bg-amber-500 text-gray-950 border border-amber-300 text-[9px] font-extrabold shadow cursor-pointer transition';
                repeatPill.textContent = '🔄 ' + occ.currentBoardHits.length + 'x';
                cardEl.appendChild(repeatPill);
            }
        });
    }

    /* ------------------------------------------------------------------------
       7. ПЕРЕХІД ДО УРОКУ, ІСТОРІЯ ГРИ (👥) ТА МАПА КАРТИНОК (🖼️)
       ------------------------------------------------------------------------ */
    function jumpToBoardLessonCard(boardId, lessonId, cardId) {
        const state = VLB.getState();
        if (!state) return;

        topicMapModeActive = false;
        state.activeBoardId = boardId;
        if (lessonId) state.activeLessonId = lessonId;
        VLB.renderApp();
        renderTopicVisualMapIfActive();
        updateAllMapButtonsUI();

        setTimeout(function () {
            if (lessonId) {
                const rowEl = document.querySelector('#lessonsContainer section[data-lesson-id="' + lessonId + '"]');
                if (rowEl) {
                    rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    rowEl.style.transition = 'box-shadow 0.3s ease';
                    rowEl.style.boxShadow = '0 0 0 3px #f59e0b, 0 0 25px rgba(245, 158, 11, 0.45)';
                    setTimeout(function () { rowEl.style.boxShadow = ''; }, 2600);
                }
            }
            if (cardId) {
                const cardEl = document.querySelector('#lessonsContainer .card-thumb-box[data-card-id="' + cardId + '"]');
                if (cardEl) {
                    cardEl.style.outline = '4px solid #fbbf24';
                    cardEl.style.transform = 'scale(1.06)';
                    setTimeout(function () {
                        cardEl.style.outline = '';
                        cardEl.style.transform = '';
                    }, 3000);
                }
            }
        }, 160);
    }

    function openBoardLessonInNewWindow(boardId, lessonId, cardId) {
        const baseUrl = window.location.href.split('#')[0];
        const targetUrl = baseUrl + '#board=' + encodeURIComponent(boardId || '') +
            '&lesson=' + encodeURIComponent(lessonId || '') +
            '&card=' + encodeURIComponent(cardId || '');
        const win = window.open(targetUrl, '_blank');
        if (!win) {
            jumpToBoardLessonCard(boardId, lessonId, cardId);
        }
    }

    let pendingHashParams = null;
    function parseInitialHash() {
        const hash = window.location.hash || '';
        if (hash.indexOf('board=') === -1) return;
        const params = {};
        hash.replace(/^#/, '').split('&').forEach(function (pair) {
            const parts = pair.split('=');
            if (parts.length === 2) params[parts[0]] = decodeURIComponent(parts[1]);
        });
        if (params.board) pendingHashParams = params;
    }
    parseInitialHash();

    function tryApplyPendingHash() {
        if (!pendingHashParams || !pendingHashParams.board) return;
        const targetBoard = VLB.getBoardById(pendingHashParams.board);
        if (targetBoard) {
            const b = pendingHashParams.board;
            const l = pendingHashParams.lesson || null;
            const c = pendingHashParams.card || null;
            pendingHashParams = null;
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            jumpToBoardLessonCard(b, l, c);
        }
    }

    function toggleTopicMapMode() {
        topicMapModeActive = !topicMapModeActive;
        updateAllMapButtonsUI();
        renderTopicVisualMapIfActive();
    }

    function updateAllMapButtonsUI() {
        const headerBtn = document.getElementById('headerTopicMapBtn');
        if (headerBtn) {
            headerBtn.className = topicMapModeActive
                ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-purple-600 text-white border border-purple-400 shadow-lg transition cursor-pointer'
                : 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-700/60 transition cursor-pointer';
            headerBtn.innerHTML = topicMapModeActive
                ? '<span>📁</span><span class="hidden md:inline">Сховати мапу</span>'
                : '<span>🖼️</span><span class="hidden md:inline">Мапа картинок</span>';
        }

        const subBtn = document.getElementById('toggleTopicMapModeBtn');
        if (subBtn) {
            subBtn.className = topicMapModeActive
                ? 'px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-purple-600 text-white shadow-lg border border-purple-400 cursor-pointer transition flex items-center gap-1.5'
                : 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-950/80 hover:bg-purple-700 text-indigo-200 hover:text-white border border-indigo-500/60 cursor-pointer transition flex items-center gap-1.5';
            subBtn.innerHTML = topicMapModeActive
                ? '<span>📁</span><span>Сховати мапу картинок</span>'
                : '<span>🖼️</span><span>Показати всю гілку в картинках (Мапа теми)</span>';
        }
    }

    function injectAddonUIElements() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.parentElement && !document.getElementById('quickHistoryCheckBtn')) {
            const btnCheck = document.createElement('button');
            btnCheck.type = 'button';
            btnCheck.id = 'quickHistoryCheckBtn';
            btnCheck.title = 'Швидко перевірити, чи давали ви певну гру цьому учню або всім іншим учням';
            btnCheck.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 transition cursor-pointer';
            btnCheck.innerHTML = '<span>🔎</span><span class="hidden md:inline">Чи давала гру?</span>';
            btnCheck.addEventListener('click', function (e) {
                e.stopPropagation();
                openQuickGameLookupModal();
            });

            const btnMap = document.createElement('button');
            btnMap.type = 'button';
            btnMap.id = 'headerTopicMapBtn';
            btnMap.title = 'Показати або сховати всі картинки з усіх вкладених піддошок по уроках';
            btnMap.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleTopicMapMode();
            });

            searchInput.parentElement.parentNode.insertBefore(btnMap, searchInput.parentElement.nextSibling);
            searchInput.parentElement.parentNode.insertBefore(btnCheck, searchInput.parentElement.nextSibling);
            updateAllMapButtonsUI();
        }

        const urlInp = document.getElementById('modalCardUrlInput');
        if (urlInp && !document.getElementById('modalLiveHistoryAlert')) {
            const alertBox = document.createElement('div');
            alertBox.id = 'modalLiveHistoryAlert';
            alertBox.className = 'hidden mt-2 rounded-xl p-3 text-xs space-y-1.5 border';
            urlInp.parentNode.appendChild(alertBox);

            const triggerCheck = function () { updateModalLiveDuplicateAlert(); };
            urlInp.addEventListener('input', triggerCheck);
            const titleInp = document.getElementById('modalCardTitleInput');
            if (titleInp) titleInp.addEventListener('input', triggerCheck);
            const lessonSel = document.getElementById('modalLessonSelect');
            if (lessonSel) lessonSel.addEventListener('change', triggerCheck);
        }

        if (!document.getElementById('gameUsageHistoryModal')) {
            const modal = document.createElement('div');
            modal.id = 'gameUsageHistoryModal';
            modal.className = 'fixed inset-0 z-50 hidden modal-bg flex items-center justify-center p-3 sm:p-4';
            modal.innerHTML =
                '<div class="bg-[#111827] border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">' +
                    '<div class="px-5 py-3.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2">' +
                        '<h3 id="guhModalTitle" class="font-bold text-sm sm:text-base text-white">👥 Історія гри: кому і коли призначалася</h3>' +
                        '<button type="button" id="guhCloseTopBtn" class="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 cursor-pointer">✕</button>' +
                    '</div>' +
                    '<div id="guhSearchBoxWrap" class="hidden px-5 pt-4 pb-2 bg-gray-900/60 border-b border-gray-800">' +
                        '<label class="block text-xs font-semibold text-amber-300 mb-1.5">Вставте посилання/шлях до гри або введіть назву для миттєвої перевірки:</label>' +
                        '<input id="guhLookupInput" type="text" placeholder="Вставте шлях D:\\... або https://... або частину назви..." ' +
                            'class="w-full bg-gray-950 border border-amber-500/50 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-400">' +
                    '</div>' +
                    '<div id="guhModalBody" class="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm"></div>' +
                    '<div class="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between gap-2">' +
                        '<span class="text-[11px] text-gray-400">Клікніть «До уроку», щоб миттєво опинитися на потрібному уроці</span>' +
                        '<button type="button" id="guhCloseBottomBtn" class="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold cursor-pointer">Закрити</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);

            const closeHistoryModal = function () { modal.classList.add('hidden'); };
            document.getElementById('guhCloseTopBtn').addEventListener('click', closeHistoryModal);
            document.getElementById('guhCloseBottomBtn').addEventListener('click', closeHistoryModal);
            modal.addEventListener('click', function (ev) { if (ev.target === modal) closeHistoryModal(); });
            document.getElementById('guhLookupInput').addEventListener('input', function (ev) {
                renderQuickLookupResults(ev.target.value);
            });
        }
    }

    function updateModalLiveDuplicateAlert() {
        const alertBox = document.getElementById('modalLiveHistoryAlert');
        if (!alertBox) return;

        const urlVal = (document.getElementById('modalCardUrlInput').value || '').trim();
        const titleVal = (document.getElementById('modalCardTitleInput').value || '').trim();

        if (!urlVal && titleVal.length < 3) {
            alertBox.classList.add('hidden');
            alertBox.innerHTML = '';
            return;
        }

        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);
        const tempCard = { url: urlVal, title: titleVal };
        const occ = findCardOccurrencesEverywhere(tempCard, null);
        const lines = [];

        if (currentBoard && occ.currentBoardHits.length > 0) {
            const lessonLinks = occ.currentBoardHits.map(function (h) {
                const dateInfo = h.lessonTitle ? (' (' + VLB.escapeHtml(h.lessonTitle) + ')') : '';
                return '<button type="button" data-jump-board="' + h.boardId + '" data-jump-lesson="' + h.lessonId + '" data-jump-card="' + h.cardId + '" ' +
                    'class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 font-bold cursor-pointer">' +
                    '🎯 ' + VLB.escapeHtml(h.lessonNumber) + dateInfo + ' ➔</button>';
            }).join(' ');

            lines.push(
                '<div class="flex flex-wrap items-center gap-1.5 text-amber-200">' +
                    '<span>⚠️ <b>У «' + VLB.escapeHtml(currentBoard.name) + '» ця гра вже є:</b></span>' +
                    lessonLinks +
                '</div>'
            );
        }

        const otherStudentHits = occ.studentHits.filter(function (h) {
            return !currentBoard || h.boardId !== currentBoard.id;
        });

        if (otherStudentHits.length > 0) {
            const studBadges = otherStudentHits.slice(0, 6).map(function (h) {
                const dateInfo = h.lessonTitle ? (' • ' + VLB.escapeHtml(h.lessonTitle)) : '';
                return '<button type="button" data-jump-board="' + h.boardId + '" data-jump-lesson="' + h.lessonId + '" data-jump-card="' + h.cardId + '" ' +
                    'class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 cursor-pointer">' +
                    '👤 ' + VLB.escapeHtml(h.boardName) + ': ' + VLB.escapeHtml(h.lessonNumber) + dateInfo + '</button>';
            }).join(' ');

            lines.push(
                '<div class="flex flex-wrap items-center gap-1.5 text-indigo-200 pt-1">' +
                    '<span>👥 <b>Призначалася учням (' + otherStudentHits.length + '):</b></span>' +
                    studBadges +
                '</div>'
            );
        }

        if (lines.length === 0) {
            if (currentBoard && isStudentBoard(currentBoard.id)) {
                alertBox.className = 'mt-2 rounded-xl p-2.5 text-xs bg-emerald-950/50 border border-emerald-600/40 text-emerald-300';
                alertBox.innerHTML = '✅ Цьому учню («' + VLB.escapeHtml(currentBoard.name) + '») ви цю гру ще не давали.';
                alertBox.classList.remove('hidden');
            } else {
                alertBox.classList.add('hidden');
            }
            return;
        }

        alertBox.className = 'mt-2 rounded-xl p-3 text-xs space-y-1.5 bg-amber-950/45 border border-amber-500/50';
        alertBox.innerHTML = lines.join('');
        alertBox.classList.remove('hidden');
    }

    function openCardHistoryModal(lessonId, cardId) {
        const found = VLB.findLessonAndCard(lessonId, cardId);
        if (!found || !found.card) return;

        const card = found.card;
        const occ = findCardOccurrencesEverywhere(card, null);
        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);

        document.getElementById('guhSearchBoxWrap').classList.add('hidden');
        document.getElementById('guhModalTitle').textContent = '👥 Історія призначень завдання';

        const body = document.getElementById('guhModalBody');
        let html =
            '<div class="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">' +
                '<div class="flex items-center gap-3 min-w-0">' +
                    '<img src="' + (card.image || '') + '" class="h-14 w-20 object-contain rounded-lg bg-gray-950 border border-gray-800 shrink-0">' +
                    '<div class="min-w-0">' +
                        '<div class="font-bold text-white text-sm truncate">' + VLB.escapeHtml(card.title || 'Завдання / Гра') + '</div>' +
                        '<div class="text-xs text-indigo-300 font-mono truncate mt-0.5">' + VLB.escapeHtml(card.url || (card.textContent ? card.textContent.slice(0, 60) : 'Набір картинок')) + '</div>' +
                    '</div>' +
                '</div>' +
                '<button type="button" data-dup-lesson="' + lessonId + '" data-dup-card="' + cardId + '" ' +
                    'class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow">' +
                    '📋 Призначити учню' +
                '</button>' +
            '</div>';

        if (currentBoard && isStudentBoard(currentBoard.id)) {
            html += '<div class="space-y-2">' +
                '<h4 class="text-xs font-bold uppercase tracking-wider text-amber-300">👤 У поточному учні («' + VLB.escapeHtml(currentBoard.name) + '»):</h4>';
            if (occ.currentBoardHits.length === 0) {
                html += '<div class="p-3 rounded-xl bg-gray-900 text-gray-400 text-xs">Не знайдено у цього учня.</div>';
            } else {
                html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">';
                occ.currentBoardHits.forEach(function (h) {
                    const isSameCard = h.cardId === card.id;
                    html +=
                        '<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-900 border ' + (isSameCard ? 'border-indigo-500/60' : 'border-amber-500/50') + '">' +
                            '<div class="min-w-0">' +
                                '<div class="font-bold text-white text-xs">' + VLB.escapeHtml(h.lessonNumber) +
                                    (h.lessonTitle ? ' — <span class="text-amber-300">' + VLB.escapeHtml(h.lessonTitle) + '</span>' : '') +
                                '</div>' +
                                '<div class="text-[11px] text-gray-400">' + (isSameCard ? 'Поточний урок' : 'Вже давали раніше') + '</div>' +
                            '</div>' +
                            '<button type="button" data-jump-board="' + h.boardId + '" data-jump-lesson="' + h.lessonId + '" data-jump-card="' + h.cardId + '" ' +
                                'class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 text-xs font-semibold shrink-0 cursor-pointer">' +
                                '🎯 Перейти ➔' +
                            '</button>' +
                        '</div>';
                });
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<div class="space-y-2">' +
            '<h4 class="text-xs font-bold uppercase tracking-wider text-purple-300">👥 Усі учні, яким ви призначали це завдання (' + occ.studentHits.length + '):</h4>';

        if (occ.studentHits.length === 0) {
            html += '<div class="p-4 rounded-xl bg-gray-900/80 border border-dashed border-gray-700 text-center text-gray-400 text-xs">Жодному учню в розділі «👥 УЧНІ» це завдання ще не призначали.</div>';
        } else {
            html += '<div class="space-y-2">';
            occ.studentHits.forEach(function (h) {
                const dateBadge = h.lessonTitle
                    ? '<span class="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-[11px] font-semibold">📅 ' + VLB.escapeHtml(h.lessonTitle) + '</span>'
                    : '';
                html +=
                    '<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-900 hover:bg-gray-800/90 border border-gray-800 transition">' +
                        '<div class="flex items-center gap-2.5 flex-wrap min-w-0">' +
                            '<span class="px-2.5 py-1 rounded-lg bg-purple-600/25 border border-purple-500/40 text-purple-200 font-extrabold text-xs">👤 ' + VLB.escapeHtml(h.boardName) + '</span>' +
                            '<span class="font-bold text-white text-xs">' + VLB.escapeHtml(h.lessonNumber) + '</span>' +
                            dateBadge +
                        '</div>' +
                        '<div class="flex items-center gap-1.5 shrink-0">' +
                            '<button type="button" data-jump-board="' + h.boardId + '" data-jump-lesson="' + h.lessonId + '" data-jump-card="' + h.cardId + '" ' +
                                'class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">🎯 До уроку</button>' +
                            '<button type="button" data-new-win-board="' + h.boardId + '" data-new-win-lesson="' + h.lessonId + '" data-new-win-card="' + h.cardId + '" ' +
                                'title="Відкрити урок цього учня в окремому вікні" class="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold cursor-pointer">🪟</button>' +
                        '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        body.innerHTML = html;
        document.getElementById('gameUsageHistoryModal').classList.remove('hidden');
    }

    function openQuickGameLookupModal() {
        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);
        document.getElementById('guhSearchBoxWrap').classList.remove('hidden');
        document.getElementById('guhModalTitle').textContent = currentBoard
            ? ('🔎 Перевірити, чи давали гру в «' + currentBoard.name + '» та іншим учням')
            : '🔎 Перевірити, кому з учнів вже давали гру';

        const inp = document.getElementById('guhLookupInput');
        inp.value = '';
        renderQuickLookupResults('');
        document.getElementById('gameUsageHistoryModal').classList.remove('hidden');
        setTimeout(function () { inp.focus(); }, 50);
    }

    function renderQuickLookupResults(rawQuery) {
        const body = document.getElementById('guhModalBody');
        const q = VLB.cleanPathQuotes(rawQuery || '').toLowerCase();
        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);

        if (!q) {
            body.innerHTML = '<div class="text-gray-400 text-xs py-6 text-center">Вставте у поле вище посилання на сайт, шлях до файлу з флешки/ПК або назву гри — і ви одразу побачите всіх учнів та дати уроків, коли вона використовувалась.</div>';
            return;
        }

        const relNormalized = normalizeUrlKey(rawQuery);
        const matchesInCurrent = [];
        const matchesInOtherStudents = [];

        (state.boards || []).forEach(function (b) {
            const isStud = isStudentBoard(b.id);
            (b.lessons || []).forEach(function (l) {
                (l.cards || []).forEach(function (c) {
                    const cUrlNorm = normalizeUrlKey(c.url);
                    const cUrlRaw = (c.url || '').toLowerCase();
                    const cTitle = (c.title || '').toLowerCase();
                    const cText = (c.textContent || '').toLowerCase();

                    const isMatch = (relNormalized && cUrlNorm === relNormalized) ||
                        cUrlRaw.indexOf(q) !== -1 ||
                        cTitle.indexOf(q) !== -1 ||
                        cText.indexOf(q) !== -1;

                    if (isMatch) {
                        const item = {
                            boardId: b.id,
                            boardName: b.name,
                            lessonId: l.id,
                            lessonNumber: l.number,
                            lessonTitle: l.title || '',
                            cardId: c.id,
                            cardTitle: c.title || '',
                            cardUrl: c.url || '',
                            cardImage: c.image || ''
                        };
                        if (currentBoard && b.id === currentBoard.id) matchesInCurrent.push(item);
                        else if (isStud) matchesInOtherStudents.push(item);
                    }
                });
            });
        });

        let out = '';
        if (currentBoard) {
            if (matchesInCurrent.length === 0) {
                out += '<div class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-semibold text-xs">✅ У дошці «' + VLB.escapeHtml(currentBoard.name) + '» цієї гри ЩЕ НЕ БУЛО!</div>';
            } else {
                out += '<div class="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 space-y-2">' +
                    '<div class="text-amber-200 font-bold text-xs">⚠️ Ця гра ВЖЕ БУЛА у «' + VLB.escapeHtml(currentBoard.name) + '» (' + matchesInCurrent.length + ' раз.):</div>';
                matchesInCurrent.forEach(function (m) {
                    out +=
                        '<div class="flex items-center justify-between gap-2 bg-gray-900/90 p-2 rounded-lg border border-amber-500/30">' +
                            '<div class="flex items-center gap-2.5 min-w-0">' +
                                '<img src="' + m.cardImage + '" class="h-10 w-14 object-contain rounded bg-gray-950 shrink-0">' +
                                '<div class="min-w-0">' +
                                    '<div class="text-xs font-bold text-white">' + VLB.escapeHtml(m.lessonNumber) + (m.lessonTitle ? ' — <span class="text-amber-300">' + VLB.escapeHtml(m.lessonTitle) + '</span>' : '') + '</div>' +
                                    '<div class="text-[11px] text-gray-400 font-mono truncate">' + VLB.escapeHtml(m.cardUrl || m.cardTitle) + '</div>' +
                                '</div>' +
                            '</div>' +
                            '<button type="button" data-jump-board="' + m.boardId + '" data-jump-lesson="' + m.lessonId + '" data-jump-card="' + m.cardId + '" ' +
                                'class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs shrink-0 cursor-pointer">🎯 До уроку ➔</button>' +
                        '</div>';
                });
                out += '</div>';
            }
        }

        out += '<div class="space-y-2 pt-1"><div class="text-xs font-bold uppercase tracking-wider text-purple-300">👥 Усі учні, кому вже давали цю гру (' + matchesInOtherStudents.length + '):</div>';
        if (matchesInOtherStudents.length === 0) {
            out += '<div class="text-xs text-gray-500 italic">В інших учнів збігів не знайдено.</div>';
        } else {
            matchesInOtherStudents.forEach(function (m) {
                out +=
                    '<div class="flex items-center justify-between gap-2 bg-gray-900 p-2.5 rounded-xl border border-gray-800">' +
                        '<div class="flex items-center gap-2.5 min-w-0">' +
                            '<img src="' + m.cardImage + '" class="h-10 w-14 object-contain rounded bg-gray-950 shrink-0">' +
                            '<div class="min-w-0">' +
                                '<div class="text-xs font-bold text-white"><span class="text-purple-300">👤 ' + VLB.escapeHtml(m.boardName) + '</span> • ' + VLB.escapeHtml(m.lessonNumber) + (m.lessonTitle ? ' (' + VLB.escapeHtml(m.lessonTitle) + ')' : '') + '</div>' +
                                '<div class="text-[11px] text-gray-400 font-mono truncate">' + VLB.escapeHtml(m.cardUrl || m.cardTitle) + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<button type="button" data-jump-board="' + m.boardId + '" data-jump-lesson="' + m.lessonId + '" data-jump-card="' + m.cardId + '" ' +
                            'class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shrink-0 cursor-pointer">🎯 Перейти</button>' +
                    '</div>';
            });
        }
        out += '</div>';
        body.innerHTML = out;
    }

    /* ------------------------------------------------------------------------
       8. МАПА КАРТИНОК (🖼️ ВСЯ ГІЛКА В КАРТИНКАХ)
       ------------------------------------------------------------------------ */
    function extractLessonOrderNum(lesson, fallbackIndex) {
        const str = String(lesson && lesson.number ? lesson.number : '');
        const match = str.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);
        return fallbackIndex + 1;
    }

    function getOrderedLessonsForMap(board, sortNewestFirst) {
        if (!board || !Array.isArray(board.lessons)) return [];
        const indexed = board.lessons.map(function (l, idx) {
            return { lesson: l, idx: idx, num: extractLessonOrderNum(l, idx) };
        });
        indexed.sort(function (a, b) {
            if (a.num !== b.num) return sortNewestFirst ? (b.num - a.num) : (a.num - b.num);
            return sortNewestFirst ? (b.idx - a.idx) : (a.idx - b.idx);
        });
        return indexed.map(function (item) { return item.lesson; });
    }

    function collectSubtreeBoardsForMap(rootBoardId) {
        const result = [];
        const visited = {};
        function traverse(bId) {
            if (!bId || visited[bId]) return;
            visited[bId] = true;
            const b = VLB.getBoardById(bId);
            if (b) {
                const hasLessons = Array.isArray(b.lessons) && b.lessons.length > 0;
                const children = VLB.getChildBoards(bId);
                if (hasLessons || children.length === 0) result.push(b);
                children.forEach(function (ch) { traverse(ch.id); });
            }
        }
        if (rootBoardId) {
            traverse(rootBoardId);
        } else {
            const topBoards = VLB.getChildBoards(null);
            const topicsBoard = topBoards.find(function (b) {
                return b.id === 'b_root_topics' || (b.name || '').toLowerCase().indexOf('тем') !== -1;
            });
            if (topicsBoard && VLB.getChildBoards(topicsBoard.id).length > 0) traverse(topicsBoard.id);
            else topBoards.forEach(function (tb) { traverse(tb.id); });
        }
        return result;
    }

    function injectTopicMapToggleButton() {
        const subboardsSection = document.getElementById('subboardsSection');
        if (!subboardsSection || subboardsSection.classList.contains('hidden')) return;
        const headerFlex = subboardsSection.querySelector('div');
        if (!headerFlex || document.getElementById('toggleTopicMapModeBtn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'toggleTopicMapModeBtn';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleTopicMapMode();
        });
        headerFlex.appendChild(btn);
        updateAllMapButtonsUI();
    }

    function buildMapCardElement(board, lesson, card, fullPathTitle) {
        const isTxt = isTextTaskCard(card);
        const cType = isTxt ? 'text' : VLB.classifyCard(card);
        const galCount = VLB.getCardGalleryCount(card);
        const fInfo = isTxt
            ? { frameClass: 'frame-text', badgeText: '📝 Текст', badgeClass: 'bg-amber-500 text-gray-950' }
            : VLB.getFrameInfo(cType, galCount);
        const occ = findCardOccurrencesEverywhere(card, null);

        const uniqueStuds = {};
        occ.studentHits.forEach(function (h) { uniqueStuds[h.boardName] = true; });
        const studCount = Object.keys(uniqueStuds).length;

        const thumb = document.createElement('div');
        thumb.draggable = true;
        thumb.className = 'card-thumb-box relative rounded-xl bg-gray-950 overflow-hidden cursor-pointer select-none group/mapcard flex items-center justify-center ' + fInfo.frameClass;
        thumb.title = (card.title ? card.title + '\n' : '') +
            'Піддошка: ' + fullPathTitle + ' • ' + lesson.number +
            '\n1 клік — відкрити цей урок в окремому вікні • Подвійний клік — збільшити';

        thumb.addEventListener('dragstart', function (ev) {
            ev.stopPropagation();
            ev.dataTransfer.setData('text/plain', 'vlb_map_card:' + lesson.id + '|' + card.id);
            ev.dataTransfer.effectAllowed = 'copyMove';
            setTimeout(function () { thumb.classList.add('opacity-40'); }, 0);
        });
        thumb.addEventListener('dragend', function () {
            thumb.classList.remove('opacity-40');
            document.querySelectorAll('.drag-target-card').forEach(function (el) { el.classList.remove('drag-target-card'); });
        });
        thumb.addEventListener('dragover', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            thumb.classList.add('drag-target-card');
        });
        thumb.addEventListener('dragleave', function () { thumb.classList.remove('drag-target-card'); });
        thumb.addEventListener('drop', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            thumb.classList.remove('drag-target-card');
            const rawPayload = ev.dataTransfer.getData('text/plain');
            if (!rawPayload || rawPayload.indexOf('vlb_map_card:') !== 0) return;
            const parts = rawPayload.replace('vlb_map_card:', '').split('|');
            if (!parts[0] || !parts[1] || parts[1] === card.id) return;
            const isCopy = ev.ctrlKey || ev.altKey || ev.metaKey;
            VLB.moveOrCopyCardBetweenLessons(parts[0], parts[1], lesson.id, card.id, isCopy);
            isRenderingMap = false;
            renderTopicVisualMapIfActive();
        });

        let clickTimeout = null;
        thumb.addEventListener('click', function (ev) {
            if (ev.target.closest('button')) return;
            if (clickTimeout) clearTimeout(clickTimeout);
            clickTimeout = setTimeout(function () {
                openBoardLessonInNewWindow(board.id, lesson.id, card.id);
            }, 210);
        });
        thumb.addEventListener('dblclick', function (ev) {
            if (ev.target.closest('button')) return;
            ev.preventDefault();
            if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
            if (isTxt) openTextCardReaderModal(lesson.id, card.id);
            else VLB.openLightbox(lesson.id, card.id);
        });

        thumb.innerHTML =
            '<img src="' + (card.image || '') + '" loading="lazy" decoding="async" class="h-full w-auto max-w-full object-contain pointer-events-none select-none mx-auto">' +
            (studCount > 0
                ? '<button type="button" data-addon-action="open-card-history" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" ' +
                    'class="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-purple-900/90 hover:bg-purple-600 text-purple-100 border border-purple-400/60 text-[9px] font-extrabold shadow cursor-pointer">' +
                    '👥 ' + studCount + ' уч.</button>'
                : '') +
            '<span class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ' + fInfo.badgeClass + ' shadow pointer-events-none">' +
                fInfo.badgeText +
            '</span>' +
            '<div class="absolute top-1 right-1 flex items-center gap-0.5 bg-gray-950/95 border border-gray-700 rounded-lg p-0.5 opacity-0 group-hover/mapcard:opacity-100 transition-opacity z-20">' +
                '<button type="button" data-addon-action="open-card-history" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Кому з учнів вже давали цю гру" class="w-6 h-6 rounded flex items-center justify-center text-emerald-300 hover:bg-emerald-600 hover:text-white text-xs cursor-pointer">👥</button>' +
                '<button type="button" data-addon-action="map-zoom-card" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Збільшити" class="w-6 h-6 rounded flex items-center justify-center text-amber-300 hover:bg-amber-500 hover:text-gray-950 text-xs cursor-pointer">🔍</button>' +
                '<button type="button" data-addon-action="map-dup-card" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Скопіювати учню в урок" class="w-6 h-6 rounded flex items-center justify-center text-indigo-300 hover:bg-indigo-600 hover:text-white text-xs cursor-pointer">📋</button>' +
            '</div>';

        return thumb;
    }

    function renderTopicVisualMapIfActive() {
        if (isRenderingMap) return;
        isRenderingMap = true;
        try {
            const existingMap = document.getElementById('topicVisualMapContainer');
            if (existingMap && existingMap.parentNode) existingMap.parentNode.removeChild(existingMap);

            const subboardsGrid = document.getElementById('subboardsGrid');
            const lessonsContainer = document.getElementById('lessonsContainer');
            if (subboardsGrid) subboardsGrid.classList.toggle('hidden', topicMapModeActive);
            if (lessonsContainer) lessonsContainer.classList.toggle('hidden', topicMapModeActive);

            if (!topicMapModeActive || !lessonsContainer) {
                isRenderingMap = false;
                return;
            }

            const state = VLB.getState();
            const subBoards = collectSubtreeBoardsForMap(state.activeBoardId);
            const mapWrap = document.createElement('div');
            mapWrap.id = 'topicVisualMapContainer';
            mapWrap.className = 'max-w-[1800px] w-full mx-auto px-2 sm:px-5 py-3 space-y-4';

            mapWrap.innerHTML =
                '<div class="bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-gray-900 border-2 border-purple-500/50 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">' +
                    '<div class="space-y-0.5">' +
                        '<div class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">' +
                            '<span>🖼️ Мапа картинок (структуровано в послідовності уроків)</span>' +
                            '<span class="px-2.5 py-0.5 rounded-full bg-purple-600/40 border border-purple-400/50 text-[11px] text-purple-200">Розділів: ' + subBoards.length + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" id="closeTopicMapQuickBtn" class="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold cursor-pointer shadow">📁 Повернути звичайний вигляд</button>' +
                '</div>';

            const grid = document.createElement('div');
            grid.className = 'space-y-4';

            subBoards.forEach(function (board) {
                const orderedLessons = getOrderedLessonsForMap(board, state.sortNewestFirst);
                const totalCardsInBoard = orderedLessons.reduce(function (sum, l) { return sum + (l.cards ? l.cards.length : 0); }, 0);
                const firstLessonId = orderedLessons.length > 0 ? orderedLessons[0].id : '';
                const fullPathTitle = VLB.getBoardFullTitle(board.id);

                const boardBlock = document.createElement('div');
                boardBlock.className = 'bg-[#0f1626] border-2 border-indigo-500/35 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-lg';
                boardBlock.innerHTML =
                    '<div class="flex items-center justify-between gap-2 flex-wrap border-b border-gray-800 pb-2.5">' +
                        '<div class="flex items-center gap-2 min-w-0">' +
                            '<span class="text-base">📂</span>' +
                            '<span class="font-extrabold text-xs sm:text-sm text-indigo-200 truncate">' + VLB.escapeHtml(fullPathTitle) + '</span>' +
                            '<span class="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/50 text-indigo-300 text-[10px] font-bold">Уроків: ' + orderedLessons.length + ' • Карток: ' + totalCardsInBoard + '</span>' +
                        '</div>' +
                        '<div class="flex items-center gap-1.5">' +
                            '<button type="button" data-jump-board="' + board.id + '" data-jump-lesson="' + firstLessonId + '" data-jump-card="" class="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-indigo-600 text-gray-200 hover:text-white text-[11px] font-semibold cursor-pointer">Відкрити тут</button>' +
                            '<button type="button" data-new-win-board="' + board.id + '" data-new-win-lesson="' + firstLessonId + '" data-new-win-card="" class="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 text-purple-200 hover:text-white text-[11px] font-semibold cursor-pointer">🪟 В окремому вікні</button>' +
                        '</div>' +
                    '</div>';

                const lessonsRowsContainer = document.createElement('div');
                lessonsRowsContainer.className = 'space-y-2';

                orderedLessons.forEach(function (lesson) {
                    const lessonRow = document.createElement('div');
                    lessonRow.className = 'bg-[#111827] hover:bg-[#141d2f] border border-gray-800/90 rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 transition';
                    const leftInfo = document.createElement('div');
                    leftInfo.className = 'w-full sm:w-44 shrink-0 flex sm:flex-col items-center sm:items-start justify-between gap-1 border-b sm:border-b-0 sm:border-r border-gray-800/80 pb-1.5 sm:pb-0 sm:pr-2.5';
                    leftInfo.innerHTML =
                        '<span class="px-2 py-0.5 rounded bg-indigo-600/25 border border-indigo-500/40 text-indigo-200 font-bold text-xs">' + VLB.escapeHtml(lesson.number || 'Урок') + '</span>' +
                        (lesson.title ? '<div class="text-xs text-gray-300 font-medium line-clamp-2">' + VLB.escapeHtml(lesson.title) + '</div>' : '');

                    const cardsStrip = document.createElement('div');
                    cardsStrip.className = 'flex-1 flex items-center flex-wrap gap-2.5 min-w-0';
                    (lesson.cards || []).forEach(function (card) {
                        cardsStrip.appendChild(buildMapCardElement(board, lesson, card, fullPathTitle));
                    });

                    lessonRow.appendChild(leftInfo);
                    lessonRow.appendChild(cardsStrip);
                    lessonsRowsContainer.appendChild(lessonRow);
                });

                boardBlock.appendChild(lessonsRowsContainer);
                grid.appendChild(boardBlock);
            });

            mapWrap.appendChild(grid);
            lessonsContainer.parentNode.insertBefore(mapWrap, lessonsContainer);
            const closeBtn = document.getElementById('closeTopicMapQuickBtn');
            if (closeBtn) closeBtn.addEventListener('click', toggleTopicMapMode);
        } finally {
            isRenderingMap = false;
        }
    }

    /* ------------------------------------------------------------------------
       9. ГЛОБАЛЬНЕ ПЕРЕХОПЛЕННЯ КЛІКІВ (ТЕКСТОВІ КАРТКИ, КАТАЛОГ, КАЛЕНДАР)
       ------------------------------------------------------------------------ */
    document.addEventListener('click', function (e) {
        const editCardBtn = e.target.closest('[data-action="edit-card"]');
        if (editCardBtn) {
            const lId = editCardBtn.dataset.lessonId;
            const cId = editCardBtn.dataset.cardId;
            const found = VLB.findLessonAndCard(lId, cId);
            if (found && found.card && isTextTaskCard(found.card)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                VLB.openCardModal(lId, null);
                currentEditingTextCardId = cId;
                document.getElementById('vlbTextCardTitleInput').value = found.card.title || '';
                document.getElementById('vlbTextCardContentInput').value = found.card.textContent || '';
                selectedTextCardTheme = found.card.textBg || 'amber';
                if (typeof window._vlbSwitchCardModalMode === 'function') {
                    window._vlbSwitchCardModalMode('text');
                }
                return;
            }
            currentEditingTextCardId = null;
            if (typeof window._vlbSwitchCardModalMode === 'function') {
                setTimeout(function () { window._vlbSwitchCardModalMode('standard'); }, 20);
            }
        }

        const openAddBtn = e.target.closest('[data-action="open-add-card"]');
        if (openAddBtn) {
            currentEditingTextCardId = null;
            if (typeof window._vlbSwitchCardModalMode === 'function') {
                setTimeout(function () { window._vlbSwitchCardModalMode('standard'); }, 20);
            }
        }

        const zoomCardBtn = e.target.closest('[data-action="zoom-card"]');
        if (zoomCardBtn) {
            const found = VLB.findLessonAndCard(zoomCardBtn.dataset.lessonId, zoomCardBtn.dataset.cardId);
            if (found && found.card && isTextTaskCard(found.card)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openTextCardReaderModal(zoomCardBtn.dataset.lessonId, zoomCardBtn.dataset.cardId);
                return;
            }
        }

        const secondMonCardBtn = e.target.closest('[data-action="open-second-monitor"]');
        if (secondMonCardBtn) {
            const found = VLB.findLessonAndCard(secondMonCardBtn.dataset.lessonId, secondMonCardBtn.dataset.cardId);
            if (found && found.card && isTextTaskCard(found.card)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openTextSecondMonitorPopup(secondMonCardBtn.dataset.lessonId, secondMonCardBtn.dataset.cardId);
                return;
            }
        }

        const cardBox = e.target.closest('[data-action="card-click"]');
        if (cardBox && !e.target.closest('button')) {
            const found = VLB.findLessonAndCard(cardBox.dataset.lessonId, cardBox.dataset.cardId);
            if (found && found.card && isTextTaskCard(found.card)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openTextCardReaderModal(cardBox.dataset.lessonId, cardBox.dataset.cardId);
                return;
            }
        }

        const jumpBtn = e.target.closest('[data-jump-board]');
        if (jumpBtn) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('gameUsageHistoryModal').classList.add('hidden');
            document.getElementById('cardModal').classList.add('hidden');
            jumpToBoardLessonCard(jumpBtn.dataset.jumpBoard, jumpBtn.dataset.jumpLesson, jumpBtn.dataset.jumpCard);
            return;
        }

        const newWinBtn = e.target.closest('[data-new-win-board]');
        if (newWinBtn) {
            e.preventDefault();
            e.stopPropagation();
            openBoardLessonInNewWindow(newWinBtn.dataset.newWinBoard, newWinBtn.dataset.newWinLesson, newWinBtn.dataset.newWinCard);
            return;
        }

        const dupFromHistBtn = e.target.closest('[data-dup-lesson]');
        if (dupFromHistBtn) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('gameUsageHistoryModal').classList.add('hidden');
            VLB.openDuplicateModal(dupFromHistBtn.dataset.dupLesson, dupFromHistBtn.dataset.dupCard);
            return;
        }

        const addonBtn = e.target.closest('[data-addon-action]');
        if (addonBtn) {
            e.preventDefault();
            e.stopPropagation();
            const act = addonBtn.dataset.addonAction;
            const lId = addonBtn.dataset.lessonId;
            const cId = addonBtn.dataset.cardId;

            if (act === 'quick-open-catalog') {
                currentEditingTextCardId = null;
                VLB.openCardModal(lId, null);
                if (typeof window._vlbSwitchCardModalMode === 'function') {
                    window._vlbSwitchCardModalMode('catalog');
                }
            } else if (act === 'quick-open-text') {
                currentEditingTextCardId = null;
                VLB.openCardModal(lId, null);
                document.getElementById('vlbTextCardTitleInput').value = '';
                document.getElementById('vlbTextCardContentInput').value = '';
                if (typeof window._vlbSwitchCardModalMode === 'function') {
                    window._vlbSwitchCardModalMode('text');
                }
            } else if (act === 'open-card-history') {
                openCardHistoryModal(lId, cId);
            } else if (act === 'map-zoom-card') {
                const f = VLB.findLessonAndCard(lId, cId);
                if (f && f.card && isTextTaskCard(f.card)) openTextCardReaderModal(lId, cId);
                else VLB.openLightbox(lId, cId);
            } else if (act === 'map-dup-card') {
                VLB.openDuplicateModal(lId, cId);
            }
        }
    }, true);

    /* ------------------------------------------------------------------------
       10. СПОСТЕРІГАЧІ (MUTATION OBSERVERS) ТА ІНІЦІАЛІЗАЦІЯ
       ------------------------------------------------------------------------ */
    function initAllAddons() {
        injectCustomStyles();
        injectAddonUIElements();
        setupHeaderCompactToggle();
        setupCardModalModesAndCatalog();
        setupLightboxPanAndZoom();
        ensureTextReaderModalExists();
        injectTopicMapToggleButton();
        decorateRenderedCardsAndRows();
        renderTopicVisualMapIfActive();
        tryApplyPendingHash();
    }

    const lessonsEl = document.getElementById('lessonsContainer');
    const subboardsEl = document.getElementById('subboardsSection');
    const mainObserver = new MutationObserver(function () {
        setupHeaderCompactToggle();
        decorateRenderedCardsAndRows();
        injectTopicMapToggleButton();
        renderTopicVisualMapIfActive();
        tryApplyPendingHash();
    });

    if (lessonsEl) mainObserver.observe(lessonsEl, { childList: true, subtree: true });
    if (subboardsEl) mainObserver.observe(subboardsEl, { childList: true });

    const dialogModalEl = document.getElementById('dialogModal');
    if (dialogModalEl) {
        const dlgObs = new MutationObserver(function () {
            if (!dialogModalEl.classList.contains('hidden')) {
                setTimeout(injectInteractiveCalendarIntoDialog, 20);
            }
        });
        dlgObs.observe(dialogModalEl, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    }

    const cardModalEl = document.getElementById('cardModal');
    if (cardModalEl) {
        const modalObs = new MutationObserver(function () {
            if (!cardModalEl.classList.contains('hidden')) {
                setTimeout(updateModalLiveDuplicateAlert, 60);
            }
        });
        modalObs.observe(cardModalEl, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('hashchange', function () {
        parseInitialHash();
        tryApplyPendingHash();
    });

    initAllAddons();
})();
