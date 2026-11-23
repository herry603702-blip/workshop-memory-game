/* =========================================================
   admin.js — 사회자(운영) 화면
   ========================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var gameUrl = new URL('index.html?v=19', location.href).href.split('#')[0];
  var qrRendered = false;

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(ms) {
    if (typeof ms !== 'number' || ms < 0) return '';
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function clock(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (e) { return ''; }
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ----------------------------- 링크 ----------------------------- */
  function paintLink() {
    $('gameUrl').textContent = gameUrl;
    $('btnOpen').href = gameUrl;
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '링크를 복사했습니다 ✓' : '복사가 막혔어요. 링크를 길게 눌러 직접 복사해 주세요.');
  }

  function copyLink() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(gameUrl).then(function () {
        toast('링크를 복사했습니다 ✓');
      }).catch(function () { fallbackCopy(gameUrl); });
    } else {
      fallbackCopy(gameUrl);
    }
  }

  function renderQr() {
    if (qrRendered) return;
    var box = $('qrBox');
    box.innerHTML = '';
    if (window.QRCode && !window.__qrCdnFailed) {
      try {
        new window.QRCode(box, {
          text: gameUrl,
          width: 148,
          height: 148,
          colorDark: '#0b0d17',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
        qrRendered = true;
        return;
      } catch (e) { /* fallback */ }
    }
    var img = document.createElement('img');
    img.alt = '참가자 접속 링크 QR 코드';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=' +
      encodeURIComponent(gameUrl);
    box.appendChild(img);
    qrRendered = true;
  }

  /* --------------------------- 리더보드 --------------------------- */
  function sortedTeams() {
    var list = window.Store.listTeams().slice();
    var done = list.filter(function (t) { return t.status === 'done'; })
      .sort(function (a, b) {
        return ((b.pairs || 0) - (a.pairs || 0)) || ((a.completedAt || 0) - (b.completedAt || 0)) || (a.id < b.id ? -1 : 1);
      });
    var playing = list.filter(function (t) { return t.status === 'playing'; })
      .sort(function (a, b) { return (a.startedAt || 0) - (b.startedAt || 0); });
    var out = list.filter(function (t) { return t.status === 'out'; })
      .sort(function (a, b) { return (b.failedAt || 0) - (a.failedAt || 0); });
    return { done: done, playing: playing, out: out, all: done.concat(playing, out) };
  }

  var showAllBoard = false;

  function renderBoard() {
    var s = sortedTeams();
    var ol = $('leaderboard');
    var list = (!showAllBoard && s.all.length > 10) ? s.all.slice(0, 10) : s.all;
    var html = '';

    list.forEach(function (t) {
      var rank = s.done.indexOf(t) + 1;
      var cls = 'row';
      var rankText = '–';
      var meta = '';
      var tag = '';

      if (t.status === 'done') {
        rankText = String(rank);
        if (rank === 1) cls += ' row--podium';
        else if (rank === 2) cls += ' row--podium row--second';
        else if (rank === 3) cls += ' row--podium row--third';
        meta = (t.pairs || 0) + '/16쌍' + (t.elapsedMs ? ' · ' + fmt(t.elapsedMs) : '');
        tag = '<span class="tag tag--done">완료</span>';
      } else if (t.status === 'out') {
        meta = '찾은 짝 ' + (t.pairs || 0) + '/16';
        tag = '<span class="tag tag--out">탈락</span>';
      } else {
        meta = '참가 중' + (t.startedAt ? ' · ' + clock(t.startedAt) : '');
        tag = '<span class="tag tag--playing">진행 중</span>';
      }

      var teamHtml = (t.groupName && t.playerName)
        ? '<span class="row__team"><small style="opacity:.72;margin-right:6px;font-weight:600;">[' + esc(t.groupName) + ']</small>' + esc(t.playerName) + '</span>'
        : '<span class="row__team">' + esc(t.name) + '</span>';

      html += '<li class="' + cls + '"' + (t.completedAt ? ' title="완료 ' + esc(clock(t.completedAt)) + '"' : '') + '>' +
        '<span class="row__rank">' + rankText + '</span>' +
        teamHtml +
        '<span class="row__meta">' + esc(meta) + '</span>' +
        tag +
      '</li>';
    });

    ol.innerHTML = html;
    $('emptyBoard').hidden = s.all.length > 0;
    var moreBtn = $('btnBoardMore');
    if (moreBtn) {
      if (s.all.length > 10) {
        moreBtn.hidden = false;
        moreBtn.textContent = showAllBoard ? '10위까지만 보기 ▲' : '더보기 (전체 ' + s.all.length + '팀 보기) ▼';
      } else {
        moreBtn.hidden = true;
      }
    }

    $('statTotal').textContent = String(s.all.length);
    $('statDone').textContent = String(s.done.length);
    $('statOut').textContent = String(s.out.length);
    $('statPlaying').textContent = String(s.playing.length);

    $('boardHint').textContent = s.done.length
      ? '완료 ' + s.done.length + '팀 · 맞춘 쌍 많은 순 → 같으면 선착순으로 순위가 정해집니다'
      : '맞춘 쌍 많은 순 → 같으면 완료 버튼 선착순으로 순위가 정해집니다';
  }

  /* --------------------------- 인물 목록 --------------------------- */
  function pad2(n) { return String(n).padStart(2, '0'); }

  function celebById(id) {
    var list = (window.GAME_CONFIG && window.GAME_CONFIG.celebrities) || [];
    return list.filter(function (c) { return c.id === id; })[0] || { id: id, name: '?' };
  }

  function personCard(c) {
    var inRound = window.Store.getRoundIds().indexOf(c.id) >= 0;
    var file = 'celeb_' + pad2(c.id) + '.jpg';
    return '<div class="person' + (inRound ? ' is-round' : '') + '" title="' + esc(c.name) + ' · images/' + file + '">' +
      '<img src="images/' + file + '?v=17" alt="' + esc(c.name) + '" loading="lazy" />' +
      '<span class="person__name">' + esc(c.name) + '</span>' +
      '<span class="person__file">' + file + '</span>' +
    '</div>';
  }

  function renderRound() {
    var s = window.Store.getSession();
    var ids = window.Store.getRoundIds();
    $('roundBadge').textContent = '라운드 ' + (Number(s.roundNo) || 1);
    $('roundGrid').innerHTML = ids.map(function (id) {
      return personCard(celebById(id));
    }).join('');
  }

  function renderPool() {
    var groups = (window.GAME_CONFIG && window.GAME_CONFIG.groups) || {};
    var people = (window.GAME_CONFIG && window.GAME_CONFIG.celebrities) || [];
    $('poolCount').textContent = people.length + '명';

    var html = '';
    Object.keys(groups).forEach(function (key) {
      var list = people.filter(function (c) { return c.group === key; });
      if (!list.length) return;
      html += '<div class="pool-group"><h3>' + esc(groups[key]) + ' <span>' + list.length + '명</span></h3>' +
        '<div class="pool-grid">' + list.map(personCard).join('') + '</div></div>';
    });

    var others = people.filter(function (c) { return !groups[c.group]; });
    if (others.length) {
      html += '<div class="pool-group"><h3>기타 <span>' + others.length + '명</span></h3>' +
        '<div class="pool-grid">' + others.map(personCard).join('') + '</div></div>';
    }

    $('poolGroups').innerHTML = html;
  }

  /* ---------------------------- 모드 ---------------------------- */
  function paintMode() {
    var live = window.Store.isShared();
    var badge = $('modeBadge');
    badge.textContent = live ? '실시간 공유 중' : '로컬 모드 (이 기기만)';
    badge.classList.toggle('badge--live', live);
    badge.classList.toggle('badge--local', !live);
    $('fbPanel').hidden = live;
  }

  function paintSession() {
    var s = window.Store.getSession();
    var sel = $('previewSelect');
    if (document.activeElement !== sel) sel.value = String(s.previewSeconds || 5);
    var msel = $('previewModeSelect');
    var pm = window.Store.getPreviewMode();
    if (msel && document.activeElement !== msel) msel.value = pm;
    var tsel = $('turnLimitSelect');
    var tl = window.Store.getTurnLimitSeconds();
    if (tsel && document.activeElement !== tsel) tsel.value = String(tl);
    var psel = $('playModeSelect');
    var playM = window.Store.getPlayMode();
    if (psel && document.activeElement !== psel) psel.value = playM;
    var hcsel = $('hintCountSelect');
    var hc = window.Store.getHintCount();
    if (hcsel && document.activeElement !== hcsel) hcsel.value = String(hc);
    var hssel = $('hintSecSelect');
    var hs = window.Store.getHintSeconds();
    if (hssel && document.activeElement !== hssel) hssel.value = String(hs);
    $('sessionInfo').textContent = '게임 세션 ' + String(s.gameId).slice(0, 10) +
      ' · 라운드 ' + (Number(s.roundNo) || 1) +
      ' · ' + (playM === 'solo' ? '개인전' : '팀전') +
      ' · ' + (pm === 'batch' ? '12장씩 분할' : '32장 전체') +
      ' ' + (s.previewSeconds || 5) + '초' +
      ' · 제한 ' + tl + '초' +
      ' · ' + (hc > 0 ? '힌트 ' + hc + '회(' + hs + '초)' : '힌트 없음');
  }

  /* ---------------------------- 초기화 ---------------------------- */
  function openReset() { $('resetModal').hidden = false; $('btnConfirmReset').focus(); }
  function closeReset() { $('resetModal').hidden = true; $('btnReset').focus(); }

  function confirmReset() {
    var btn = $('btnConfirmReset');
    btn.disabled = true;
    window.Store.resetGame().then(function () {
      btn.disabled = false;
      closeReset();
      renderBoard();
      renderRound();
      renderPool();
      paintSession();
      toast('새 라운드를 시작했습니다. 인물 16명을 새로 뽑았습니다.');
    }).catch(function (e) {
      console.error(e);
      btn.disabled = false;
      toast('초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    });
  }

  /* ----------------------------- 시작 ----------------------------- */
  function boot() {
    paintLink();

    $('btnCopy').addEventListener('click', copyLink);
    if ($('btnBoardMore')) {
      $('btnBoardMore').addEventListener('click', function () {
        showAllBoard = !showAllBoard;
        renderBoard();
      });
    }
    $('linkBox').addEventListener('click', function () {
      var range = document.createRange();
      range.selectNodeContents($('gameUrl'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    $('qrDetails').addEventListener('toggle', function () {
      if ($('qrDetails').open) renderQr();
    });

    $('btnReset').addEventListener('click', openReset);
    $('btnCancelReset').addEventListener('click', closeReset);
    $('btnConfirmReset').addEventListener('click', confirmReset);
    $('resetModal').addEventListener('click', function (e) {
      if (e.target === $('resetModal')) closeReset();
    });

    $('previewSelect').addEventListener('change', function (e) {
      window.Store.setPreviewSeconds(e.target.value).then(function (sec) {
        toast('미리보기 시간을 ' + sec + '초로 설정했습니다.');
        paintSession();
      });
    });

    $('previewModeSelect').addEventListener('change', function (e) {
      window.Store.setPreviewMode(e.target.value).then(function (pm) {
        toast(pm === 'batch' ? '미리보기: 12장씩 3번 나눠 보기로 설정했습니다.' : '미리보기: 한 번에 32장 보기로 설정했습니다.');
        paintSession();
      });
    });

    $('turnLimitSelect').addEventListener('change', function (e) {
      window.Store.setTurnLimitSeconds(e.target.value).then(function (sec) {
        toast('한 쌍 제한시간을 ' + sec + '초로 설정했습니다.');
        paintSession();
      });
    });

    $('playModeSelect').addEventListener('change', function (e) {
      window.Store.setPlayMode(e.target.value).then(function (pm) {
        toast(pm === 'solo' ? '참가 방식: 개인전(팀명+이름 입력)으로 설정했습니다.' : '참가 방식: 팀전으로 설정했습니다.');
        paintSession();
      });
    });

    $('hintCountSelect').addEventListener('change', function (e) {
      window.Store.setHintCount(e.target.value).then(function (cnt) {
        toast(cnt > 0 ? '힌트 횟수를 ' + cnt + '회로 설정했습니다.' : '힌트를 사용하지 않도록 설정했습니다.');
        paintSession();
      });
    });

    $('hintSecSelect').addEventListener('change', function (e) {
      window.Store.setHintSeconds(e.target.value).then(function (sec) {
        toast('힌트 시간을 ' + sec + '초로 설정했습니다.');
        paintSession();
      });
    });

    $('gameUrl').textContent = gameUrl;

    window.Store.init().then(function () {
      paintMode();
      paintSession();
      renderBoard();
      renderRound();
      renderPool();
      window.Store.on('teams', renderBoard);
      window.Store.on('session', function () {
        paintSession(); renderBoard(); renderRound(); renderPool();
      });
    }).catch(function (e) {
      console.error(e);
      toast('저장소에 연결하지 못했습니다. 새로고침해 주세요.');
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
