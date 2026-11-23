/* =========================================================
   game.js — 연예인 같은그림찾기 서바이벌 (참가자 화면)
   ========================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CFG = window.GAME_CONFIG || {};
  var CELEBS = CFG.celebrities || [];
  var PAIRS = CFG.cardsPerRound || 16;   // 한 판 16쌍 = 32장
  var CARDS = PAIRS * 2;
  var LOCK_KEY = 'wsg:lock';
  var SOUND_KEY = 'wsg:sound';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    team: null,
    phase: 'intro',       // intro | preview | play | ready | saving | over
    roundIds: [],
    cards: [],
    first: null,
    second: null,
    busy: true,
    matched: 0,
    startAt: 0,
    timerId: null,
    timeouts: [],
    previewInterval: null
  };

  /* ---------------------------- 소리 ---------------------------- */
  var Sound = (function () {
    var ctx = null;
    var enabled = localStorage.getItem(SOUND_KEY) !== '0';

    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') { ctx.resume(); }
      return ctx;
    }

    function tone(freq, start, dur, type, gain) {
      if (!enabled) return;
      var c = ac(); if (!c) return;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      g.gain.setValueAtTime(0, c.currentTime + start);
      g.gain.linearRampToValueAtTime(gain || 0.06, c.currentTime + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur + 0.02);
    }

    return {
      isOn: function () { return enabled; },
      set: function (v) { enabled = v; localStorage.setItem(SOUND_KEY, v ? '1' : '0'); },
      flip: function () { tone(660, 0, 0.07, 'triangle', 0.045); },
      match: function () { tone(660, 0, 0.12, 'sine', 0.06); tone(990, 0.09, 0.16, 'sine', 0.055); },
      wrong: function () { tone(196, 0, 0.22, 'sawtooth', 0.05); tone(147, 0.14, 0.3, 'sawtooth', 0.05); },
      win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * 0.09, 0.24, 'sine', 0.055); }); }
    };
  })();

  /* --------------------------- 유틸 --------------------------- */
  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    state.timeouts.push(id);
    return id;
  }
  function clearTimers() {
    state.timeouts.forEach(clearTimeout);
    state.timeouts = [];
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    if (state.turnTimerId) { clearInterval(state.turnTimerId); state.turnTimerId = null; }
    if (state.previewInterval) { clearInterval(state.previewInterval); state.previewInterval = null; }
    var tt = $('turnTimer');
    if (tt) { tt.hidden = true; tt.classList.remove('is-urgent'); }
  }

  function stopTurnTimer() {
    if (state.turnTimerId) { clearInterval(state.turnTimerId); state.turnTimerId = null; }
    var tt = $('turnTimer');
    if (tt) { tt.hidden = true; tt.classList.remove('is-urgent'); }
  }

  function startTurnTimer() {
    stopTurnTimer();
    var sec = Store.getTurnLimitSeconds();
    var limit = sec * 1000;
    state.turnDeadline = Date.now() + limit;
    var tt = $('turnTimer');
    if (tt) {
      tt.hidden = false;
      tt.classList.remove('is-urgent');
      tt.textContent = '⏱ ' + sec.toFixed(1) + 's';
    }
    state.turnTimerId = setInterval(function () {
      if (state.phase !== 'play') { stopTurnTimer(); return; }
      var remain = state.turnDeadline - Date.now();
      if (remain <= 0) {
        if (tt) tt.textContent = '⏱ 0.0s';
        endByTimeout();
        return;
      }
      if (tt) {
        tt.textContent = '⏱ ' + (remain / 1000).toFixed(1) + 's';
        tt.classList.toggle('is-urgent', remain <= Math.min(2000, limit * 0.45));
      }
    }, 80);
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* --------------------------- 잠금 --------------------------- */
  function readLock() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeLock(v) {
    if (v) localStorage.setItem(LOCK_KEY, JSON.stringify(v));
    else localStorage.removeItem(LOCK_KEY);
  }

  /* --------------------------- 화면 --------------------------- */
  function setScreen(name) {
    document.body.dataset.screen = name;
  }

  function showIntro(lock) {
    setScreen('intro');
    var form = $('startForm');
    var box = $('lockedBox');

    // 이번 라운드 안내
    try {
      var s = Store.getSession();
      var isSolo = Store.getPlayMode() === 'solo';
      $('introRound').textContent = '라운드 ' + (Number(s.roundNo) || 1) +
        ' · ' + (isSolo ? '개인전' : '팀전') +
        ' · 후보 ' + CELEBS.length + '명 중 ' + PAIRS + '명 랜덤';
      if ($('entryLabel')) $('entryLabel').textContent = isSolo ? '팀명 / 이름' : '팀 이름';
      if ($('teamInputWrap')) $('teamInputWrap').hidden = isSolo;
      if ($('soloInputWrap')) $('soloInputWrap').hidden = !isSolo;
      if ($('rulePreview')) $('rulePreview').textContent = String(Store.getPreviewSeconds());
      if ($('rulePreviewMode')) {
        $('rulePreviewMode').textContent = Store.getPreviewMode() === 'batch'
          ? '12장씩 3번에 나눠서'
          : '32장(16쌍)이 한 번에';
      }
      if ($('ruleTurnLimit')) $('ruleTurnLimit').textContent = String(Store.getTurnLimitSeconds());
    } catch (e) { /* noop */ }

    if (lock) {
      form.hidden = true;
      box.hidden = false;
      box.classList.toggle('locked--done', lock.status === 'done');
      $('lockedTeam').textContent = lock.name || '';
      var r = $('lockedResult');
      if (lock.status === 'done') {
        r.textContent = (lock.rank ? lock.rank + '등 · 완료 🏆' : '완료 🏆');
      } else {
        r.textContent = '탈락 😵 · 찾은 짝 ' + (lock.pairs || 0) + '/' + PAIRS;
      }
    } else {
      form.hidden = false;
      box.hidden = true;
      if ($('btnStartTeam')) { $('btnStartTeam').disabled = false; $('btnStartTeam').textContent = '게임 시작'; }
      if ($('btnStartSolo')) { $('btnStartSolo').disabled = false; $('btnStartSolo').textContent = '게임 시작'; }
    }
  }

  /* ------------------------ 보드 레이아웃 ------------------------ */
  function layoutBoard() {
    var wrap = $('boardWrap');
    var board = $('board');
    var cs = window.getComputedStyle(wrap);
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var w = wrap.clientWidth - padX;
    var h = wrap.clientHeight - padY;
    if (!w || !h) return;

    var cols = window.innerWidth <= 820 ? 4 : 8;
    var rows = Math.ceil(CARDS / cols);
    var gap = Math.max(4, Math.min(12, Math.round(Math.min(w / (cols * 16), h / (rows * 16)))));
    var cellW = (w - gap * (cols - 1)) / cols;
    var cellH = (h - gap * (rows - 1)) / rows;
    var size = Math.floor(Math.min(cellW, cellH));

    board.style.gap = gap + 'px';
    board.style.gridTemplateColumns = 'repeat(' + cols + ', ' + size + 'px)';
    board.style.gridTemplateRows = 'repeat(' + rows + ', ' + size + 'px)';
    board.style.width = (size * cols + gap * (cols - 1)) + 'px';
    board.style.height = (size * rows + gap * (rows - 1)) + 'px';
    board.style.setProperty('--card-size', size + 'px');
    board.style.setProperty('--card-r', Math.max(7, Math.round(size * 0.13)) + 'px');
  }

  window.addEventListener('resize', layoutBoard);
  window.addEventListener('orientationchange', function () { setTimeout(layoutBoard, 250); });
  if (window.ResizeObserver) {
    try { new ResizeObserver(layoutBoard).observe($('boardWrap')); } catch (e) { /* noop */ }
  }

  /* --------------------------- 카드 --------------------------- */
  function buildDeck(ids) {
    var deck = [];
    ids.forEach(function (id) { deck.push(id, id); });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  function renderBoard(deck) {
    var board = $('board');
    board.innerHTML = '';
    state.cards = [];
    deck.forEach(function (celebId, i) {
      var img = 'images/celeb_' + String(celebId).padStart(2, '0') + '.jpg';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.dataset.celeb = celebId;
      btn.dataset.index = i;
      btn.setAttribute('aria-label', (i + 1) + '번 카드');
      btn.innerHTML =
        '<span class="card-inner">' +
          '<span class="card-face card-back"></span>' +
          '<span class="card-face card-front"><img src="' + img + '" alt="" draggable="false" /></span>' +
        '</span>';
      board.appendChild(btn);
      state.cards.push(btn);
    });
    layoutBoard();
  }

  function preloadImages(ids) {
    return Promise.all(ids.map(function (id) {
      return new Promise(function (res) {
        var src = 'images/celeb_' + String(id).padStart(2, '0') + '.jpg';
        var img = new Image();
        img.onload = function () { res(true); };
        img.onerror = function () { console.warn('이미지 로드 실패:', src); res(false); };
        img.src = src;
      });
    }));
  }

  /* -------------------------- 게임 흐름 -------------------------- */
  function startGame(teamName, meta) {
    if (state.phase !== 'intro') return;

    var ids = Store.getRoundIds();
    var startBtn = $('btnStartTeam') || $('btnStart');
    var soloBtn = $('btnStartSolo');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '준비 중…'; }
    if (soloBtn) { soloBtn.disabled = true; soloBtn.textContent = '준비 중…'; }

    preloadImages(ids).then(function () {
      return Store.createTeam(teamName, meta);
    }).then(function (team) {
      state.roundIds = ids;
      state.team = team;
      state.matched = 0;
      state.first = state.second = null;
      state.phase = 'preview';
      state.busy = true;

      writeLock({
        gameId: Store.getSession().gameId,
        teamId: team.id,
        name: team.name,
        status: 'playing',
        pairs: 0
      });

      $('hudTeam').textContent = team.name;
      $('hudPairs').textContent = '0';
      $('hudTimer').textContent = '00:00';
      $('btnComplete').disabled = true;
      $('btnComplete').classList.remove('is-ready');
      $('gamebarRank').hidden = true;
      $('overlay').hidden = true;
      setScreen('game');

      renderBoard(buildDeck(state.roundIds));
      requestAnimationFrame(function () {
        layoutBoard();
        requestAnimationFrame(startPreview);
      });
    }).catch(function (err) {
      console.error(err);
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = '게임 시작'; }
      if (soloBtn) { soloBtn.disabled = false; soloBtn.textContent = '게임 시작'; }
      toast('팀 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    });
  }

  function startPreview() {
    var sec = Store.getPreviewSeconds();
    var pmode = Store.getPreviewMode();
    state.phase = 'preview';
    state.busy = true;
    var banner = $('previewBanner');
    var countEl = $('previewCount');
    var barEl = $('previewBar');

    if (pmode === 'batch') {
      var chunkSize = 12; // 12장씩 3번(12·12·8장) 나눠 공개 (촬영 방지)
      var chunkCount = Math.ceil(CARDS / chunkSize);
      var totalMs = Math.max(sec, 4) * 1000;
      var slotMs = Math.floor(totalMs / chunkCount);

      var indices = [];
      for (var idx = 0; idx < CARDS; idx++) indices.push(idx);
      for (var j = indices.length - 1; j > 0; j--) {
        var r = Math.floor(Math.random() * (j + 1));
        var tmp = indices[j]; indices[j] = indices[r]; indices[r] = tmp;
      }

      $('hudStatus').hidden = true;
      banner.hidden = false;
      countEl.textContent = String(sec);
      barEl.style.transition = 'none';
      barEl.style.transform = 'scaleX(1)';

      requestAnimationFrame(function () {
        barEl.style.transition = 'transform ' + (totalMs / 1000) + 's linear';
        barEl.style.transform = 'scaleX(0)';
      });

      var bStart = Date.now();
      state.previewInterval = setInterval(function () {
        var remain = (totalMs - (Date.now() - bStart)) / 1000;
        countEl.textContent = String(Math.max(0, Math.ceil(remain)));
        if (remain <= 0) {
          clearInterval(state.previewInterval);
          state.previewInterval = null;
        }
      }, 100);

      for (var g = 0; g < chunkCount; g++) {
        (function (groupIdx) {
          var slice = indices.slice(groupIdx * chunkSize, (groupIdx + 1) * chunkSize);
          var openAt = groupIdx * slotMs;
          var closeAt = (groupIdx + 1) * slotMs - 180;
          later(function () {
            slice.forEach(function (ci) {
              if (state.cards[ci]) state.cards[ci].classList.add('is-flipped');
            });
          }, openAt);
          later(function () {
            slice.forEach(function (ci) {
              if (state.cards[ci]) state.cards[ci].classList.remove('is-flipped');
            });
          }, closeAt);
        })(g);
      }

      later(function () {
        if (state.previewInterval) {
          clearInterval(state.previewInterval);
          state.previewInterval = null;
        }
        state.cards.forEach(function (card) { card.classList.remove('is-flipped'); });
        $('previewBanner').hidden = true;
        $('hudStatus').hidden = false;
        beginPlay();
      }, totalMs + 220);
      return;
    }

    var wave = reduceMotion ? 0 : 26;

    $('hudStatus').hidden = true;
    $('gameHint').textContent = '미리보기 동안 32장의 그림이 모두 공개됩니다.';
    banner.hidden = false;
    countEl.textContent = String(sec);
    barEl.style.transition = 'none';
    barEl.style.transform = 'scaleX(1)';

    // 파도타기처럼 한 장씩 앞면으로
    state.cards.forEach(function (card, i) {
      later(function () { card.classList.add('is-flipped'); }, i * wave);
    });

    var waveIn = (CARDS - 1) * wave + 460;

    later(function () {
      var remain = sec;
      var start = Date.now();
      requestAnimationFrame(function () {
        barEl.style.transition = 'transform ' + sec + 's linear';
        barEl.style.transform = 'scaleX(0)';
      });

      state.previewInterval = setInterval(function () {
        remain = sec - (Date.now() - start) / 1000;
        countEl.textContent = String(Math.max(0, Math.ceil(remain)));
        if (remain <= 0) {
          clearInterval(state.previewInterval);
          state.previewInterval = null;
          hideAllCards();
        }
      }, 100);
    }, waveIn);
  }

  function hideAllCards() {
    var wave = reduceMotion ? 0 : 16;
    $('hudStatus').textContent = '시작! 같은 인물 두 장을 찾으세요';
    $('hudStatus').hidden = false;
    $('previewBanner').hidden = true;

    state.cards.forEach(function (card, i) {
      later(function () { card.classList.remove('is-flipped'); }, i * wave);
    });

    later(function () { beginPlay(); }, (CARDS - 1) * wave + 470);
  }

  function beginPlay() {
    state.phase = 'play';
    state.busy = false;
    state.startAt = Date.now();
    $('gameHint').textContent = '한 번 틀리면 탈락! 더 못 찾겠으면 탈락 전에 "중간 완료"로 현재 점수를 확정하세요.';
    $('hudStatus').textContent = '카드를 두 장 뒤집어 같은 인물을 찾으세요';

    var btn = $('btnComplete');
    btn.disabled = false;
    btn.classList.remove('is-ready');
    btn.textContent = '중간 완료 (0/' + PAIRS + '쌍)';

    state.timerId = setInterval(function () {
      $('hudTimer').textContent = fmt(Date.now() - state.startAt);
    }, 200);
    startTurnTimer();
  }

  function resolveMatch(a, b) {
    a.classList.add('is-matched');
    b.classList.add('is-matched');
    a.setAttribute('aria-label', '맞힌 카드');
    b.setAttribute('aria-label', '맞힌 카드');
    state.matched++;
    $('hudPairs').textContent = String(state.matched);
    state.first = state.second = null;
    Sound.match();

    if (state.matched >= PAIRS) {
      enableComplete();
    } else {
      state.busy = false;
      $('hudStatus').textContent = '좋아요! ' + Store.getTurnLimitSeconds() + '초 안에 다음 짝을 찾으세요';
      $('btnComplete').textContent = '중간 완료 (' + state.matched + '/' + PAIRS + '쌍)';
      startTurnTimer();
    }
  }

  function resolveFail(a, b) {
    $('btnComplete').disabled = true;
    a.classList.add('is-wrong');
    b.classList.add('is-wrong');
    Sound.wrong();
    $('hudStatus').textContent = '다른 그림이 나왔습니다…';
    later(function () { endByFail(a, b); }, 1000);
  }

  function endByTimeout() {
    if (state.phase !== 'play') return;
    var finalPairs = state.matched;
    state.phase = 'saving';
    state.busy = true;
    clearTimers();

    var btn = $('btnComplete');
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('is-ready');
      btn.textContent = '시간 초과 · 기록 중…';
    }
    $('hudStatus').textContent = '시간 초과! 현재까지 맞춘 쌍으로 순위를 등록합니다…';

    var elapsed = state.startAt ? Date.now() - state.startAt : 0;
    Store.completeTeam(state.team.id, finalPairs, elapsed).then(function (res) {
      var lock = readLock();
      if (lock) {
        lock.status = 'done';
        lock.pairs = finalPairs;
        lock.rank = res.rank || null;
        writeLock(lock);
      }
      state.phase = 'over';
      Sound.match();
      showDone(res.rank, res.total, elapsed, finalPairs, 'timeout');
    }).catch(function (err) {
      console.error(err);
      state.phase = 'over';
      toast('순위 기록에 실패했습니다. 새로고침하지 말고 사회자에게 알려주세요.');
    });
  }

  function endByFail(a, b) {
    var finalPairs = state.matched;
    state.phase = 'saving';
    state.busy = true;
    clearTimers();

    var elapsed = state.startAt ? Date.now() - state.startAt : 0;
    Store.completeTeam(state.team.id, finalPairs, elapsed).then(function (res) {
      var lock = readLock();
      if (lock) {
        lock.status = 'done';
        lock.pairs = finalPairs;
        lock.rank = res.rank || null;
        writeLock(lock);
      }
      state.phase = 'over';
      showDone(res.rank, res.total, elapsed, finalPairs, 'wrong');
    }).catch(function (err) {
      console.error(err);
      state.phase = 'over';
      toast('순위 기록에 실패했습니다. 새로고침하지 말고 사회자에게 알려주세요.');
    });
  }

  function enableComplete() {
    state.phase = 'ready';
    state.busy = true;
    var btn = $('btnComplete');
    btn.disabled = false;
    btn.classList.add('is-ready');
    btn.textContent = '완료';
    $('hudStatus').textContent = '모두 찾았습니다! 완료 버튼을 누르세요';
    $('gameHint').textContent = '지금 완료 버튼을 눌러야 순위가 기록됩니다.';
    Sound.win();
    btn.focus({ preventScroll: true });
  }

  function submitComplete() {
    if (state.phase !== 'play' && state.phase !== 'ready') return;
    var prevPhase = state.phase;
    var finalPairs = state.matched;
    state.phase = 'saving';
    state.busy = true;

    var btn = $('btnComplete');
    btn.disabled = true;
    btn.classList.remove('is-ready');
    btn.textContent = '기록 중…';

    var elapsed = Date.now() - state.startAt;
    clearTimers();

    Store.completeTeam(state.team.id, finalPairs, elapsed).then(function (res) {
      var lock = readLock();
      if (lock) {
        lock.status = 'done';
        lock.pairs = finalPairs;
        lock.rank = res.rank || null;
        writeLock(lock);
      }
      state.phase = 'over';
      showDone(res.rank, res.total, elapsed, finalPairs);
    }).catch(function (err) {
      console.error(err);
      state.phase = prevPhase;
      state.busy = false;
      btn.disabled = false;
      if (prevPhase === 'ready') {
        btn.classList.add('is-ready');
        btn.textContent = '완료';
      } else {
        btn.textContent = '중간 완료 (' + finalPairs + '/' + PAIRS + '쌍)';
      }
      toast('순위 기록에 실패했습니다. 다시 눌러 주세요.');
    });
  }

  function showDone(rank, total, elapsed, finalPairs, endReason) {
    var pairsDone = typeof finalPairs === 'number' ? finalPairs : PAIRS;
    var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆';
    var rankHtml;
    if (rank && rank <= 10) {
      rankHtml = '<div class="big-rank"><span>' + rank + '등</span><small>' + medal + '</small></div>';
    } else if (rank) {
      rankHtml = '<div class="big-rank"><span>' + rank + '등</span><small>' + (pairsDone >= PAIRS ? '완주' : '완료') + '</small></div>' +
        '<p style="margin:0 0 12px;font-size:12.5px;color:var(--ink-faint)">10위권 밖이지만 전체 순위에 기록이 확정되었습니다!</p>';
    } else {
      rankHtml = '';
    }

    var titleText = endReason === 'timeout'
      ? '시간 초과 · 기록 완료!'
      : endReason === 'wrong'
        ? '오답 종료 · 기록 완료!'
        : (pairsDone >= PAIRS ? '16쌍 모두 완료!' : '기록 완료!');

    var emojiIcon = endReason === 'timeout' ? '⏰' : (endReason === 'wrong' ? '😵' : '🏆');

    showOverlay({
      emoji: emojiIcon,
      title: titleText,
      win: endReason !== 'wrong',
      html:
        rankHtml +
        '<dl class="result-grid">' +
          '<div><dt>찾은 짝</dt><dd>' + pairsDone + ' / ' + PAIRS + '</dd></div>' +
          '<div><dt>도전 시간</dt><dd>' + fmt(elapsed) + '</dd></div>' +
        '</dl>' +
        '<p style="margin:0">' + (total ? '지금까지 <b>' + total + '팀</b>이 완료했습니다.' : '') + '</p>',
      afterClose: function () { showIntro(readLock()); }
    });

    $('gamebarRank').hidden = false;
    $('gamebarRank').textContent = rank ? rank + '등' : '완료';
  }

  function showOverlay(opts) {
    var ov = $('overlay');
    $('ovEmoji').textContent = opts.emoji || '';
    var title = $('ovTitle');
    title.textContent = opts.title || '';
    title.classList.toggle('is-win', !!opts.win);
    var body = $('ovBody');
    if (opts.html) body.innerHTML = opts.html;
    else body.innerHTML = opts.body || '';
    ov.hidden = false;
    ov._afterClose = opts.afterClose || function () { showIntro(readLock()); };
    $('ovClose').focus({ preventScroll: true });
  }

  function closeOverlay() {
    var ov = $('overlay');
    ov.hidden = true;
    var after = ov._afterClose;
    ov._afterClose = null;
    if (typeof after === 'function') after();
  }

  /* --------------------------- 초기화 --------------------------- */
  var lastGameId = null;

  function syncSessionUI(session) {
    var sec = Math.max(3, Math.min(20, Number(session.previewSeconds) || 5));
    var isSolo = Store.getPlayMode() === 'solo';
    if ($('rulePreview')) $('rulePreview').textContent = String(sec);
    if ($('rulePreviewMode')) {
      $('rulePreviewMode').textContent = Store.getPreviewMode() === 'batch'
        ? '12장씩 3번에 나눠서'
        : '32장(16쌍)이 한 번에';
    }
    if ($('ruleTurnLimit')) $('ruleTurnLimit').textContent = String(Store.getTurnLimitSeconds());
    if ($('introRound')) {
      $('introRound').textContent = '라운드 ' + (Number(session.roundNo) || 1) +
        ' · ' + (isSolo ? '개인전' : '팀전') +
        ' · 후보 ' + CELEBS.length + '명 중 ' + PAIRS + '명 랜덤';
    }
    if ($('entryLabel')) $('entryLabel').textContent = isSolo ? '팀명 / 이름' : '팀 이름';
    if ($('teamInputWrap')) $('teamInputWrap').hidden = isSolo;
    if ($('soloInputWrap')) $('soloInputWrap').hidden = !isSolo;
  }

  function handleSession(session) {
    var lock = readLock();
    syncSessionUI(session);

    var gameChanged = lastGameId !== null && lastGameId !== session.gameId;
    lastGameId = session.gameId;

    if (lock && lock.gameId !== session.gameId) {
      writeLock(null);
      clearTimers();
      state.phase = 'intro';
      state.busy = true;
      state.cards = [];
      $('board').innerHTML = '';
      $('overlay').hidden = true;
      showIntro(null);
      toast('사회자가 게임을 초기화했습니다. 다시 참여해 주세요.');
    } else if (gameChanged) {
      showIntro(lock);
    }
  }

  function boot() {
    // 소리 버튼
    var btnSound = $('btnSound');
    function paintSound() {
      btnSound.textContent = Sound.isOn() ? '🔊' : '🔇';
      btnSound.setAttribute('aria-pressed', Sound.isOn() ? 'true' : 'false');
      btnSound.setAttribute('aria-label', Sound.isOn() ? '소리 끄기' : '소리 켜기');
      btnSound.title = btnSound.getAttribute('aria-label');
    }
    paintSound();
    btnSound.addEventListener('click', function () {
      Sound.set(!Sound.isOn());
      paintSound();
      if (Sound.isOn()) Sound.flip();
    });

    // 시작
    $('startForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (Store.getPlayMode() === 'solo') {
        var gIn = $('soloGroup');
        var pIn = $('soloName');
        var grp = gIn.value.trim();
        var plr = pIn.value.trim();
        if (grp.length < 1) {
          gIn.focus();
          gIn.classList.add('shake');
          setTimeout(function () { gIn.classList.remove('shake'); }, 400);
          toast('팀명을 입력해 주세요.');
          return;
        }
        if (plr.length < 1) {
          pIn.focus();
          pIn.classList.add('shake');
          setTimeout(function () { pIn.classList.remove('shake'); }, 400);
          toast('이름을 입력해 주세요.');
          return;
        }
        Sound.flip();
        startGame('[' + grp + '] ' + plr, { groupName: grp, playerName: plr });
        return;
      }

      var input = $('teamName');
      var name = input.value.trim();
      if (name.length < 1) {
        input.focus();
        input.classList.add('shake');
        setTimeout(function () { input.classList.remove('shake'); }, 400);
        toast('팀 이름을 입력해 주세요.');
        return;
      }
      Sound.flip();
      startGame(name);
    });

    // 카드 클릭
    $('board').addEventListener('click', function (e) {
      var card = e.target.closest('.card');
      if (!card || state.busy || state.phase !== 'play') return;
      if (card.classList.contains('is-flipped') || card.classList.contains('is-matched')) return;

      card.classList.add('is-flipped');
      Sound.flip();

      if (!state.first) { state.first = card; return; }

      var a = state.first;
      var b = card;
      state.second = b;
      state.busy = true;
      stopTurnTimer();

      if (a.dataset.celeb === b.dataset.celeb) {
        later(function () { resolveMatch(a, b); }, 480);
      } else {
        later(function () { resolveFail(a, b); }, 560);
      }
    });

    // 완료
    $('btnComplete').addEventListener('click', submitComplete);
    $('ovClose').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('overlay').hidden) closeOverlay();
    });

    var startLock = readLock();
    $('hudPairsTotal').textContent = '/' + PAIRS;
    Store.init().then(function () {
      var session = Store.getSession();
      preloadImages(Store.getRoundIds());   // 이번 라운드 그림 미리 로드

      // 관리자 초기화로 게임이 바뀌면 이전 잠금은 자동 해제
      if (startLock && startLock.gameId !== session.gameId) {
        writeLock(null);
        startLock = null;
      }
      // 진행 중 새로고침 → 재도전 방지를 위해 중단 처리
      if (startLock && startLock.status === 'playing') {
        Store.failTeam(startLock.teamId, startLock.pairs || 0, 'reload');
        startLock.status = 'out';
        writeLock(startLock);
      }

      handleSession(session);
      if (startLock) showIntro(startLock);

      Store.on('session', handleSession);
      Store.on('teams', function () { /* 리더보드는 관리자 화면에서 사용 */ });
    }).catch(function (err) {
      console.error(err);
      toast('게임을 준비하지 못했습니다. 새로고침해 주세요.');
    });
  }

  window.__wsgState = state;   // 디버깅/테스트용

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
