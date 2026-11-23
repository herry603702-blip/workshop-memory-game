/* =========================================================
   store.js — 게임 상태/참가팀 저장소
   ---------------------------------------------------------
   같은 API로 두 가지 저장 방식을 지원합니다.
     · firebase : 여러 기기(팀별 노트북)의 기록을 실시간 공유
     · local    : Firebase 미설정 시. localStorage + BroadcastChannel
                  (같은 브라우저의 여러 탭끼리만 공유)
   ========================================================= */
(function () {
  'use strict';

  var LS_SESSION = 'wsg:session';
  var LS_TEAMS = 'wsg:teams';
  var BC_NAME = 'wsg-sync';
  var FB_VERSION = '10.12.2';

  var cfg = (window.GAME_CONFIG && window.GAME_CONFIG.firebase) || {};
  var fbReady = !!(cfg.databaseURL && cfg.apiKey);

  var mode = 'local';
  var session = null;
  var teams = {};           // key -> { id, name, gameId, status, startedAt, completedAt, failedAt, pairs }
  var db = null;
  var fb = null;
  var bc = null;
  var listeners = { session: [], teams: [], mode: [] };

  function emit(kind, payload) {
    listeners[kind].forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }

  function newGameId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  /* ------------------- 라운드(인물 16명) 뽑기 ------------------- */
  function poolIds() {
    var list = (window.GAME_CONFIG && window.GAME_CONFIG.celebrities) || [];
    return list.map(function (c) { return c.id; });
  }

  function pickRoundIds() {
    var n = (window.GAME_CONFIG && window.GAME_CONFIG.cardsPerRound) || 16;
    var ids = poolIds().slice();
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    return ids.slice(0, Math.min(n, ids.length)).sort(function (a, b) { return a - b; });
  }

  function validRoundIds(ids) {
    var pool = poolIds();
    var n = (window.GAME_CONFIG && window.GAME_CONFIG.cardsPerRound) || 16;
    if (!Array.isArray(ids)) return null;
    var clean = ids.filter(function (id) { return pool.indexOf(id) >= 0; });
    var uniq = clean.filter(function (id, i) { return clean.indexOf(id) === i; });
    return uniq.length >= n ? uniq.slice(0, n) : null;
  }

  function defaultSession() {
    var sec = (window.GAME_CONFIG && window.GAME_CONFIG.defaultPreviewSeconds) || 5;
    return {
      gameId: newGameId(),
      roundNo: 1,
      previewSeconds: sec,
      roundIds: pickRoundIds(),
      updatedAt: Date.now()
    };
  }

  function normalize(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v && typeof v === 'object') { v.id = v.id || k; out[k] = v; }
    });
    return out;
  }

  function currentTeams() {
    var list = Object.keys(teams).map(function (k) { return teams[k]; })
      .filter(function (t) { return t.gameId === session.gameId; });
    return list;
  }

  /* 순위: 맞춘 쌍 수(pairs) 내림차순 → 완료(completedAt) 오름차순 → id 순 */
  function rankOf(teamId) {
    var done = currentTeams().filter(function (t) {
      return t.status === 'done' && typeof t.completedAt === 'number';
    }).sort(function (a, b) {
      return ((b.pairs || 0) - (a.pairs || 0)) || (a.completedAt - b.completedAt) || (a.id < b.id ? -1 : 1);
    });
    var idx = done.findIndex(function (t) { return t.id === teamId; });
    return { rank: idx >= 0 ? idx + 1 : null, total: done.length };
  }

  /* ------------------------- local ------------------------- */
  function readLocalSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { return null; }
  }
  function readLocalTeams() {
    try { return normalize(JSON.parse(localStorage.getItem(LS_TEAMS) || '{}')); } catch (e) { return {}; }
  }
  function writeLocalTeams() {
    try { localStorage.setItem(LS_TEAMS, JSON.stringify(teams)); } catch (e) { console.error(e); }
  }
  function saveLocalSession() {
    try { localStorage.setItem(LS_SESSION, JSON.stringify(session)); } catch (e) { console.error(e); }
  }
  function broadcast(type) {
    if (bc) { try { bc.postMessage({ type: type }); } catch (e) { /* ignore */ } }
  }

  function initLocal() {
    mode = 'local';
    session = readLocalSession() || defaultSession();
    if (!validRoundIds(session.roundIds)) session.roundIds = pickRoundIds();
    if (!session.roundNo) session.roundNo = 1;
    saveLocalSession();
    teams = readLocalTeams();

    try {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = function (e) {
        if (!e.data) return;
        if (e.data.type === 'teams') { teams = readLocalTeams(); emit('teams', currentTeams()); }
        if (e.data.type === 'session') {
          session = readLocalSession() || session;
          teams = readLocalTeams();
          emit('session', session); emit('teams', currentTeams());
        }
      };
    } catch (e) { /* BroadcastChannel 미지원 브라우저 */ }

    window.addEventListener('storage', function (e) {
      if (e.key === LS_TEAMS) { teams = readLocalTeams(); emit('teams', currentTeams()); }
      if (e.key === LS_SESSION) {
        session = readLocalSession() || session;
        teams = readLocalTeams();
        emit('session', session); emit('teams', currentTeams());
      }
    });

    emit('mode', mode);
    emit('session', session);
    emit('teams', currentTeams());
  }

  /* ----------------------- firebase ------------------------ */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function initFirebase() {
    return loadScript('https://www.gstatic.com/firebasejs/' + FB_VERSION + '/firebase-app-compat.js')
      .then(function () {
        return loadScript('https://www.gstatic.com/firebasejs/' + FB_VERSION + '/firebase-database-compat.js');
      })
      .then(function () {
        fb = window.firebase;
        if (!fb.apps.length) fb.initializeApp(cfg);
        db = fb.database();

        var sref = db.ref('session');
        return sref.transaction(function (cur) {
          if (!cur) return defaultSession();
          var next = Object.assign({}, cur);
          var changed = false;
          if (!validRoundIds(next.roundIds)) { next.roundIds = pickRoundIds(); changed = true; }
          if (!next.roundNo) { next.roundNo = 1; changed = true; }
          return changed ? next : undefined;   // undefined = 변경 없이 종료
        }).then(function () {
          return sref.once('value');          // 세션을 확실히 읽은 뒤 시작
        }).then(function (snap) {
          session = snap.val() || defaultSession();
          return db.ref('teams').once('value').then(function (t) {
            teams = normalize(t.val() || {});
            sref.on('value', function (s) {
              session = s.val() || session;
              emit('session', session);
              emit('teams', currentTeams());
            });
            db.ref('teams').on('value', function (s) {
              teams = normalize(s.val() || {});
              emit('teams', currentTeams());
            });
            mode = 'firebase';
            emit('session', session);
            emit('teams', currentTeams());
            emit('mode', mode);
          });
        });
      });
  }

  /* -------------------------- API -------------------------- */
  var Store = {
    init: function () {
      if (!fbReady) { initLocal(); return Promise.resolve('local'); }
      return initFirebase().catch(function (err) {
        console.warn('[store] Firebase 연결 실패 → 로컬 모드로 전환', err);
        initLocal();
        return 'local';
      });
    },

    mode: function () { return mode; },
    isShared: function () { return mode === 'firebase'; },

    on: function (kind, fn) {
      if (listeners[kind]) listeners[kind].push(fn);
      return function () {
        var i = listeners[kind].indexOf(fn);
        if (i >= 0) listeners[kind].splice(i, 1);
      };
    },

    getSession: function () { return session || defaultSession(); },

    /* 이번 라운드의 인물 id 16개 (모든 팀이 같은 세트를 씁니다) */
    getRoundIds: function () {
      var s = this.getSession();
      var ids = validRoundIds(s.roundIds);
      if (!ids) { ids = pickRoundIds(); }
      return ids;
    },

    getPreviewSeconds: function () {
      var s = this.getSession();
      return Math.max(3, Math.min(20, Number(s.previewSeconds) || 5));
    },

    listTeams: function () { return currentTeams(); },

    /* 팀 생성 → { id, name } */
    createTeam: function (name) {
      name = String(name || '').trim().slice(0, 12) || '이름없는 팀';
      var self = this;

      // 같은 이름이 있으면 뒤에 번호를 붙여 구분
      var same = currentTeams().filter(function (t) { return t.name === name || t.name.indexOf(name + ' (') === 0; });
      if (same.length) name = name + ' (' + (same.length + 1) + ')';

      if (mode === 'local') {
        var key = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        teams[key] = {
          id: key, name: name, gameId: session.gameId, status: 'playing',
          startedAt: Date.now(), pairs: 0
        };
        writeLocalTeams(); broadcast('teams'); emit('teams', currentTeams());
        return Promise.resolve({ id: key, name: name });
      }

      var ref = db.ref('teams').push();
      return ref.set({
        name: name, gameId: session.gameId, status: 'playing',
        startedAt: fb.database.ServerValue.TIMESTAMP, pairs: 0
      }).then(function () {
        return { id: ref.key, name: name };
      });
    },

    /* 탈락 처리 */
    failTeam: function (id, pairs, reason) {
      var patch = { status: 'out', pairs: pairs || 0, reason: reason || 'mismatch' };
      if (mode === 'local') {
        if (teams[id]) { teams[id] = Object.assign({}, teams[id], patch, { failedAt: Date.now() }); }
        writeLocalTeams(); broadcast('teams'); emit('teams', currentTeams());
        return Promise.resolve();
      }
      patch.failedAt = fb.database.ServerValue.TIMESTAMP;
      return db.ref('teams/' + id).update(patch);
    },

    /* 완료 처리 → { rank, total, completedAt } */
    completeTeam: function (id, pairs, elapsedMs) {
      var self = this;
      if (mode === 'local') {
        var ts = Date.now();
        if (teams[id]) { teams[id] = Object.assign({}, teams[id], { status: 'done', pairs: pairs, completedAt: ts, elapsedMs: elapsedMs }); }
        writeLocalTeams(); broadcast('teams'); emit('teams', currentTeams());
        var r = rankOf(id);
        return Promise.resolve({ rank: r.rank, total: r.total, completedAt: ts });
      }
      return db.ref('teams/' + id).update({
        status: 'done', pairs: pairs, elapsedMs: elapsedMs,
        completedAt: fb.database.ServerValue.TIMESTAMP
      }).then(function () {
        return db.ref('teams/' + id).once('value');
      }).then(function (snap) {
        var v = snap.val() || {};
        var ts = typeof v.completedAt === 'number' ? v.completedAt : Date.now();
        return db.ref('teams').once('value').then(function (all) {
          teams = normalize(all.val() || {});
          emit('teams', currentTeams());
          var done = currentTeams().filter(function (t) {
            return t.status === 'done' && typeof t.completedAt === 'number';
          }).sort(function (a, b) { return ((b.pairs || 0) - (a.pairs || 0)) || (a.completedAt - b.completedAt) || (a.id < b.id ? -1 : 1); });
          var idx = done.findIndex(function (t) { return t.id === id; });
          return { rank: idx >= 0 ? idx + 1 : null, total: done.length, completedAt: ts };
        });
      });
    },

    /* 새 라운드로 초기화 (관리자) — 인물 16명도 새로 뽑습니다 */
    resetGame: function () {
      var cur = this.getSession();
      var next = {
        gameId: newGameId(),
        roundNo: (Number(cur.roundNo) || 1) + 1,
        previewSeconds: this.getPreviewSeconds(),
        roundIds: pickRoundIds(),
        updatedAt: Date.now(),
        resetAt: Date.now()
      };
      if (mode === 'local') {
        session = next; saveLocalSession(); broadcast('session');
        emit('session', session); emit('teams', currentTeams());
        return Promise.resolve(next);
      }
      var p = {
        gameId: next.gameId,
        roundNo: next.roundNo,
        previewSeconds: next.previewSeconds,
        roundIds: next.roundIds,
        resetAt: fb.database.ServerValue.TIMESTAMP
      };
      return db.ref('session').update(p).then(function () { return next; });
    },

    /* 미리보기 시간 변경 (관리자) */
    setPreviewSeconds: function (sec) {
      sec = Math.max(3, Math.min(20, Number(sec) || 5));
      if (mode === 'local') {
        session = Object.assign({}, session, { previewSeconds: sec, updatedAt: Date.now() });
        saveLocalSession(); broadcast('session'); emit('session', session);
        return Promise.resolve(sec);
      }
      return db.ref('session').update({ previewSeconds: sec }).then(function () { return sec; });
    },

    rankOf: rankOf
  };

  window.Store = Store;
})();
