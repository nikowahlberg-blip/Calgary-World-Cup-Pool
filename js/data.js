// ── GROUPS & TEAMS ───────────────────────────────────────────────
const GROUPS = {
  A: ["Mexico","South Korea","South Africa","Czechia"],
  B: ["Canada","Bosnia-Herzegovina","Qatar","Switzerland"],
  C: ["Brazil","Morocco","Haiti","Scotland"],
  D: ["United States","Paraguay","Australia","Türkiye"],
  E: ["Germany","Ivory Coast","Ecuador","Curaçao"],
  F: ["Netherlands","Japan","Sweden","Tunisia"],
  G: ["Belgium","Egypt","Iran","New Zealand"],
  H: ["Spain","Saudi Arabia","Uruguay","Cape Verde"],
  I: ["France","Norway","Senegal","Iraq"],
  J: ["Argentina","Algeria","Austria","Jordan"],
  K: ["Portugal","Colombia","Congo DR","Uzbekistan"],
  L: ["England","Croatia","Ghana","Panama"],
};
const ALL_TEAMS = Object.values(GROUPS).flat();

const FLAGS = {
  "Mexico":"🇲🇽","South Korea":"🇰🇷","South Africa":"🇿🇦","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia-Herzegovina":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Türkiye":"🇹🇷",
  "Germany":"🇩🇪","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨","Curaçao":"🇨🇼",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "Belgium":"🇧🇪","Egypt":"🇪🇬","Iran":"🇮🇷","New Zealand":"🇳🇿",
  "Spain":"🇪🇸","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾","Cape Verde":"🇨🇻",
  "France":"🇫🇷","Norway":"🇳🇴","Senegal":"🇸🇳","Iraq":"🇮🇶",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","Colombia":"🇨🇴","Congo DR":"🇨🇩","Uzbekistan":"🇺🇿",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦",
};
const flag = t => FLAGS[t] || "🏳";

// ── API NAME NORMALISATION ────────────────────────────────────────
// football-data.org uses different names for some countries
const API_NAME_MAP = {
  "Bosnia and Herzegovina":"Bosnia-Herzegovina",
  "Bosnia & Herzegovina":"Bosnia-Herzegovina",
  "Czech Republic":"Czechia",
  "USA":"United States",
  "Turkey":"Türkiye",
  "Côte d'Ivoire":"Ivory Coast",
  "Cote d'Ivoire":"Ivory Coast",
  "DR Congo":"Congo DR",
  "Republic of Congo":"Congo DR",
  "Cape Verde Islands":"Cape Verde",
  "Korea Republic":"South Korea",
  "Curacao":"Curaçao",
};
const normalizeTeam = name => API_NAME_MAP[name] || name;

// ── KO ROUNDS ────────────────────────────────────────────────────
const KO_ROUNDS = [
  { id:"r32",   label:"Round of 32",    apiStage:"LAST_32",         size:32, pts:2 },
  { id:"r16",   label:"Round of 16",    apiStage:"LAST_16",         size:16, pts:3 },
  { id:"qf",    label:"Quarter-finals", apiStage:"QUARTER_FINALS",  size:8,  pts:4 },
  { id:"sf",    label:"Semi-finals",    apiStage:"SEMI_FINALS",     size:4,  pts:5 },
  { id:"final", label:"Final",          apiStage:"FINAL",           size:2,  pts:6 },
  { id:"champ", label:"Champion",       apiStage:null,              size:1,  pts:8 },
];

// ── SCORING ───────────────────────────────────────────────────────
const GROUP_PTS     = { 1:3, 2:2, 3:1, 4:0 };
const GOLDEN_PTS    = 4;
const MAX_GROUP_PTS = 12 * (3 + 2 + 1);  // 72
const MAX_KO_PTS    = KO_ROUNDS.reduce((a, r) => a + r.size * r.pts, 0); // 2*32+3*16+4*8+5*4+6*2+8*1 = 64+48+32+20+12+8 = 184
const MAX_TOTAL_PTS = MAX_GROUP_PTS + GOLDEN_PTS + MAX_KO_PTS;

// ── DEFAULT STATE ─────────────────────────────────────────────────
const DEFAULT_STATE = () => ({
  players:          [],   // [{name, groupPicks:{}, bracketPicks:{}, goldenBoot:""}]
  phase:            "group",  // "group" | "bracket"
  groupResults:     {},   // {A:{1:"Brazil",...}, ...}
  bracketTeams:     [],   // 32 qualified teams
  koResults:        {},   // {r32:[{t1,t2,winner},...], ...}
  goldenBootResult: "",
  lastSync:         null,
});
