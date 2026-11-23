/* =========================================================
   게임 설정 파일
   - 이 파일만 수정하면 게임 구성과 Firebase 연결을 바꿀 수 있습니다.
   ========================================================= */
window.GAME_CONFIG = {
  /* 관리자 화면에서 설정한 값이 없을 때 쓰이는 기본 미리보기 시간(초) */
  defaultPreviewSeconds: 5,

  /* 한 판에 쓰는 인물 수 (= 카드 32장) */
  cardsPerRound: 16,

  /* 분류 이름 (관리자 화면·보고서 표기용) */
  groups: {
    actor: '영화배우',
    comedy: '개그맨·방송인',
    president: '역대 대통령',
    global: '글로벌·재계'
  },

  /* =======================================================
     인물 후보 풀 — 매 판 이 중에서 무작위로 16명을 뽑습니다.
     사진: images/celeb_NN.jpg (NN = id)
     ======================================================= */
  celebrities: [
    /* ---------- 영화배우 (15) ---------- */
    { id: 1,  name: '송강호',  group: 'actor' },
    { id: 2,  name: '마동석',  group: 'actor' },
    { id: 3,  name: '황정민',  group: 'actor' },
    { id: 4,  name: '최민식',  group: 'actor' },
    { id: 5,  name: '이병헌',  group: 'actor' },
    { id: 6,  name: '유해진',  group: 'actor' },
    { id: 7,  name: '하정우',  group: 'actor' },
    { id: 8,  name: '공유',    group: 'actor' },
    { id: 17, name: '이정재',  group: 'actor' },
    { id: 18, name: '정우성',  group: 'actor' },
    { id: 19, name: '설경구',  group: 'actor' },
    { id: 20, name: '김윤석',  group: 'actor' },
    { id: 21, name: '김혜수',  group: 'actor' },
    { id: 22, name: '손예진',  group: 'actor' },
    { id: 23, name: '전도연',  group: 'actor' },

    /* ---------- 개그맨 · 방송인 (10) ---------- */
    { id: 9,  name: '유재석',  group: 'comedy' },
    { id: 10, name: '강호동',  group: 'comedy' },
    { id: 11, name: '신동엽',  group: 'comedy' },
    { id: 12, name: '박명수',  group: 'comedy' },
    { id: 13, name: '이수근',  group: 'comedy' },
    { id: 14, name: '장도연',  group: 'comedy' },
    { id: 15, name: '조세호',  group: 'comedy' },
    { id: 16, name: '김준현',  group: 'comedy' },
    { id: 24, name: '박나래',  group: 'comedy' },
    { id: 25, name: '이경규',  group: 'comedy' },

    /* ---------- 역대 대통령 (8) ---------- */
    { id: 26, name: '이승만',  group: 'president' },
    { id: 27, name: '박정희',  group: 'president' },
    { id: 28, name: '김영삼',  group: 'president' },
    { id: 29, name: '김대중',  group: 'president' },
    { id: 30, name: '노무현',  group: 'president' },
    { id: 31, name: '이명박',  group: 'president' },
    { id: 32, name: '박근혜',  group: 'president' },
    { id: 33, name: '문재인',  group: 'president' },

    /* ---------- 글로벌 · 재계 (3) ---------- */
    { id: 34, name: '이재용',  group: 'global' },
    { id: 35, name: '트럼프',  group: 'global' },
    { id: 36, name: '젠슨 황', group: 'global' }
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
