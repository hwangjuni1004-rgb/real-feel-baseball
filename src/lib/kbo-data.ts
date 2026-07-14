// KBO 10개 구단 실제 선수 기반 데이터 (2024-2025 시즌 참고, 간소화)
// 각 팀 라인업 9명(포지션 정확) + 투수 3명

export type Position = "P" | "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "DH";

export interface Batter {
  name: string;
  pos: Position;
  bats: "L" | "R" | "S";
  power: number; // 1-10
  contact: number; // 1-10
  speed?: number; // 1-10 (도루/주루 능력)
}

export interface PitchType {
  name: string;
  speedMin: number;
  speedMax: number;
  break: { x: number; y: number }; // 존 이동
}

export interface Pitcher {
  name: string;
  throws: "L" | "R";
  velo: number; // 최고 구속
  control: number; // 1-10
  pitches: PitchType[];
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  accent: string;
  lineup: Batter[];
  rotation: Pitcher[];
}

// 구속 편차 확대: 같은 투수 안에서도 구종별 격차 크게
// break.x, break.y = 그리드 셀 단위 이동. x 부호: 우투 기준 (좌투는 mirror됨)
// 우투: 슬라이더/커브 좌측(-x), 체인지업/투심 우측(+x). 좌투는 반대로.
const FB = (v: number): PitchType => ({ name: "포심 패스트볼", speedMin: v - 3, speedMax: v, break: { x: 0, y: -0.2 } });
const TB = (v: number): PitchType => ({ name: "투심", speedMin: v - 7, speedMax: v - 1, break: { x: 1.0, y: 0.9 } });
const SL = (v: number): PitchType => ({ name: "슬라이더", speedMin: v - 14, speedMax: v - 5, break: { x: -1.9, y: 0.9 } });
const CB = (v: number): PitchType => ({ name: "커브", speedMin: v - 26, speedMax: v - 13, break: { x: -1.2, y: 2.6 } });
const CH = (v: number): PitchType => ({ name: "체인지업", speedMin: v - 17, speedMax: v - 7, break: { x: 0.9, y: 1.7 } });
const FK = (v: number): PitchType => ({ name: "포크볼", speedMin: v - 19, speedMax: v - 8, break: { x: 0, y: 2.8 } });

export const TEAMS: Team[] = [
  {
    id: "kia", name: "KIA 타이거즈", short: "KIA", color: "#EA0029", accent: "#06141F",
    lineup: [
      { name: "박찬호", pos: "SS", bats: "R", power: 4, contact: 8 },
      { name: "김도영", pos: "3B", bats: "R", power: 9, contact: 9 },
      { name: "최형우", pos: "DH", bats: "L", power: 9, contact: 8 },
      { name: "나성범", pos: "RF", bats: "L", power: 9, contact: 7 },
      { name: "소크라테스", pos: "CF", bats: "L", power: 8, contact: 8 },
      { name: "김선빈", pos: "2B", bats: "L", power: 4, contact: 8 },
      { name: "변우혁", pos: "1B", bats: "R", power: 8, contact: 5 },
      { name: "김태군", pos: "C", bats: "R", power: 5, contact: 6 },
      { name: "이우성", pos: "LF", bats: "R", power: 6, contact: 6 },
    ],
    rotation: [
      { name: "양현종", throws: "L", velo: 148, control: 9, pitches: [FB(148), SL(148), CH(148), CB(148)] },
      { name: "네일", throws: "R", velo: 152, control: 8, pitches: [FB(152), TB(152), SL(152), CH(152)] },
      { name: "이의리", throws: "L", velo: 150, control: 7, pitches: [FB(150), SL(150), CH(150)] },
      { name: "정해영", throws: "R", velo: 149, control: 8, pitches: [FB(149), SL(149), FK(149)] },
      { name: "곽도규", throws: "L", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "장현식", throws: "R", velo: 149, control: 7, pitches: [FB(149), SL(149), FK(149)] },
      { name: "전상현", throws: "R", velo: 147, control: 8, pitches: [FB(147), SL(147), CH(147)] },
    ],
  },
  {
    id: "samsung", name: "삼성 라이온즈", short: "SS", color: "#074CA1", accent: "#C0C0C0",
    lineup: [
      { name: "김지찬", pos: "CF", bats: "S", power: 3, contact: 8 },
      { name: "구자욱", pos: "LF", bats: "L", power: 8, contact: 9 },
      { name: "박병호", pos: "1B", bats: "R", power: 9, contact: 6 },
      { name: "김영웅", pos: "3B", bats: "L", power: 8, contact: 6 },
      { name: "디아즈", pos: "DH", bats: "R", power: 9, contact: 7 },
      { name: "이재현", pos: "SS", bats: "R", power: 6, contact: 6 },
      { name: "강민호", pos: "C", bats: "R", power: 7, contact: 7 },
      { name: "김헌곤", pos: "RF", bats: "R", power: 5, contact: 6 },
      { name: "류지혁", pos: "2B", bats: "L", power: 4, contact: 7 },
    ],
    rotation: [
      { name: "원태인", throws: "R", velo: 150, control: 9, pitches: [FB(150), SL(150), CH(150), CB(150)] },
      { name: "레예스", throws: "R", velo: 153, control: 8, pitches: [FB(153), TB(153), SL(153), FK(153)] },
      { name: "코너", throws: "L", velo: 149, control: 7, pitches: [FB(149), SL(149), CH(149)] },
      { name: "김재윤", throws: "R", velo: 150, control: 8, pitches: [FB(150), SL(150), FK(150)] },
      { name: "임창민", throws: "R", velo: 146, control: 8, pitches: [FB(146), SL(146), CH(146)] },
      { name: "이승현", throws: "L", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "황동재", throws: "R", velo: 147, control: 7, pitches: [FB(147), SL(147), CB(147)] },
    ],
  },
  {
    id: "lg", name: "LG 트윈스", short: "LG", color: "#C30452", accent: "#000000",
    lineup: [
      { name: "홍창기", pos: "RF", bats: "L", power: 5, contact: 9 },
      { name: "신민재", pos: "2B", bats: "L", power: 3, contact: 7 },
      { name: "오스틴", pos: "1B", bats: "R", power: 9, contact: 8 },
      { name: "김현수", pos: "DH", bats: "L", power: 7, contact: 9 },
      { name: "문보경", pos: "3B", bats: "L", power: 7, contact: 7 },
      { name: "박해민", pos: "CF", bats: "L", power: 4, contact: 7 },
      { name: "박동원", pos: "C", bats: "R", power: 8, contact: 6 },
      { name: "문성주", pos: "LF", bats: "L", power: 5, contact: 7 },
      { name: "오지환", pos: "SS", bats: "L", power: 7, contact: 6 },
    ],
    rotation: [
      { name: "임찬규", throws: "R", velo: 146, control: 8, pitches: [FB(146), SL(146), CH(146), CB(146)] },
      { name: "톨허스트", throws: "R", velo: 152, control: 8, pitches: [FB(152), SL(152), CH(152), CB(152)] },
      { name: "웰스", throws: "R", velo: 150, control: 8, pitches: [FB(150), TB(150), SL(150), CH(150)] },
      { name: "리오스", throws: "R", velo: 162, control: 7, pitches: [FB(162), SL(162), CH(162), FK(162)] },
      { name: "김영우", throws: "R", velo: 156, control: 7, pitches: [FB(156), SL(156), FK(156)] },
      { name: "엘리아스", throws: "L", velo: 151, control: 8, pitches: [FB(151), SL(151), CH(151), CB(151)] },
      { name: "손주영", throws: "L", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "최원태", throws: "R", velo: 148, control: 8, pitches: [FB(148), SL(148), CH(148)] },
      { name: "치리노스", throws: "R", velo: 150, control: 8, pitches: [FB(150), TB(150), SL(150), CH(150)] },
      { name: "송승기", throws: "L", velo: 146, control: 7, pitches: [FB(146), SL(146), CH(146)] },
      { name: "김윤식", throws: "L", velo: 147, control: 7, pitches: [FB(147), SL(147), CB(147)] },
      { name: "이지강", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "유영찬", throws: "R", velo: 151, control: 8, pitches: [FB(151), SL(151), FK(151)] },
      { name: "김진성", throws: "R", velo: 147, control: 8, pitches: [FB(147), SL(147), FK(147)] },
      { name: "함덕주", throws: "L", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "정우영", throws: "R", velo: 152, control: 7, pitches: [FB(152), TB(152), SL(152)] },
      { name: "박명근", throws: "R", velo: 150, control: 7, pitches: [FB(150), SL(150), FK(150)] },
      { name: "백승현", throws: "R", velo: 150, control: 7, pitches: [FB(150), SL(150), CH(150)] },
      { name: "이우찬", throws: "L", velo: 144, control: 7, pitches: [FB(144), SL(144), CH(144)] },
      { name: "성동현", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), CB(148)] },
      { name: "김대현", throws: "R", velo: 149, control: 7, pitches: [FB(149), SL(149), FK(149)] },
      { name: "진해수", throws: "L", velo: 143, control: 8, pitches: [FB(143), SL(143), CH(143)] },
      { name: "이상영", throws: "L", velo: 146, control: 7, pitches: [FB(146), SL(146), CH(146)] },
      { name: "우강훈", throws: "R", velo: 150, control: 6, pitches: [FB(150), SL(150), FK(150)] },
    ],
  },
  {
    id: "doosan", name: "두산 베어스", short: "OB", color: "#131230", accent: "#ED1C24",
    lineup: [
      { name: "정수빈", pos: "CF", bats: "L", power: 4, contact: 8 },
      { name: "허경민", pos: "3B", bats: "R", power: 4, contact: 8 },
      { name: "양의지", pos: "C", bats: "R", power: 8, contact: 9 },
      { name: "김재환", pos: "DH", bats: "L", power: 8, contact: 7 },
      { name: "제러드", pos: "RF", bats: "R", power: 8, contact: 7 },
      { name: "강승호", pos: "2B", bats: "R", power: 6, contact: 6 },
      { name: "양석환", pos: "1B", bats: "R", power: 8, contact: 6 },
      { name: "김재호", pos: "SS", bats: "R", power: 4, contact: 6 },
      { name: "조수행", pos: "LF", bats: "L", power: 3, contact: 6 },
    ],
    rotation: [
      { name: "곽빈", throws: "R", velo: 152, control: 7, pitches: [FB(152), SL(152), CH(152), CB(152)] },
      { name: "브랜든", throws: "R", velo: 150, control: 8, pitches: [FB(150), TB(150), SL(150), CH(150)] },
      { name: "최원준", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), FK(148)] },
      { name: "김택연", throws: "R", velo: 153, control: 8, pitches: [FB(153), SL(153), CB(153)] },
      { name: "이영하", throws: "R", velo: 150, control: 7, pitches: [FB(150), SL(150), FK(150)] },
      { name: "김유성", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "정철원", throws: "R", velo: 150, control: 7, pitches: [FB(150), SL(150), FK(150)] },
    ],
  },
  {
    id: "kt", name: "KT 위즈", short: "KT", color: "#000000", accent: "#EB1C24",
    lineup: [
      { name: "김상수", pos: "2B", bats: "R", power: 4, contact: 7 },
      { name: "황재균", pos: "3B", bats: "R", power: 7, contact: 7 },
      { name: "로하스", pos: "RF", bats: "S", power: 9, contact: 8 },
      { name: "강백호", pos: "1B", bats: "L", power: 8, contact: 8 },
      { name: "장성우", pos: "C", bats: "R", power: 7, contact: 6 },
      { name: "문상철", pos: "DH", bats: "R", power: 7, contact: 6 },
      { name: "배정대", pos: "CF", bats: "R", power: 5, contact: 6 },
      { name: "김민혁", pos: "LF", bats: "L", power: 5, contact: 7 },
      { name: "권동진", pos: "SS", bats: "R", power: 4, contact: 6 },
    ],
    rotation: [
      { name: "고영표", throws: "R", velo: 145, control: 9, pitches: [FB(145), TB(145), CH(145), SL(145)] },
      { name: "쿠에바스", throws: "R", velo: 152, control: 8, pitches: [FB(152), SL(152), CH(152), CB(152)] },
      { name: "벤자민", throws: "L", velo: 150, control: 8, pitches: [FB(150), SL(150), CB(150)] },
      { name: "박영현", throws: "R", velo: 152, control: 8, pitches: [FB(152), SL(152), FK(152)] },
      { name: "소형준", throws: "R", velo: 150, control: 8, pitches: [FB(150), TB(150), SL(150)] },
      { name: "엄상백", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), CH(148)] },
      { name: "손동현", throws: "R", velo: 149, control: 7, pitches: [FB(149), SL(149), FK(149)] },
    ],
  },
  {
    id: "ssg", name: "SSG 랜더스", short: "SG", color: "#CE0E2D", accent: "#FFB81C",
    lineup: [
      { name: "정준재", pos: "2B", bats: "L", power: 3, contact: 7 },
      { name: "최지훈", pos: "CF", bats: "L", power: 5, contact: 7 },
      { name: "기예르모", pos: "3B", bats: "R", power: 8, contact: 7 },
      { name: "한유섬", pos: "RF", bats: "L", power: 8, contact: 6 },
      { name: "최정", pos: "DH", bats: "R", power: 9, contact: 7 },
      { name: "에레디아", pos: "LF", bats: "L", power: 8, contact: 8 },
      { name: "고명준", pos: "1B", bats: "R", power: 7, contact: 6 },
      { name: "이지영", pos: "C", bats: "R", power: 4, contact: 7 },
      { name: "박성한", pos: "SS", bats: "L", power: 5, contact: 8 },
    ],
    rotation: [
      { name: "김광현", throws: "L", velo: 148, control: 8, pitches: [FB(148), SL(148), CB(148), CH(148)] },
      { name: "앤더슨", throws: "L", velo: 150, control: 8, pitches: [FB(150), SL(150), CH(150), CB(150)] },
      { name: "송영진", throws: "R", velo: 149, control: 6, pitches: [FB(149), SL(149), CH(149)] },
      { name: "조병현", throws: "R", velo: 151, control: 7, pitches: [FB(151), SL(151), FK(151)] },
      { name: "노경은", throws: "R", velo: 146, control: 8, pitches: [FB(146), SL(146), CH(146)] },
      { name: "문승원", throws: "R", velo: 148, control: 8, pitches: [FB(148), SL(148), CB(148)] },
      { name: "박시후", throws: "L", velo: 145, control: 7, pitches: [FB(145), SL(145), CH(145)] },
    ],
  },
  {
    id: "lotte", name: "롯데 자이언츠", short: "LT", color: "#041E42", accent: "#D00F31",
    lineup: [
      { name: "황성빈", pos: "LF", bats: "L", power: 4, contact: 8 },
      { name: "고승민", pos: "2B", bats: "L", power: 6, contact: 8 },
      { name: "빅터 레이예스", pos: "RF", bats: "S", power: 8, contact: 9 },
      { name: "전준우", pos: "DH", bats: "R", power: 7, contact: 8 },
      { name: "손호영", pos: "3B", bats: "L", power: 7, contact: 7 },
      { name: "나승엽", pos: "1B", bats: "L", power: 6, contact: 7 },
      { name: "윤동희", pos: "CF", bats: "R", power: 5, contact: 7 },
      { name: "유강남", pos: "C", bats: "R", power: 5, contact: 6 },
      { name: "박승욱", pos: "SS", bats: "L", power: 4, contact: 6 },
    ],
    rotation: [
      { name: "박세웅", throws: "R", velo: 149, control: 8, pitches: [FB(149), SL(149), CB(149), FK(149)] },
      { name: "윌커슨", throws: "L", velo: 148, control: 8, pitches: [FB(148), SL(148), CH(148), CB(148)] },
      { name: "반즈", throws: "L", velo: 150, control: 7, pitches: [FB(150), SL(150), CH(150)] },
      { name: "김원중", throws: "R", velo: 150, control: 7, pitches: [FB(150), SL(150), FK(150)] },
      { name: "나균안", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), FK(148)] },
      { name: "구승민", throws: "R", velo: 149, control: 7, pitches: [FB(149), SL(149), FK(149)] },
      { name: "박진", throws: "R", velo: 146, control: 7, pitches: [FB(146), SL(146), CH(146)] },
    ],
  },
  {
    id: "hanwha", name: "한화 이글스", short: "HH", color: "#FF6600", accent: "#000000",
    lineup: [
      { name: "이도윤", pos: "SS", bats: "R", power: 3, contact: 6 },
      { name: "요나단 페라자", pos: "LF", bats: "L", power: 8, contact: 7 },
      { name: "안치홍", pos: "2B", bats: "R", power: 6, contact: 8 },
      { name: "노시환", pos: "3B", bats: "R", power: 9, contact: 7 },
      { name: "채은성", pos: "1B", bats: "R", power: 7, contact: 7 },
      { name: "김태연", pos: "DH", bats: "R", power: 6, contact: 7 },
      { name: "최재훈", pos: "C", bats: "R", power: 5, contact: 7 },
      { name: "이진영", pos: "RF", bats: "L", power: 5, contact: 6 },
      { name: "최인호", pos: "CF", bats: "L", power: 4, contact: 6 },
    ],
    rotation: [
      { name: "류현진", throws: "L", velo: 147, control: 10, pitches: [FB(147), CH(147), CB(147), SL(147)] },
      { name: "문동주", throws: "R", velo: 156, control: 7, pitches: [FB(156), SL(156), CB(156), CH(156)] },
      { name: "폰세", throws: "R", velo: 152, control: 8, pitches: [FB(152), SL(152), CH(152)] },
      { name: "주현상", throws: "R", velo: 149, control: 9, pitches: [FB(149), SL(149), FK(149)] },
      { name: "황준서", throws: "L", velo: 147, control: 7, pitches: [FB(147), SL(147), CB(147)] },
      { name: "김서현", throws: "R", velo: 156, control: 6, pitches: [FB(156), SL(156), FK(156)] },
      { name: "장민재", throws: "R", velo: 144, control: 8, pitches: [FB(144), SL(144), CH(144)] },
    ],
  },
  {
    id: "nc", name: "NC 다이노스", short: "NC", color: "#315288", accent: "#C69C6D",
    lineup: [
      { name: "박민우", pos: "2B", bats: "L", power: 4, contact: 9 },
      { name: "김주원", pos: "SS", bats: "S", power: 7, contact: 7 },
      { name: "손아섭", pos: "RF", bats: "L", power: 6, contact: 9 },
      { name: "맷 데이비슨", pos: "3B", bats: "R", power: 9, contact: 6 },
      { name: "박건우", pos: "CF", bats: "R", power: 7, contact: 8 },
      { name: "권희동", pos: "LF", bats: "R", power: 6, contact: 6 },
      { name: "오영수", pos: "1B", bats: "L", power: 6, contact: 6 },
      { name: "김형준", pos: "C", bats: "R", power: 6, contact: 6 },
      { name: "서호철", pos: "DH", bats: "R", power: 4, contact: 6 },
    ],
    rotation: [
      { name: "카일 하트", throws: "L", velo: 150, control: 9, pitches: [FB(150), SL(150), CH(150), CB(150)] },
      { name: "다니엘 카스타노", throws: "L", velo: 149, control: 8, pitches: [FB(149), SL(149), CH(149)] },
      { name: "신민혁", throws: "R", velo: 145, control: 7, pitches: [FB(145), SL(145), CH(145)] },
      { name: "이용찬", throws: "R", velo: 148, control: 8, pitches: [FB(148), SL(148), FK(148)] },
      { name: "임정호", throws: "L", velo: 145, control: 8, pitches: [FB(145), SL(145), CH(145)] },
      { name: "김영규", throws: "L", velo: 147, control: 7, pitches: [FB(147), SL(147), CH(147)] },
      { name: "이재학", throws: "R", velo: 145, control: 8, pitches: [FB(145), CH(145), SL(145)] },
    ],
  },
  {
    id: "kiwoom", name: "키움 히어로즈", short: "WO", color: "#570514", accent: "#B07F35",
    lineup: [
      { name: "김혜성", pos: "2B", bats: "L", power: 5, contact: 9 },
      { name: "송성문", pos: "3B", bats: "L", power: 7, contact: 8 },
      { name: "이주형", pos: "CF", bats: "L", power: 7, contact: 7 },
      { name: "최주환", pos: "DH", bats: "L", power: 7, contact: 6 },
      { name: "도슨", pos: "LF", bats: "L", power: 7, contact: 7 },
      { name: "김재현", pos: "1B", bats: "L", power: 6, contact: 6 },
      { name: "김건희", pos: "C", bats: "R", power: 5, contact: 6 },
      { name: "이형종", pos: "RF", bats: "R", power: 6, contact: 6 },
      { name: "김태진", pos: "SS", bats: "R", power: 4, contact: 6 },
    ],
    rotation: [
      { name: "안우진", throws: "R", velo: 155, control: 8, pitches: [FB(155), SL(155), CB(155), CH(155)] },
      { name: "헤이수스", throws: "R", velo: 153, control: 7, pitches: [FB(153), SL(153), CH(153)] },
      { name: "하영민", throws: "R", velo: 148, control: 7, pitches: [FB(148), SL(148), CB(148)] },
      { name: "조상우", throws: "R", velo: 154, control: 7, pitches: [FB(154), SL(154), FK(154)] },
      { name: "김선기", throws: "R", velo: 147, control: 7, pitches: [FB(147), SL(147), CH(147)] },
      { name: "김윤하", throws: "R", velo: 149, control: 6, pitches: [FB(149), SL(149), CB(149)] },
      { name: "김성민", throws: "L", velo: 145, control: 7, pitches: [FB(145), SL(145), CH(145)] },
    ],
  },
];

export const POS_LABEL: Record<Position, string> = {
  P: "투수", C: "포수", "1B": "1루수", "2B": "2루수", "3B": "3루수",
  SS: "유격수", LF: "좌익수", CF: "중견수", RF: "우익수", DH: "지명타자",
};
