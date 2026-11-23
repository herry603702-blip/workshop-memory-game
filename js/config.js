/* =========================================================
   게임 설정 파일
   - 이 파일만 수정하면 게임 구성과 Firebase 연결을 바꿀 수 있습니다.
   ========================================================= */
window.GAME_CONFIG = {
  /* 관리자 화면에서 설정한 값이 없을 때 쓰이는 기본 미리보기 시간(초) */
  defaultPreviewSeconds: 5,

  /* 한 판에 쓰는 인물 수 (= 카드 16장, 4×4) */
  cardsPerRound: 8,

  /* 분류 이름 (관리자 화면·보고서 표기용) */
  groups: {
    pokemon: '포켓몬',
    anime: '애니메이션',
    disney: '디즈니 · 픽사 · 히어로',
    game: '게임 캐릭터'
  },

  /* =======================================================
     캐릭터 후보 풀 — 매 판 이 중에서 무작위로 16종을 뽑습니다.
     사진: images/celeb_NN.jpg (NN = id)
     ======================================================= */
  celebrities: [
    /* ---------- 포켓몬 (8) ---------- */
    { id: 1,  name: '피카츄',   group: 'pokemon' },
    { id: 2,  name: '꼬부기',   group: 'pokemon' },
    { id: 3,  name: '파이리',   group: 'pokemon' },
    { id: 4,  name: '이상해씨', group: 'pokemon' },
    { id: 5,  name: '잠만보',   group: 'pokemon' },
    { id: 6,  name: '푸린',     group: 'pokemon' },
    { id: 25, name: '고라파덕', group: 'pokemon' },
    { id: 26, name: '이브이',   group: 'pokemon' },

    /* ---------- 애니메이션 (8) ---------- */
    { id: 7,  name: '도라에몽', group: 'anime' },
    { id: 8,  name: '짱구',     group: 'anime' },
    { id: 9,  name: '헬로키티', group: 'anime' },
    { id: 13, name: '스펀지밥', group: 'anime' },
    { id: 14, name: '뚱이',     group: 'anime' },
    { id: 16, name: '토토로',   group: 'anime' },
    { id: 19, name: '스누피',   group: 'anime' },
    { id: 20, name: '가필드',   group: 'anime' },
    { id: 21, name: '호머심슨', group: 'anime' },

    /* ---------- 디즈니 · 픽사 · 히어로 (8) ---------- */
    { id: 10, name: '미키마우스', group: 'disney' },
    { id: 11, name: '도널드덕',   group: 'disney' },
    { id: 12, name: '곰돌이푸',   group: 'disney' },
    { id: 22, name: '슈렉',       group: 'disney' },
    { id: 23, name: '올라프',     group: 'disney' },
    { id: 24, name: '미니언',     group: 'disney' },
    { id: 27, name: '스파이더맨', group: 'disney' },
    { id: 28, name: '아이언맨',   group: 'disney' },

    /* ---------- 게임 캐릭터 (3) ---------- */
    { id: 15, name: '슈퍼마리오', group: 'game' },
    { id: 17, name: '커비',       group: 'game' },
    { id: 18, name: '소닉',       group: 'game' }
  ],

  /* =======================================================
     Firebase Realtime Database 설정
     -------------------------------------------------------
     아래 값들을 채우면 여러 노트북(팀)의 순위가 실시간으로
     공유됩니다. 비워 두면 '로컬 모드'로 동작하며,
     순위는 그 기기(브라우저) 안에서만 기록됩니다.

     준비 순서는 README.md 의 'Firebase 연결하기' 를 보세요.
     ======================================================= */
  firebase: {
    apiKey: 'AIzaSyATfUDUkQaVXql0zxr5mt2HmhYC15U3x-k',
    authDomain: 'memory-622cf.firebaseapp.com',
    databaseURL: 'https://memory-622cf-default-rtdb.firebaseio.com',
    projectId: 'memory-622cf',
    storageBucket: 'memory-622cf.firebasestorage.app',
    messagingSenderId: '1070850616494',
    appId: '1:1070850616494:web:455471465529f3fb6c113f'
  }
};
