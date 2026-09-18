// 모모타로 교사 대시보드를 Node 모의 객체로 돌려 본다.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const 뿌리 = __dirname;
let 실패 = 0;
const 확인 = (설명, 조건) => {
  console.log((조건 ? "  ✓ " : "  ✗ ") + 설명);
  if (!조건) 실패++;
};

const gas = fs.readFileSync(path.join(뿌리, "교사대시보드_Code.gs"), "utf8");

const 때 = (일, 시, 분) => new Date(2026, 8, 일, 시, 분 || 0, 0);

// 아영: 단어 → 문장으로 늘어남     민수: 계속 단어만
// 지호: 처음엔 길다가 짧아짐        세리: 두 번만 해 봄
const 제목줄 = ["기록시각", "학번", "이름", "학생이 말한 내용", "ももたろう 응답"];
const ㅈ = (일, 시, 분, 학번, 이름, 말) => [때(일, 시, 분), 학번, 이름, 말, "…"];
const 기본줄들 = [
  제목줄,
  ㅈ(1, 9, 0, "20101", "아영", "はい"),
  ㅈ(1, 9, 2, "20101", "아영", "そうです"),
  ㅈ(3, 9, 0, "20101", "아영", "わたしは おしょうがつが すきです"),
  ㅈ(3, 9, 5, "20101", "아영", "かぞくと いっしょに たべます"),

  ㅈ(1, 9, 0, "20102", "민수", "はい"),
  ㅈ(1, 9, 3, "20102", "민수", "うん"),
  ㅈ(3, 9, 0, "20102", "민수", "すき"),
  ㅈ(3, 9, 4, "20102", "민수", "はい"),

  ㅈ(1, 9, 0, "20103", "지호", "わたしは せつぶんが すきです"),
  ㅈ(1, 9, 3, "20103", "지호", "まめを まきます たのしいです"),
  ㅈ(3, 9, 0, "20103", "지호", "はい"),
  ㅈ(3, 9, 2, "20103", "지호", "そう"),

  ㅈ(1, 9, 0, "20104", "세리", "こんにちは"),
  ㅈ(1, 9, 1, "20104", "세리", "はい"),

  [때(4, 9, 0), "", "", "", ""],          // 빈 줄
];

function 상자(줄들, 비밀번호, 틀린횟수) {
  const 저장 = { 교사_틀린횟수: 틀린횟수 == null ? null : String(틀린횟수) };
  const s = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (이름) =>
          줄들 && 이름 === "기록" ? { getDataRange: () => ({ getValues: () => 줄들 }) } : null,
        getSheets: () => (줄들 ? [{ getDataRange: () => ({ getValues: () => 줄들 }) }] : []),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (ㅋ) => (ㅋ === "교사비밀번호" ? 비밀번호 : null) }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (ㅋ) => 저장[ㅋ] || null,
        put: (ㅋ, ㄱ) => { 저장[ㅋ] = ㄱ; },
        remove: (ㅋ) => { delete 저장[ㅋ]; },
      }),
    },
    Utilities: {
      sleep: () => {},
      formatDate: (ㄷ, _, 틀) => {
        const 날 = ㄷ.getFullYear() + "-" + String(ㄷ.getMonth() + 1).padStart(2, "0") + "-" +
                   String(ㄷ.getDate()).padStart(2, "0");
        return 틀.indexOf("HH") === -1 ? 날
          : 날 + " " + String(ㄷ.getHours()).padStart(2, "0") + ":" + String(ㄷ.getMinutes()).padStart(2, "0");
      },
    },
    Session: { getScriptTimeZone: () => "Asia/Seoul" },
    HtmlService: {
      createHtmlOutputFromFile: (이름) => ({ _파일: 이름, setTitle() { return this; }, addMetaTag() { return this; } }),
    },
    ContentService: {
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this; } }),
      MimeType: { JSON: "json" },
    },
    Object, Math, Number, String, Date, isFinite, isNaN, JSON, console, Error,
    저장,
  };
  vm.createContext(s);
  vm.runInContext(gas, s);
  return s;
}

console.log("모모타로 대시보드 — 자물쇠");

let s = 상자(기본줄들, "바른번호");
let 답 = vm.runInContext('대시보드자료("틀린번호")', s);
확인("틀리면 ok:false", 답.ok === false);
확인("틀렸을 때 자료가 없다", 답.자료 === undefined);
확인("틀린 답에 학생 이름·대화가 섞이지 않는다",
  JSON.stringify(답).indexOf("아영") === -1 && JSON.stringify(답).indexOf("おしょうがつ") === -1);
확인("빈 비밀번호도 막는다", vm.runInContext('대시보드자료("")', s).ok === false);

s = 상자(기본줄들, "바른번호", 8);
let 터짐 = false;
try { vm.runInContext('대시보드자료("바른번호")', s); } catch (e) { 터짐 = true; }
확인("여러 번 틀리면 잠깐 막는다", 터짐);

s = 상자(기본줄들, null);
터짐 = false;
try { vm.runInContext('대시보드자료("x")', s); } catch (e) { 터짐 = /비밀번호가 설정/.test(e.message); }
확인("비밀번호 미설정이면 알려 준다", 터짐);

console.log("모모타로 대시보드 — 학생별 성장 (발화 길이)");

s = 상자(기본줄들, "바른번호");
답 = vm.runInContext('대시보드자료("바른번호")', s);
확인("바른 비밀번호면 열린다", 답.ok === true);

const 자료 = 답.자료;
const 찾기 = (이름) => 자료.학생들.filter((ㅅ) => ㅅ.이름 === 이름)[0];
확인("빈 줄은 학생으로 세지 않는다", 자료.학생들.length === 4);
확인("학생 말 칸을 찾았다", 자료.말칸있나 === true);

const 아영 = 찾기("아영");
// 1일: はい(2) そうです(4) → 평균 3 / 3일: 16글자, 12글자 → 평균 14
확인("아영 — 처음 3글자 → 최근 14글자", 아영.처음길이 === 3 && 아영.최근길이 === 14);
확인("아영 — 성장 +11", 아영.성장 === 11);
확인("아영 — 대화 4번, 2일", 아영.말수 === 4 && 아영.날수 === 2);
// わたしは(4) おしょうがつが(7) すきです(4) = 공백 빼고 15글자
확인("아영 — 가장 길게 말한 것 15글자", 아영.가장긴말 === 15);

const 지호 = 찾기("지호");
확인("지호 — 말이 짧아졌다 (성장 음수)", 지호.성장 < 0);

console.log("모모타로 대시보드 — 먼저 볼 학생");

const 짚 = 자료.짚을학생.map((ㅅ) => ㅅ.이름);
확인("아영은 올라오지 않는다", 짚.indexOf("아영") === -1);
확인("민수가 올라온다 (단어만 말함)", 짚.indexOf("민수") !== -1);
확인("지호가 올라온다 (짧아짐)", 짚.indexOf("지호") !== -1);
확인("세리가 올라온다 (2번만 함)", 짚.indexOf("세리") !== -1);
확인("가장 급한 학생이 맨 위", 자료.짚을학생[0].급함 >= 자료.짚을학생[자료.짚을학생.length - 1].급함);

const 민수 = 찾기("민수");
확인("민수 — 까닭에 '단어만' 이 적힌다",
  민수.까닭들.some((ㄱ) => ㄱ.indexOf("단어만") !== -1));
확인("세리 — 까닭에 '밖에' 가 적힌다",
  찾기("세리").까닭들.some((ㄱ) => ㄱ.indexOf("밖에") !== -1));
확인("지호 — 까닭에 '짧아졌' 이 적힌다",
  지호.까닭들.some((ㄱ) => ㄱ.indexOf("짧아졌") !== -1));

console.log("모모타로 대시보드 — 날짜별 참여");

// 9/1 에 4명이 8번, 9/3 에 4명이 6번 주고받았다 (빈 줄 제외)
const 날들 = 자료.날짜들;
확인("날짜가 2개", 날들.length === 2);
확인("날짜가 오름차순", 날들[0].날 < 날들[1].날);
확인("9/1 — 4명", 날들[0].학생수 === 4);
확인("9/1 — 8번", 날들[0].말수 === 8);
확인("9/3 — 3명", 날들[1].학생수 === 3);
확인("날짜별 말수 합이 전체 말수와 같다",
  날들.reduce((ㄱ, ㄴ) => ㄱ + ㄴ.말수, 0) === 자료.전체.말수);

console.log("모모타로 대시보드 — 반");

확인("학번에서 반을 읽는다", 아영.반 === "1" && 아영.학년 === "2" && 아영.번호 === "1");
확인("반이 하나라 반 목록도 하나", 자료.반들.length === 1 && 자료.반들[0].반 === "1");
확인("반 요약 — 학생 4명", 자료.반들[0].학생수 === 4);
확인("반 요약 — 대화 수가 전체와 같다", 자료.반들[0].말수 === 자료.전체.말수);
확인("반 요약 — 먼저 볼 학생 수", 자료.반들[0].짚을사람 === 자료.짚을학생.length);

{
  const 이상한줄 = [제목줄, ㅈ(1, 9, 0, "99", "홍길동", "はい")];
  const g2 = 상자(이상한줄, "바른번호");
  const ㅈ2 = vm.runInContext('대시보드자료("바른번호")', g2).자료;
  확인("학번이 이상하면 반을 '?' 로 두고 계속 돈다",
    ㅈ2.학생들[0].반 === "?" && ㅈ2.반들[0].반 === "?");
}

console.log("모모타로 대시보드 — 버티기");

// 칸 이름이 달라도
const 다른제목 = [["일시", "번호", "성명", "발화", "답"]].concat(기본줄들.slice(1));
s = 상자(다른제목, "바른번호");
자료2 = vm.runInContext('대시보드자료("바른번호")', s).자료;
확인("칸 제목이 달라도 찾는다", 자료2.학생들.length === 4 && 자료2.말칸있나 === true);

// 학생 말 칸이 아예 없어도
const 말없음 = [["일시", "번호", "성명"]].concat(기본줄들.slice(1).map((ㄹ) => ㄹ.slice(0, 3)));
s = 상자(말없음, "바른번호");
const 자료3 = vm.runInContext('대시보드자료("바른번호")', s).자료;
확인("말 칸이 없어도 안 터지고 횟수는 센다",
  자료3.학생들.length === 4 && 자료3.말칸있나 === false && 찾기2(자료3, "아영").말수 === 4);

s = 상자(null, "바른번호");
확인("기록 시트가 없어도 안 터진다",
  vm.runInContext('대시보드자료("바른번호")', s).자료.학생들.length === 0);

console.log("모모타로 대시보드 — doGet 길 찾기");

s = 상자(기본줄들, "바른번호");
확인("?화면=교사 는 교사 화면", vm.runInContext("doGet({parameter:{화면:'교사'}})", s)._파일 === "교사");
확인("?action=teacher 도 된다", vm.runInContext("doGet({parameter:{action:'teacher'}})", s)._파일 === "교사");
확인("그냥 열면 살아있다는 표시만",
  JSON.parse(vm.runInContext("doGet({parameter:{}})", s)._t).ok === true);
확인("인자 없이 불러도 안 터진다", JSON.parse(vm.runInContext("doGet()", s)._t).ok === true);
확인("교사 화면 자체에 학생 자료가 없다",
  vm.runInContext("doGet({parameter:{화면:'교사'}})", s)._t === undefined);

function 찾기2(자료, 이름) { return 자료.학생들.filter((ㅅ) => ㅅ.이름 === 이름)[0]; }

console.log(실패 === 0 ? "\n전부 통과" : "\n실패 " + 실패 + "건");
process.exit(실패 === 0 ? 0 : 1);
