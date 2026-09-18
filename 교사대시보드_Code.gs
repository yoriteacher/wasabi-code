/* ============================================================
   ももたろう — 교사용 대시보드 (선생님만 봅니다)

   ■ 무엇을 보나
     이 앱에는 점수가 없습니다. 그래서 '얼마나 늘었나'를 이렇게 봅니다.
       · 대화를 몇 번 주고받았나
       · 며칠에 걸쳐 했나
       · 한 번 말할 때 얼마나 길게 말하나  ← 여기가 성장입니다
         (처음 하던 날의 평균 길이 → 마지막 날의 평균 길이)
     처음엔 「はい」「そうです」만 하던 학생이 문장으로 말하기 시작하면
     이 숫자가 올라갑니다.

   ■ 붙이는 법
     1) 이 파일의 함수들을 기존 Apps Script 맨 아래에 덧붙입니다.
        이 앱에는 지금 doGet 이 없으므로 그대로 붙이면 됩니다.
     2) 파일 + → HTML → 이름을 '교사' 로 만들고 교사.html 내용을 붙여넣습니다.
     3) 비밀번호를 정합니다 — 코드에 적지 않습니다:
          프로젝트 설정(⚙) → 스크립트 속성 → 속성 추가
          속성 이름: 교사비밀번호      값: 선생님만 아는 번호
        ※ 학생들이 쓰는 '교사 인증번호'와 다른 것으로 하세요.
          그건 학생이 알고 있으니 대시보드 열쇠로 쓰면 안 됩니다.
     4) 배포 → 배포 관리 → (연필) → 새 버전 → 배포   (주소 그대로)

   ■ 여는 주소
     기존 /exec 주소 뒤에 ?화면=교사 를 붙입니다.

   ■ 칸 이름이 달라도 됩니다
     제목 줄을 읽어 학번·이름·시각·학생 말 칸을 찾습니다.
     못 찾으면 그 부분만 비워 두고 나머지는 보여 줍니다.
   ============================================================ */

var 기록시트이름 = '기록';       // 기록이 쌓이는 탭 이름. 다르면 여기만 고치세요.


/** 브라우저가 GET 으로 부를 때 */
function doGet(e) {
  var 화면 = (e && e.parameter && e.parameter.화면) || '';
  var 무엇 = (e && e.parameter && e.parameter.action) || '';

  if (화면 === '교사' || 무엇 === 'teacher') {
    return HtmlService.createHtmlOutputFromFile('교사')
      .setTitle('ももたろう — 선생님 화면')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'ももたろう 서버 작동 중' }))
    .setMimeType(ContentService.MimeType.JSON);
}


/** 화면에서 비밀번호와 함께 부릅니다. 맞을 때만 자료를 돌려줍니다. */
function 대시보드자료(비밀번호) {
  if (!교사비번확인_(비밀번호)) {
    return { ok: false, 까닭: '비밀번호가 맞지 않습니다.' };
  }
  return { ok: true, 자료: 학생별활동() };
}


function 교사비번확인_(입력) {
  var 정답 = PropertiesService.getScriptProperties().getProperty('교사비밀번호');
  if (!정답) throw new Error(
    '아직 비밀번호가 설정되지 않았습니다. 프로젝트 설정 → 스크립트 속성에서 ' +
    '교사비밀번호 를 추가해 주세요.');

  var 창고 = CacheService.getScriptCache();
  var 틀린횟수 = Number(창고.get('교사_틀린횟수') || 0);
  if (틀린횟수 >= 8) throw new Error('여러 번 틀렸습니다. 10분 뒤에 다시 해 주세요.');

  if (!같은글자_(String(입력 || ''), String(정답))) {
    창고.put('교사_틀린횟수', String(틀린횟수 + 1), 600);
    Utilities.sleep(700);
    return false;
  }
  창고.remove('교사_틀린횟수');
  return true;
}


function 같은글자_(가, 나) {
  if (가.length !== 나.length) return false;
  var 다름 = 0;
  for (var i = 0; i < 가.length; i++) 다름 |= 가.charCodeAt(i) ^ 나.charCodeAt(i);
  return 다름 === 0;
}


/**
 * 학번에서 학년·반·번호를 읽습니다.
 * 학번은 20709 처럼 다섯 자리 = 학년(1) + 반(2) + 번호(2) 입니다.
 * 형식이 다르면 반을 '?' 로 두고 나머지는 그대로 돌아갑니다.
 */
function 학번풀기_(학번) {
  var ㅅ = String(학번 || '').trim();
  if (!/^\d{5}$/.test(ㅅ)) return { 학년: '', 반: '?', 번호: '' };
  return {
    학년: ㅅ.charAt(0),
    반: String(Number(ㅅ.substring(1, 3))),
    번호: String(Number(ㅅ.substring(3, 5)))
  };
}


/**
 * '반배정' 탭에서 학번 → 수업 반 을 읽습니다.
 *
 * 201·207 같은 선택과목 합반은 여러 담임반 학생이 한 수업에 모입니다.
 * 학번으로 반을 읽으면 한 수업이 담임반 수만큼 조각나므로,
 * 출석부대로 묶으려면 이 표가 있어야 합니다.
 *
 * 탭 모양 (첫 줄은 제목)
 *   학번   | 수업반
 *   20105  | 201
 *
 * 탭이 없으면 학번에서 읽은 담임반을 그대로 씁니다.
 */
function 수업반읽기_() {
  var 시트 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('반배정');
  if (!시트) return null;

  var 값 = 시트.getDataRange().getValues();
  if (값.length < 2) return null;

  var 제목 = 값[0].map(function (c) { return String(c || '').trim(); });
  var 학번칸 = 칸찾기_(제목, ['학번'], 0);
  var 반칸 = 칸찾기_(제목, ['수업반', '반'], 1);

  var 표 = {};
  for (var i = 1; i < 값.length; i++) {
    var 학번 = String(값[i][학번칸] || '').trim();
    var 반 = String(값[i][반칸] || '').trim();
    if (학번 && 반) 표[학번] = 반;
  }
  return 표;
}


/** 반 이름 차례. 숫자면 숫자 순, '?' 는 맨 뒤. */
function 반차례_(가, 나) {
  if (가 === '?') return 1;
  if (나 === '?') return -1;
  var ㄱ = Number(가), ㄴ = Number(나);
  if (isFinite(ㄱ) && isFinite(ㄴ)) return ㄱ - ㄴ;
  return String(가) < String(나) ? -1 : 1;
}


function 칸찾기_(제목, 열쇠말들, 기본) {
  for (var i = 0; i < 제목.length; i++) {
    for (var k = 0; k < 열쇠말들.length; k++) {
      if (제목[i].indexOf(열쇠말들[k]) !== -1) return i;
    }
  }
  return 기본;
}


/** 기록을 학생별로 묶습니다. */
function 학생별활동() {
  var 문서 = SpreadsheetApp.getActiveSpreadsheet();
  var 시트 = 문서.getSheetByName(기록시트이름) || 문서.getSheets()[0];
  if (!시트) return 빈자료_();

  var 값 = 시트.getDataRange().getValues();
  if (값.length < 2) return 빈자료_();

  var 제목 = 값[0].map(function (c) { return String(c || '').trim(); });
  var ㄱ = {
    때:   칸찾기_(제목, ['시각', '일시', '시간', '날짜'], 0),
    학번: 칸찾기_(제목, ['학번', '번호'], 1),
    이름: 칸찾기_(제목, ['이름', '성명'], 2),
    말:   칸찾기_(제목, ['학생', '발화', '말한', '내용'], -1)
  };

  var 사람 = {};
  for (var i = 1; i < 값.length; i++) {
    var 줄 = 값[i];
    var 학번 = String(줄[ㄱ.학번] || '').trim();
    var 이름 = String(줄[ㄱ.이름] || '').trim();
    if (!학번 && !이름) continue;

    var 열쇠 = 학번 + '·' + 이름;
    if (!사람[열쇠]) 사람[열쇠] = { 학번: 학번, 이름: 이름, 기록: [] };

    var 말 = (ㄱ.말 >= 0) ? String(줄[ㄱ.말] || '').trim() : '';
    사람[열쇠].기록.push({
      때: 때숫자_(줄[ㄱ.때]),
      날: 날짜글자_(줄[ㄱ.때]),
      때글: 때글자_(줄[ㄱ.때]),
      말: 말,
      길이: 글자수_(말)
    });
  }

  var 수업반표 = 수업반읽기_();      // 없으면 null → 담임반을 씁니다

  var 학생들 = [];
  var 날모음 = {};        // 날짜 → { 학생: 이름들, 말수 }

  Object.keys(사람).forEach(function (열쇠) {
    var ㅅ = 사람[열쇠];
    ㅅ.기록.sort(function (가, 나) { return 가.때 - 나.때; });

    var 날들 = 날짜별_(ㅅ.기록);

    // 날짜별 참여는 여기서 모읍니다.
    // (학생마다 마지막 날만 보면 모든 대화가 그 하루에 몰려 버립니다)
    날들.forEach(function (ㄴ) {
      if (!ㄴ.날) return;
      if (!날모음[ㄴ.날]) 날모음[ㄴ.날] = { 날: ㄴ.날, 학생수: 0, 말수: 0 };
      날모음[ㄴ.날].학생수 += 1;
      날모음[ㄴ.날].말수 += ㄴ.말수;
    });
    var 말있음 = ㅅ.기록.filter(function (ㄱ) { return ㄱ.길이 > 0; });
    var 평균길이 = 말있음.length
      ? 반올림_(말있음.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ.길이; }, 0) / 말있음.length)
      : 0;

    // 성장 = 첫날 평균 발화 길이 → 마지막날 평균 발화 길이
    var 처음길이 = 날들.length ? 날들[0].평균길이 : 0;
    var 최근길이 = 날들.length ? 날들[날들.length - 1].평균길이 : 0;

    var 갈래 = 학번풀기_(ㅅ.학번);
    var 수업반 = (수업반표 && 수업반표[ㅅ.학번]) || '';
    var 한명 = {
      학번: ㅅ.학번,
      이름: ㅅ.이름,
      학년: 갈래.학년,
      반: 수업반 || 갈래.반,        // 출석부 배정이 있으면 그것이 먼저
      담임반: 갈래.반,
      합반: !!수업반,
      번호: 갈래.번호,
      말수: ㅅ.기록.length,
      날수: 날들.length,
      평균길이: 평균길이,
      처음길이: 처음길이,
      최근길이: 최근길이,
      성장: 반올림_(최근길이 - 처음길이),
      가장긴말: 말있음.length ? Math.max.apply(null, 말있음.map(function (ㄱ) { return ㄱ.길이; })) : 0,
      자취: 날들.map(function (ㄴ) { return ㄴ.평균길이; }).slice(-12),
      마지막날: ㅅ.기록[ㅅ.기록.length - 1].때글,
      말있나: 말있음.length > 0
    };
    짚어줄까닭_(한명);
    학생들.push(한명);
  });

  학생들.sort(function (가, 나) { return 가.말수 - 나.말수; });

  var 짚을학생 = 학생들.filter(function (ㅅ) { return ㅅ.급함 > 0; })
    .slice()
    .sort(function (가, 나) {
      if (가.급함 !== 나.급함) return 나.급함 - 가.급함;
      return 가.말수 - 나.말수;
    });

  var 날짜들 = Object.keys(날모음).sort().map(function (ㄴ) { return 날모음[ㄴ]; });

  return {
    학생들: 학생들,
    짚을학생: 짚을학생,
    날짜들: 날짜들,
    반들: 반별요약_(학생들),
    수업반씀: !!수업반표,
    전체: 전체요약_(학생들),
    말칸있나: ㄱ.말 >= 0
  };
}


/** 하루 단위로 묶어 그날 평균 발화 길이를 냅니다. */
function 날짜별_(기록) {
  var 묶음 = {};
  var 차례 = [];
  기록.forEach(function (ㄱ) {
    var 날 = ㄱ.날 || '(날짜 없음)';
    if (!묶음[날]) { 묶음[날] = []; 차례.push(날); }
    묶음[날].push(ㄱ);
  });
  return 차례.map(function (날) {
    var 그날 = 묶음[날];
    var 말있음 = 그날.filter(function (ㄱ) { return ㄱ.길이 > 0; });
    return {
      날: 날,
      말수: 그날.length,
      평균길이: 말있음.length
        ? 반올림_(말있음.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ.길이; }, 0) / 말있음.length)
        : 0
    };
  });
}


/** 왜 이 학생을 따로 봐야 하는지 */
function 짚어줄까닭_(ㅅ) {
  var 까닭 = [];
  var 급함 = 0;

  if (ㅅ.말수 <= 2) {
    까닭.push('대화를 ' + ㅅ.말수 + '번밖에 안 했습니다');
    급함 = Math.max(급함, 3);
  }
  if (ㅅ.말있나 && ㅅ.평균길이 > 0 && ㅅ.평균길이 < 8) {
    까닭.push('한 번에 평균 ' + ㅅ.평균길이 + '글자로, 단어만 말하고 있습니다');
    급함 = Math.max(급함, 3);
  }
  if (ㅅ.말있나 && ㅅ.성장 <= -3 && ㅅ.날수 >= 2) {
    까닭.push('처음보다 말이 짧아졌습니다 (' + ㅅ.처음길이 + ' → ' + ㅅ.최근길이 + '글자)');
    급함 = Math.max(급함, 2);
  }
  if (까닭.length === 0 && ㅅ.날수 === 1 && ㅅ.말수 >= 3) {
    까닭.push('하루만 해 봤습니다. 이어서 하도록 권해 주세요');
    급함 = Math.max(급함, 1);
  }

  ㅅ.까닭들 = 까닭;
  ㅅ.급함 = 급함;
}


function 전체요약_(학생들) {
  if (!학생들.length) return { 학생수: 0, 말수: 0, 평균길이: 0, 평균성장: 0, 는사람: 0, 준사람: 0 };
  var 성장들 = 학생들.map(function (ㅅ) { return ㅅ.성장; });
  var 길이들 = 학생들.filter(function (ㅅ) { return ㅅ.평균길이 > 0; }).map(function (ㅅ) { return ㅅ.평균길이; });
  return {
    학생수: 학생들.length,
    말수: 학생들.reduce(function (ㄱ, ㅅ) { return ㄱ + ㅅ.말수; }, 0),
    평균길이: 길이들.length ? 반올림_(길이들.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ; }, 0) / 길이들.length) : 0,
    평균성장: 반올림_(성장들.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ; }, 0) / 성장들.length),
    는사람: 성장들.filter(function (ㄱ) { return ㄱ > 0; }).length,
    준사람: 성장들.filter(function (ㄱ) { return ㄱ < 0; }).length
  };
}

/** 반별로 묶어 견줍니다. */
function 반별요약_(학생들) {
  var 묶음 = {};
  학생들.forEach(function (ㅅ) {
    if (!묶음[ㅅ.반]) 묶음[ㅅ.반] = [];
    묶음[ㅅ.반].push(ㅅ);
  });

  return Object.keys(묶음).sort(반차례_).map(function (반) {
    var 들 = 묶음[반];
    var 길이들 = 들.filter(function (ㅅ) { return ㅅ.평균길이 > 0; }).map(function (ㅅ) { return ㅅ.평균길이; });
    var 성장들 = 들.map(function (ㅅ) { return ㅅ.성장; });
    return {
      반: 반,
      학생수: 들.length,
      말수: 들.reduce(function (ㄱ, ㅅ) { return ㄱ + ㅅ.말수; }, 0),
      평균길이: 길이들.length ? 반올림_(길이들.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ; }, 0) / 길이들.length) : 0,
      평균성장: 반올림_(성장들.reduce(function (ㄱ, ㄴ) { return ㄱ + ㄴ; }, 0) / 들.length),
      짚을사람: 들.filter(function (ㅅ) { return ㅅ.급함 > 0; }).length
    };
  });
}


function 빈자료_() {
  return { 학생들: [], 짚을학생: [], 날짜들: [], 반들: [], 전체: 전체요약_([]), 말칸있나: false };
}

/** 일본어는 한 글자가 한 낱말 몫을 하므로 글자 수로 셉니다. 공백은 뺍니다. */
function 글자수_(말) {
  return String(말 || '').replace(/\s+/g, '').length;
}

function 때숫자_(값) {
  if (값 instanceof Date) return 값.getTime();
  var ㄷ = new Date(값);
  return isNaN(ㄷ.getTime()) ? 0 : ㄷ.getTime();
}

function 날짜글자_(값) {
  var ㄷ = (값 instanceof Date) ? 값 : new Date(값);
  if (isNaN(ㄷ.getTime())) return '';
  return Utilities.formatDate(ㄷ, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function 때글자_(값) {
  var ㄷ = (값 instanceof Date) ? 값 : new Date(값);
  if (isNaN(ㄷ.getTime())) return String(값 || '');
  return Utilities.formatDate(ㄷ, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function 반올림_(숫자) {
  return Math.round(숫자 * 10) / 10;
}
