/* ============================================================================
   addons.js — Додаткові модулі для Візуальної Дошки Уроків
   1. Перевірка "Чи давала я цю гру цьому учню?" + авто-попередження при додаванні
   2. Перегляд "Кому з учнів вже призначалася ця гра?" (кнопка та бейдж 👥 на картках)
   3. Режим "🖼️ Мапа картинок (Вся гілка в картинках)" із чіткою послідовністю уроків,
      масштабуванням, точним Drag&Drop між уроками/картками та відкриттям у новому вікні
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

    /* ------------------------------------------------------------------------
       1. РОЗУМНЕ ПОРІВНЯННЯ ІГОР / КАРТОК (ІГНОРУЮЧИ ЗМІНУ БУКВИ ФЛЕШКИ)
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

    /* ------------------------------------------------------------------------
       2. ШВИДКИЙ ПЕРЕХІД ДО УРОКУ З ПІДСВІЧУВАННЯМ КАРТКИ ТА ОКРЕМЕ ВІКНО
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
                    setTimeout(function () {
                        rowEl.style.boxShadow = '';
                    }, 2600);
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
            VLB.showToast('Перейшли до обраної піддошки та уроку', 'emerald');
        }
    }

    let pendingHashParams = null;
    function parseInitialHash() {
        const hash = window.location.hash || '';
        if (hash.indexOf('board=') === -1) return;
        const params = {};
        hash.replace(/^#/, '').split('&').forEach(function (pair) {
            const parts = pair.split('=');
            if (parts.length === 2) {
                params[parts[0]] = decodeURIComponent(parts[1]);
            }
        });
        if (params.board) {
            pendingHashParams = params;
        }
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

    /* ------------------------------------------------------------------------
       3. ІНЖЕКЦІЯ КНОПОК У ШАПКУ ТА МОДАЛЬНОГО ВІКНА ІСТОРІЇ ГРИ
       ------------------------------------------------------------------------ */
    function toggleTopicMapMode() {
        topicMapModeActive = !topicMapModeActive;
        updateAllMapButtonsUI();
        renderTopicVisualMapIfActive();
        if (topicMapModeActive) {
            VLB.showToast('Увімкнено перегляд гілки в картинках (структуровано по уроках)', 'info');
        }
    }

    function updateAllMapButtonsUI() {
        const headerBtn = document.getElementById('headerTopicMapBtn');
        if (headerBtn) {
            headerBtn.className = topicMapModeActive
                ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-purple-600 text-white border border-purple-400 shadow-lg shadow-purple-600/30 transition cursor-pointer'
                : 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-700/60 transition cursor-pointer';
            headerBtn.innerHTML = topicMapModeActive
                ? '<span>📁</span><span class="hidden md:inline">Сховати мапу</span>'
                : '<span>🖼️</span><span class="hidden md:inline">Мапа картинок</span>';
        }

        const subBtn = document.getElementById('toggleTopicMapModeBtn');
        if (subBtn) {
            subBtn.className = topicMapModeActive
                ? 'px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 cursor-pointer transition flex items-center gap-1.5'
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

            const triggerCheck = function () {
                updateModalLiveDuplicateAlert();
            };
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
                        '<span id="guhFooterHint" class="text-[11px] text-gray-400">Клікніть «До уроку», щоб миттєво опинитися на потрібному уроці</span>' +
                        '<button type="button" id="guhCloseBottomBtn" class="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold cursor-pointer">Закрити</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);

            const closeHistoryModal = function () {
                modal.classList.add('hidden');
            };
            document.getElementById('guhCloseTopBtn').addEventListener('click', closeHistoryModal);
            document.getElementById('guhCloseBottomBtn').addEventListener('click', closeHistoryModal);
            modal.addEventListener('click', function (ev) {
                if (ev.target === modal) closeHistoryModal();
            });

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

    /* ------------------------------------------------------------------------
       4. ВІДКРИТТЯ МОДАЛКИ ІСТОРІЇ КОНКРЕТНОЇ КАРТКИ (КНОПКА 👥 НА КАРТЦІ)
       ------------------------------------------------------------------------ */
    function openCardHistoryModal(lessonId, cardId) {
        const found = VLB.findLessonAndCard(lessonId, cardId);
        if (!found || !found.card) return;

        const card = found.card;
        const occ = findCardOccurrencesEverywhere(card, null);
        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);

        document.getElementById('guhSearchBoxWrap').classList.add('hidden');
        document.getElementById('guhModalTitle').textContent = '👥 Історія призначень гри';

        const body = document.getElementById('guhModalBody');
        let html = '';

        html +=
            '<div class="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">' +
                '<div class="flex items-center gap-3 min-w-0">' +
                    '<img src="' + (card.image || '') + '" class="h-14 w-20 object-contain rounded-lg bg-gray-950 border border-gray-800 shrink-0">' +
                    '<div class="min-w-0">' +
                        '<div class="font-bold text-white text-sm truncate">' + VLB.escapeHtml(card.title || 'Завдання / Гра') + '</div>' +
                        '<div class="text-xs text-indigo-300 font-mono truncate mt-0.5">' + VLB.escapeHtml(card.url || 'Набір картинок без зовнішнього посилання') + '</div>' +
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
            '<h4 class="text-xs font-bold uppercase tracking-wider text-purple-300">👥 Усі учні, яким ви призначали цю гру (' + occ.studentHits.length + '):</h4>';

        if (occ.studentHits.length === 0) {
            html +=
                '<div class="p-4 rounded-xl bg-gray-900/80 border border-dashed border-gray-700 text-center text-gray-400 text-xs">' +
                    'Жодному учню в розділі «👥 УЧНІ» цю гру ще не призначали.' +
                '</div>';
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
                                'class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">' +
                                '🎯 До уроку' +
                            '</button>' +
                            '<button type="button" data-new-win-board="' + h.boardId + '" data-new-win-lesson="' + h.lessonId + '" data-new-win-card="' + h.cardId + '" ' +
                                'title="Відкрити урок цього учня в окремому вікні" ' +
                                'class="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold cursor-pointer">' +
                                '🪟' +
                            '</button>' +
                        '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        body.innerHTML = html;
        document.getElementById('gameUsageHistoryModal').classList.remove('hidden');
    }

    /* ------------------------------------------------------------------------
       5. ШВИДКИЙ ПОШУК-ПЕРЕВІРКА БУДЬ-ЯКОЇ ГРИ ("🔎 ЧИ ДАВАЛА ГРУ?")
       ------------------------------------------------------------------------ */
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
            if (currentBoard && Array.isArray(currentBoard.lessons) && currentBoard.lessons.length > 0) {
                let countCards = 0;
                const itemsHtml = [];
                currentBoard.lessons.forEach(function (l) {
                    (l.cards || []).forEach(function (c) {
                        countCards++;
                        itemsHtml.push(
                            '<div class="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-gray-900 border border-gray-800">' +
                                '<div class="flex items-center gap-2.5 min-w-0">' +
                                    '<img src="' + (c.image || '') + '" class="h-10 w-14 object-contain rounded bg-gray-950 shrink-0">' +
                                    '<div class="min-w-0">' +
                                        '<div class="text-xs font-bold text-white truncate">' + VLB.escapeHtml(l.number + (l.title ? ' (' + l.title + ')' : '')) + '</div>' +
                                        '<div class="text-[11px] text-gray-400 font-mono truncate">' + VLB.escapeHtml(c.title || c.url || 'Картинка') + '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<button type="button" data-jump-board="' + currentBoard.id + '" data-jump-lesson="' + l.id + '" data-jump-card="' + c.id + '" ' +
                                    'class="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-semibold shrink-0 cursor-pointer">' +
                                    '🎯 Перейти' +
                                '</button>' +
                            '</div>'
                        );
                    });
                });
                body.innerHTML =
                    '<div class="text-xs text-gray-300 mb-2">Усі матеріали в дошці <b>«' + VLB.escapeHtml(currentBoard.name) + '»</b> (' + countCards + ' шт.). Вставте вище шлях або назву гри для швидкої перевірки:</div>' +
                    '<div class="space-y-1.5 max-h-80 overflow-y-auto">' + (itemsHtml.join('') || '<div class="text-gray-500">Уроків із картками поки немає.</div>') + '</div>';
            } else {
                body.innerHTML = '<div class="text-gray-400 text-xs py-6 text-center">Вставте у поле вище посилання на сайт, шлях до файлу з флешки/ПК або назву гри — і ви одразу побачите всіх учнів та дати уроків, коли вона використовувалась.</div>';
            }
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

                    const isMatch = (relNormalized && cUrlNorm === relNormalized) ||
                        cUrlRaw.indexOf(q) !== -1 ||
                        cTitle.indexOf(q) !== -1;

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
                        if (currentBoard && b.id === currentBoard.id) {
                            matchesInCurrent.push(item);
                        } else if (isStud) {
                            matchesInOtherStudents.push(item);
                        }
                    }
                });
            });
        });

        let out = '';
        if (currentBoard) {
            if (matchesInCurrent.length === 0) {
                out += '<div class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 font-semibold text-xs">' +
                    '✅ У дошці «' + VLB.escapeHtml(currentBoard.name) + '» цієї гри ЩЕ НЕ БУЛО!' +
                '</div>';
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
                                'class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs shrink-0 cursor-pointer">' +
                                '🎯 До уроку ➔' +
                            '</button>' +
                        '</div>';
                });
                out += '</div>';
            }
        }

        out += '<div class="space-y-2 pt-1">' +
            '<div class="text-xs font-bold uppercase tracking-wider text-purple-300">👥 Усі учні, кому вже давали цю гру (' + matchesInOtherStudents.length + '):</div>';

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
                            'class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shrink-0 cursor-pointer">' +
                            '🎯 Перейти' +
                        '</button>' +
                    '</div>';
            });
        }
        out += '</div>';

        body.innerHTML = out;
    }

    /* ------------------------------------------------------------------------
       6. ДОДАВАННЯ БЕЙДЖІВ ТА КНОПКИ "👥" НА КОЖНУ КАРТКУ
       ------------------------------------------------------------------------ */
    function decorateRenderedCardsWithHistoryBadges() {
        const cards = document.querySelectorAll('#lessonsContainer .card-thumb-box[data-card-id]');
        if (!cards || cards.length === 0) return;

        const state = VLB.getState();
        const currentBoard = VLB.getBoardById(state.activeBoardId);
        const inStudBoard = currentBoard && isStudentBoard(currentBoard.id);

        cards.forEach(function (cardEl) {
            if (cardEl.dataset.historyDecorated === '1') return;
            cardEl.dataset.historyDecorated = '1';

            const lessonId = cardEl.dataset.lessonId;
            const cardId = cardEl.dataset.cardId;
            const found = VLB.findLessonAndCard(lessonId, cardId);
            if (!found || !found.card) return;

            const occ = findCardOccurrencesEverywhere(found.card, null);

            const actionBar = cardEl.querySelector('div.absolute.top-1.right-1');
            if (actionBar) {
                const histBtn = document.createElement('button');
                histBtn.type = 'button';
                histBtn.dataset.addonAction = 'open-card-history';
                histBtn.dataset.lessonId = lessonId;
                histBtn.dataset.cardId = cardId;
                histBtn.title = 'Подивитися, кому з учнів і коли вже давали цю гру';
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
                pill.title = 'Вже призначали учням: ' + studNames.join(', ') + ' (клікніть для деталей і переходу)';
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
                repeatPill.title = 'Ця гра вже давалася цьому учню у декількох уроках (' + occ.currentBoardHits.length + ' раз.) — клікніть, щоб побачити дати';
                repeatPill.className = 'absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-amber-600/95 hover:bg-amber-500 text-gray-950 border border-amber-300 text-[9px] font-extrabold shadow cursor-pointer transition';
                repeatPill.textContent = '🔄 ' + occ.currentBoardHits.length + 'x';
                cardEl.appendChild(repeatPill);
            }
        });
    }

    /* ------------------------------------------------------------------------
       7. РЕЖИМ "🖼️ ВСЯ ГІЛКА В КАРТИНКАХ" (СТРУКТУРОВАНО ПО УРОКАХ 1, 2, 3...)
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

        // Сортуємо уроки у природній послідовності (Урок 1, Урок 2, Урок 3...)
        indexed.sort(function (a, b) {
            if (a.num !== b.num) {
                return sortNewestFirst ? (b.num - a.num) : (a.num - b.num);
            }
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
                if (hasLessons || children.length === 0) {
                    result.push(b);
                }
                children.forEach(function (ch) {
                    traverse(ch.id);
                });
            }
        }

        if (rootBoardId) {
            traverse(rootBoardId);
        } else {
            const topBoards = VLB.getChildBoards(null);
            const topicsBoard = topBoards.find(function (b) {
                return b.id === 'b_root_topics' || (b.name || '').toLowerCase().indexOf('тем') !== -1;
            });
            if (topicsBoard && VLB.getChildBoards(topicsBoard.id).length > 0) {
                traverse(topicsBoard.id);
            } else {
                topBoards.forEach(function (tb) {
                    traverse(tb.id);
                });
            }
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
        const cType = VLB.classifyCard(card);
        const galCount = VLB.getCardGalleryCount(card);
        const fInfo = VLB.getFrameInfo(cType, galCount);
        const occ = findCardOccurrencesEverywhere(card, null);

        const uniqueStuds = {};
        occ.studentHits.forEach(function (h) { uniqueStuds[h.boardName] = true; });
        const studCount = Object.keys(uniqueStuds).length;

        const thumb = document.createElement('div');
        thumb.draggable = true;
        thumb.className = 'card-thumb-box relative rounded-xl bg-gray-950 overflow-hidden cursor-pointer select-none group/mapcard flex items-center justify-center ' + fInfo.frameClass;
        thumb.title = (card.title ? card.title + '\n' : '') +
            'Піддошка: ' + fullPathTitle + ' • ' + lesson.number + (lesson.title ? ' (' + lesson.title + ')' : '') + '\n' +
            (card.url ? 'Шлях: ' + card.url + '\n' : '') +
            '1 клік — відкрити цей урок в окремому вікні • Подвійний клік — збільшити картинку';

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

        // Дозволяємо кидати іншу картинку прямо НА цю картку, щоб вставити перед нею в цьому ж уроці
        thumb.addEventListener('dragover', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            thumb.classList.add('drag-target-card');
        });

        thumb.addEventListener('dragleave', function () {
            thumb.classList.remove('drag-target-card');
        });

        thumb.addEventListener('drop', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            thumb.classList.remove('drag-target-card');
            const rawPayload = ev.dataTransfer.getData('text/plain');
            if (!rawPayload || rawPayload.indexOf('vlb_map_card:') !== 0) return;

            const parts = rawPayload.replace('vlb_map_card:', '').split('|');
            const fromLessonId = parts[0];
            const draggedCardId = parts[1];
            if (!fromLessonId || !draggedCardId || draggedCardId === card.id) return;

            const isCopy = ev.ctrlKey || ev.altKey || ev.metaKey;
            VLB.moveOrCopyCardBetweenLessons(fromLessonId, draggedCardId, lesson.id, card.id, isCopy);
            isRenderingMap = false;
            renderTopicVisualMapIfActive();
            VLB.showToast((isCopy ? 'Скопійовано' : 'Переміщено') + ' у «' + board.name + ' • ' + lesson.number + '»!', 'emerald');
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
            VLB.openLightbox(lesson.id, card.id);
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
                '<button type="button" data-addon-action="map-zoom-card" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Збільшити картинку (Lightbox)" class="w-6 h-6 rounded flex items-center justify-center text-amber-300 hover:bg-amber-500 hover:text-gray-950 text-xs cursor-pointer">🔍</button>' +
                '<button type="button" data-addon-action="map-dup-card" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Скопіювати цю гру учню в урок" class="w-6 h-6 rounded flex items-center justify-center text-indigo-300 hover:bg-indigo-600 hover:text-white text-xs cursor-pointer">📋</button>' +
                '<button type="button" data-addon-action="map-copy-path" data-lesson-id="' + lesson.id + '" data-card-id="' + card.id + '" title="Скопіювати посилання/шлях або відкрити для 2-го монітора" class="w-6 h-6 rounded flex items-center justify-center text-sky-300 hover:bg-sky-600 hover:text-white text-xs cursor-pointer">🔗</button>' +
            '</div>';

        return thumb;
    }

    function renderTopicVisualMapIfActive() {
        if (isRenderingMap) return;
        isRenderingMap = true;

        try {
            const existingMap = document.getElementById('topicVisualMapContainer');
            if (existingMap && existingMap.parentNode) {
                existingMap.parentNode.removeChild(existingMap);
            }

            const subboardsGrid = document.getElementById('subboardsGrid');
            const lessonsContainer = document.getElementById('lessonsContainer');

            if (subboardsGrid) {
                subboardsGrid.classList.toggle('hidden', topicMapModeActive);
            }
            if (lessonsContainer) {
                lessonsContainer.classList.toggle('hidden', topicMapModeActive);
            }

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
                        '<div class="text-[11px] text-gray-300">' +
                            'Уроки йдуть по порядку (Урок 1, Урок 2...) • <b>1 клік по картинці</b> — відкриває урок в окремому вікні • <b>Подвійний клік або 🔍</b> — наблизити • <b>Перетягування мишкою</b> — переміщує картинку в потрібний урок' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" id="closeTopicMapQuickBtn" class="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold cursor-pointer shadow">📁 Повернути звичайний вигляд</button>' +
                '</div>';

            const grid = document.createElement('div');
            grid.className = 'space-y-4';

            subBoards.forEach(function (board) {
                const orderedLessons = getOrderedLessonsForMap(board, state.sortNewestFirst);
                const totalCardsInBoard = orderedLessons.reduce(function (sum, l) {
                    return sum + (l.cards ? l.cards.length : 0);
                }, 0);

                const firstLessonId = orderedLessons.length > 0 ? orderedLessons[0].id : '';
                const fullPathTitle = VLB.getBoardFullTitle(board.id);

                const boardBlock = document.createElement('div');
                boardBlock.className = 'bg-[#0f1626] border-2 border-indigo-500/35 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-lg';

                // Шапка піддошки
                const topBar = document.createElement('div');
                topBar.className = 'flex items-center justify-between gap-2 flex-wrap border-b border-gray-800 pb-2.5';
                topBar.innerHTML =
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<span class="text-base">📂</span>' +
                        '<span class="font-extrabold text-xs sm:text-sm text-indigo-200 truncate">' + VLB.escapeHtml(fullPathTitle) + '</span>' +
                        '<span class="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/50 text-indigo-300 text-[10px] font-bold">Уроків: ' + orderedLessons.length + ' • Карток: ' + totalCardsInBoard + '</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-1.5">' +
                        '<button type="button" data-jump-board="' + board.id + '" data-jump-lesson="' + firstLessonId + '" data-jump-card="" ' +
                            'class="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-indigo-600 text-gray-200 hover:text-white text-[11px] font-semibold cursor-pointer transition">' +
                            'Відкрити тут' +
                        '</button>' +
                        '<button type="button" data-new-win-board="' + board.id + '" data-new-win-lesson="' + firstLessonId + '" data-new-win-card="" ' +
                            'class="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 text-purple-200 hover:text-white text-[11px] font-semibold cursor-pointer transition">' +
                            '🪟 В окремому вікні' +
                        '</button>' +
                    '</div>';

                boardBlock.appendChild(topBar);

                // Контейнер рядків уроків у точнісінькій послідовності
                const lessonsRowsContainer = document.createElement('div');
                lessonsRowsContainer.className = 'space-y-2';

                if (orderedLessons.length === 0) {
                    const emptyDropRow = document.createElement('div');
                    emptyDropRow.className = 'p-3 rounded-xl border border-dashed border-gray-800 text-xs text-gray-500 italic';
                    emptyDropRow.textContent = 'У цій піддошці ще немає уроків (перетягніть сюди картинку, щоб автоматично створити Урок 1).';

                    emptyDropRow.addEventListener('dragover', function (e) {
                        e.preventDefault();
                        emptyDropRow.classList.add('drag-target-row');
                    });
                    emptyDropRow.addEventListener('dragleave', function () {
                        emptyDropRow.classList.remove('drag-target-row');
                    });
                    emptyDropRow.addEventListener('drop', function (e) {
                        e.preventDefault();
                        emptyDropRow.classList.remove('drag-target-row');
                        const rawPayload = e.dataTransfer.getData('text/plain');
                        if (!rawPayload || rawPayload.indexOf('vlb_map_card:') !== 0) return;
                        const parts = rawPayload.replace('vlb_map_card:', '').split('|');
                        const newL = {
                            id: 'l_' + Date.now(),
                            number: 'Урок 1',
                            title: new Date().toLocaleDateString('uk-UA'),
                            date: '',
                            cards: []
                        };
                        board.lessons = [newL];
                        const isCopy = e.ctrlKey || e.altKey || e.metaKey;
                        VLB.moveOrCopyCardBetweenLessons(parts[0], parts[1], newL.id, null, isCopy);
                        isRenderingMap = false;
                        renderTopicVisualMapIfActive();
                    });

                    lessonsRowsContainer.appendChild(emptyDropRow);
                } else {
                    orderedLessons.forEach(function (lesson) {
                        const lessonRow = document.createElement('div');
                        lessonRow.className = 'bg-[#111827] hover:bg-[#141d2f] border border-gray-800/90 rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 transition';

                        // Перетягування картки в кінець конкретного уроку
                        lessonRow.addEventListener('dragover', function (e) {
                            e.preventDefault();
                            lessonRow.classList.add('drag-target-row');
                        });
                        lessonRow.addEventListener('dragleave', function () {
                            lessonRow.classList.remove('drag-target-row');
                        });
                        lessonRow.addEventListener('drop', function (e) {
                            e.preventDefault();
                            lessonRow.classList.remove('drag-target-row');
                            const rawPayload = e.dataTransfer.getData('text/plain');
                            if (!rawPayload || rawPayload.indexOf('vlb_map_card:') !== 0) return;

                            const parts = rawPayload.replace('vlb_map_card:', '').split('|');
                            const fromLessonId = parts[0];
                            const draggedCardId = parts[1];
                            if (!fromLessonId || !draggedCardId) return;

                            const isCopy = e.ctrlKey || e.altKey || e.metaKey;
                            VLB.moveOrCopyCardBetweenLessons(fromLessonId, draggedCardId, lesson.id, null, isCopy);
                            isRenderingMap = false;
                            renderTopicVisualMapIfActive();
                            VLB.showToast((isCopy ? 'Скопійовано' : 'Переміщено') + ' у «' + board.name + ' • ' + lesson.number + '»!', 'emerald');
                        });

                        // Ліва колонка: номер і тема/дата уроку + кнопки переходу саме до цього уроку
                        const leftInfo = document.createElement('div');
                        leftInfo.className = 'w-full sm:w-44 shrink-0 flex sm:flex-col items-center sm:items-start justify-between gap-1 border-b sm:border-b-0 sm:border-r border-gray-800/80 pb-1.5 sm:pb-0 sm:pr-2.5';
                        leftInfo.innerHTML =
                            '<div class="flex items-center gap-1.5 flex-wrap">' +
                                '<span class="px-2 py-0.5 rounded bg-indigo-600/25 border border-indigo-500/40 text-indigo-200 font-bold text-xs">' +
                                    VLB.escapeHtml(lesson.number || 'Урок') +
                                '</span>' +
                                (lesson.date ? '<span class="text-[10px] text-gray-500">' + VLB.escapeHtml(lesson.date) + '</span>' : '') +
                            '</div>' +
                            (lesson.title
                                ? '<div class="text-xs text-gray-300 font-medium line-clamp-2 leading-snug">' + VLB.escapeHtml(lesson.title) + '</div>'
                                : '') +
                            '<div class="flex items-center gap-1 pt-0.5">' +
                                '<button type="button" data-jump-board="' + board.id + '" data-jump-lesson="' + lesson.id + '" data-jump-card="" ' +
                                    'title="Перейти до цього уроку тут" class="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-indigo-600 text-[10px] text-gray-300 hover:text-white cursor-pointer">🎯 Тут</button>' +
                                '<button type="button" data-new-win-board="' + board.id + '" data-new-win-lesson="' + lesson.id + '" data-new-win-card="" ' +
                                    'title="Відкрити цей урок в окремому вікні" class="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-purple-600 text-[10px] text-purple-300 hover:text-white cursor-pointer">🪟 Вікно</button>' +
                            '</div>';

                        // Права частина: картки цього уроку по порядку
                        const cardsStrip = document.createElement('div');
                        cardsStrip.className = 'flex-1 flex items-center flex-wrap gap-2.5 min-w-0';

                        const cards = lesson.cards || [];
                        if (cards.length === 0) {
                            cardsStrip.innerHTML = '<span class="text-[11px] text-gray-600 italic">Порожній урок (перетягніть сюди картинку)</span>';
                        } else {
                            cards.forEach(function (card) {
                                cardsStrip.appendChild(buildMapCardElement(board, lesson, card, fullPathTitle));
                            });
                        }

                        lessonRow.appendChild(leftInfo);
                        lessonRow.appendChild(cardsStrip);
                        lessonsRowsContainer.appendChild(lessonRow);
                    });
                }

                boardBlock.appendChild(lessonsRowsContainer);
                grid.appendChild(boardBlock);
            });

            mapWrap.appendChild(grid);
            lessonsContainer.parentNode.insertBefore(mapWrap, lessonsContainer);

            const closeBtn = document.getElementById('closeTopicMapQuickBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleTopicMapMode();
                });
            }
        } finally {
            isRenderingMap = false;
        }
    }

    /* ------------------------------------------------------------------------
       8. ГЛОБАЛЬНИЙ ОБРОБНИК КЛІКІВ ТА АВТО-ОНОВЛЕННЯ
       ------------------------------------------------------------------------ */
    document.addEventListener('click', function (e) {
        const jumpBtn = e.target.closest('[data-jump-board]');
        if (jumpBtn) {
            e.preventDefault();
            e.stopPropagation();
            const bId = jumpBtn.dataset.jumpBoard;
            const lId = jumpBtn.dataset.jumpLesson;
            const cId = jumpBtn.dataset.jumpCard;
            document.getElementById('gameUsageHistoryModal').classList.add('hidden');
            document.getElementById('cardModal').classList.add('hidden');
            jumpToBoardLessonCard(bId, lId, cId);
            return;
        }

        const newWinBtn = e.target.closest('[data-new-win-board]');
        if (newWinBtn) {
            e.preventDefault();
            e.stopPropagation();
            openBoardLessonInNewWindow(
                newWinBtn.dataset.newWinBoard,
                newWinBtn.dataset.newWinLesson,
                newWinBtn.dataset.newWinCard
            );
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

            if (act === 'open-card-history') {
                openCardHistoryModal(lId, cId);
            } else if (act === 'map-zoom-card') {
                VLB.openLightbox(lId, cId);
            } else if (act === 'map-dup-card') {
                VLB.openDuplicateModal(lId, cId);
            } else if (act === 'map-copy-path') {
                VLB.handleCardPrimaryAction(lId, cId, null);
            }
        }
    }, true);

    function syncAfterRender() {
        injectAddonUIElements();
        injectTopicMapToggleButton();
        decorateRenderedCardsWithHistoryBadges();
        renderTopicVisualMapIfActive();
        tryApplyPendingHash();
    }

    const lessonsEl = document.getElementById('lessonsContainer');
    const subboardsEl = document.getElementById('subboardsSection');
    const observer = new MutationObserver(function () {
        decorateRenderedCardsWithHistoryBadges();
        injectTopicMapToggleButton();
        renderTopicVisualMapIfActive();
        tryApplyPendingHash();
    });

    if (lessonsEl) observer.observe(lessonsEl, { childList: true, subtree: true });
    if (subboardsEl) observer.observe(subboardsEl, { childList: true });

    const cardModalEl = document.getElementById('cardModal');
    if (cardModalEl) {
        const modalObs = new MutationObserver(function () {
            if (!cardModalEl.classList.contains('hidden')) {
                setTimeout(updateModalLiveDuplicateAlert, 60);
            }
        });
        modalObs.observe(cardModalEl, { attributes: true, attributeFilter: ['class'] });
    }

    let hashRetryCount = 0;
    const hashInterval = setInterval(function () {
        tryApplyPendingHash();
        hashRetryCount++;
        if (!pendingHashParams || hashRetryCount > 25) {
            clearInterval(hashInterval);
        }
    }, 200);

    window.addEventListener('hashchange', function () {
        parseInitialHash();
        tryApplyPendingHash();
    });

    syncAfterRender();
})();