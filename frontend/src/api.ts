export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const SIMULATION_AS_OF = "2026-06-12";

export type RiskLevel = "warning" | "info" | "ok";

export type Scenario = {
  id: string;
  label: string;
  user_name: string;
  first_name: string;
  insurance_status: string;
  insurance_type: string;
  waiting_period: { status: string; note: string; ok: boolean };
  benefit_payer: { title: string; note: string; is_zus: boolean };
  due_date: string;
  payer_account: { has_debt: boolean; debt_amount: number; note: string };
  ezla: { period: string; days_used: number; days_limit: number; days_left: number; code: string };
  base_salary_gross: number;
  risks: { level: RiskLevel; badge: string; title: string; desc: string }[];
};

export type BenefitPlan = {
  monthly_gross: number;
  monthly_net: number;
  uplift_applied?: boolean;
  benefit_base?: number;
  declared_gross?: number;
  entitled?: boolean;
  denial_reason?: string;
  event?: string;
  total_weeks: number;
  total_extra_days?: number;
  total_months_approx: number;
  payer?: { title: string; is_zus: boolean; required_forms: string[]; note: string; insured_count?: number };
  parents?: { mother: string; father: string; role: string };
  notes?: string[];
  pregnancy?: { sick_days_paid: number; employer_days: number; zus_sick_days: number; rehab_days: number; limit_days: number };
  breakdown: {
    maternity_weeks: number;
    pre_birth_weeks?: number;
    parental_weeks_mother: number;
    parental_weeks_father_exclusive: number;
    paternity_weeks: number;
    premature_weeks: number;
    extension_weeks?: number;
    extension_days?: number;
    parental_cap?: number;
  };
  deadline_21_days: string;
  schedule: {
    month_label: string;
    parent: string;
    benefit_type: string;
    rate: string;
    gross_amount: number;
  }[];
};

export type CalculatorInput = {
  benefit_type: string;
  employment_type: string;
  children_count: number;
  due_date: string;
  start_before_birth?: boolean;
  za_zyciem: boolean;
  premature_extra_weeks?: number;
  variant: string;
  work_share?: number;
  base_salary_gross: number;
  parent_name?: string;
  second_parent_name?: string;
  parent_role?: string;
  tygodnie_przed_porodem?: number;
  tydzien_ciazy_porodu?: number | null;
  masa_urodzeniowa_g?: number | null;
  dni_w_szpitalu?: number | null;
  etat_pracy?: number | null;
  tygodnie_laczenia?: number | null;
  wymiar_etatu?: number | null;
  hospitalizacja_od_dnia?: number | null;
  hospitalizacja_do_dnia?: number | null;
  wiek_dziecka_lata?: number | null;
  wiek_dziecka_miesiace?: number | null;
  odroczenie_obowiazku_szkolnego?: boolean;
  liczba_ubezpieczonych?: number;
  wiek_ubezpieczonego?: number | null;
  dni_niezdolnosci?: number;
  miesiace_rehabilitacji?: number;
  rehabilitacja_w_ciazy?: boolean;
  waiting_days?: number | null;
  debt_amount?: number;
  matka_nie_moze_opiekowac?: boolean;
  include_paternity?: boolean;
};

export type PdfCase = {
  id?: string;
  filename: string;
  pages: number;
  confidence: number;
  extracted: {
    insurance_title: string;
    insurance_period: string;
    base_amount: string;
    base_amount_value?: number | null;
    due_or_birth_date: string | null;
    requested_variant: string;
    applicant_name?: string | null;
    role?: string | null;
    employment_type?: string | null;
    insured_count?: number | null;
  };
  completeness: { ok: boolean; title: string; detail: string };
  text_layer?: boolean;
  error?: string | null;
  decision: {
    approved: boolean;
    status_title: string;
    subtitle: string;
    monthly_gross: string;
    rate_note: string;
    legal_basis: string;
  };
};

export type Organization = {
  id: number;
  category: string;
  badge: string;
  name: string;
  description: string;
  phone: string;
  website: string;
  verified: number;
};

export type OrgInput = {
  category: string;
  badge: string;
  name: string;
  description: string;
  phone: string;
  website: string;
};

export type AuthSession = {
  session_id: string;
  qr_payload: string;
  expires_in_seconds: number;
};

export type AuthUser = {
  full_name: string;
  pesel_masked: string;
  pue_connected: boolean;
};

export type LegislationParams = {
  rate_single_variant: number;
  rate_maternity: number;
  rate_parental: number;
  maternity_weeks_single: number;
  parental_weeks_single: number;
  paternity_weeks: number;
  deadline_days_81_5: number;
};

export const FALLBACK_LEGISLATION: LegislationParams = {
  rate_single_variant: 81.5,
  rate_maternity: 100,
  rate_parental: 70,
  maternity_weeks_single: 20,
  parental_weeks_single: 41,
  paternity_weeks: 2,
  deadline_days_81_5: 21,
};

export function formatRate(value: number) {
  const text = (Number.isFinite(value) ? value : 0).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${text.endsWith(",0") ? text.slice(0, -2) : text}%`;
}

const MONTHS_PL = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MONTHS_LONG = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

export function addDaysIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function formatPlDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function formatLongPl(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS_LONG[(month || 1) - 1]} ${year}`;
}

export function daysBetween(fromIso: string, toIso: string) {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

function rateLabel(rate: number) {
  return (rate * 100).toFixed(1).replace(".0", "").replace(".", ",") + "%";
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

const CONTRIBUTION = 0.1371;
const MIN_WAGE = 4806;
const BASE_FLOOR = Math.round(MIN_WAGE * (1 - CONTRIBUTION) * 100) / 100;
const MAX_GROSS = 23550;
const MAX_BASE = Math.round(MAX_GROSS * (1 - CONTRIBUTION) * 100) / 100;
const DEBT_LIMIT = Math.round(MIN_WAGE * 0.01 * 100) / 100;

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function optionalNumber(value: number | null | undefined) {
  return value == null || Number.isNaN(Number(value)) ? null : Number(value);
}

export function supplementaryWeeks(week: number | null, grams: number | null, days: number | null, stayFrom: number | null = null, stayTo: number | null = null) {
  if (week == null) return 0;
  let countedDays = days ?? 0;
  if (week >= 37 && stayFrom != null && stayTo != null) {
    countedDays = stayTo >= stayFrom ? Math.max(0, Math.min(stayTo, 28) - Math.max(stayFrom, 5) + 1) : 0;
  }
  if (countedDays <= 0) return 0;
  const counted = Math.ceil(countedDays / 7);
  if (week < 28 || (grams != null && grams <= 1000)) return Math.min(15, counted);
  if (week >= 28 && week <= 36) return Math.min(8, counted);
  if (week >= 37 && countedDays >= 2) return Math.min(8, counted);
  return 0;
}

function monthlyAmount(basis: number, rate: number) {
  const gross = money(basis * rate);
  const net = money(gross * 0.88);
  if (gross > 0 && net < 1000) return { gross: 1000, net: 1000, uplift: true };
  return { gross, net, uplift: false };
}

export function parsePlnAmount(text: string | null | undefined) {
  if (!text || /brak|nie odczytano|—/i.test(text)) return null;
  const match = text.replace(/\s/g, "").match(/(\d+)(?:[,.](\d{1,2}))?/);
  if (!match) return null;
  return money(Number(match[1]) + (match[2] ? Number(match[2].padEnd(2, "0")) / 100 : 0));
}

export function calculateLocally(payload: CalculatorInput, law: LegislationParams = FALLBACK_LEGISLATION): BenefitPlan {
  const aliases: Record<string, string> = { porod: "porod", birth: "porod", ciaza: "ciaza_l4", ciaza_l4: "ciaza_l4", pregnancy: "ciaza_l4", adopcja: "adopcja", adoption: "adopcja", piecza: "piecza", piecza_zastepcza: "piecza" };
  const event = aliases[payload.benefit_type] || "porod";
  const employment = ["uop", "zlecenie", "jdg", "ustanie"].includes(payload.employment_type) ? payload.employment_type : "uop";
  const children = Math.min(5, Math.max(1, Math.round(finite(Number(payload.children_count), 1))));
  const zaZyciem = Boolean(payload.za_zyciem);
  const variant = payload.variant === "100_70" ? "100_70" : "81.5";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date || "") ? payload.due_date : "";
  const role = payload.parent_role === "ojciec" || payload.parent_role === "opiekun" ? payload.parent_role : "matka";
  const applicant = (payload.parent_name || "").trim();
  const second = (payload.second_parent_name || "").trim();
  const mother = role === "ojciec" ? second || "Matka" : applicant || (role === "opiekun" ? "Opiekun" : "Matka");
  const father = role === "ojciec" ? applicant || "Ojciec" : second || (role === "opiekun" ? "Drugi rodzic" : "Ojciec");
  let declared = Math.max(0, finite(Number(payload.base_salary_gross), 0));
  const contractFte = Math.min(1, Math.max(0.01, optionalNumber(payload.wymiar_etatu) ?? 1));
  const notes: string[] = [];
  if (employment === "uop" && declared > 0) {
    const floorGross = money(MIN_WAGE * contractFte);
    if (declared < floorGross) {
      declared = floorGross;
      notes.push(`Podstawa UoP podniesiona do podłogi ${contractFte} etatu: ${floorGross.toFixed(2)} zł brutto.`);
    }
  }
  if ((employment === "jdg" || employment === "zlecenie") && declared > MAX_GROSS) declared = MAX_GROSS;
  let basis = declared <= 0 ? 0 : money(declared * (1 - CONTRIBUTION));
  if (employment === "jdg" || employment === "zlecenie") basis = Math.min(basis, MAX_BASE);
  const debt = finite(Number(payload.debt_amount), 0);
  let entitled = Boolean(dueDate);
  let denial = dueDate ? "" : "Podaj datę porodu, przyjęcia dziecka albo początku zwolnienia.";
  if ((employment === "jdg" || employment === "zlecenie") && debt > DEBT_LIMIT) {
    entitled = false;
    denial = `Zadłużenie przekracza 1% minimalnego wynagrodzenia (${DEBT_LIMIT.toFixed(2)} zł).`;
  }
  const waiting = optionalNumber(payload.waiting_days);
  if (event === "ciaza_l4" && (employment === "jdg" || employment === "zlecenie") && waiting != null && waiting < 90) {
    entitled = false;
    denial = "Do zasiłku chorobowego przy dobrowolnym ubezpieczeniu potrzeba 90 dni podlegania.";
  }
  const payBasis = entitled ? basis : 0;
  const rateFull = 1;
  const rateMaternity = (variant === "81.5" ? finite(Number(law.rate_single_variant), 81.5) : finite(Number(law.rate_maternity), 100)) / 100;
  const rateOwn = variant === "81.5" ? rateMaternity : finite(Number(law.rate_parental), 70) / 100;
  const rateOther = finite(Number(law.rate_parental), 70) / 100;
  const maternityBase = finite(Number(law.maternity_weeks_single), 20);
  const shift = maternityBase - 20;
  const maternityMap: Record<number, number> = { 1: maternityBase, 2: 31 + shift, 3: 33 + shift, 4: 35 + shift, 5: 37 + shift };
  let maternity = Math.max(1, maternityMap[children] ?? maternityBase);
  const parentalBase = finite(Number(law.parental_weeks_single), 41);
  const parentalShift = parentalBase - 41;
  let parental = Math.max(1, zaZyciem ? (children === 1 ? 65 : 67) + parentalShift : children === 1 ? parentalBase : parentalBase + 2);
  const ageYears = optionalNumber(payload.wiek_dziecka_lata);
  if (event === "adopcja" || event === "piecza") {
    const limit = event === "adopcja" ? 14 : payload.odroczenie_obowiazku_szkolnego ? 10 : 7;
    if (ageYears != null) {
      if (ageYears >= limit) {
        maternity = 0;
        parental = 0;
      } else {
        const left = ((limit - ageYears) * 365) / 7;
        const minimum = zaZyciem ? 71 : 47;
        if (left < maternity + parental) {
          if (left < minimum) {
            maternity = 9;
            parental = zaZyciem ? 62 : 38;
          } else {
            const granted = Math.floor(left);
            maternity = Math.min(maternity, granted);
            parental = granted - maternity;
          }
        }
      }
    }
  }
  let preWeeks = 0;
  let postWeeks = maternity;
  let extraWeeks = 0;
  if (event === "porod") {
    preWeeks = Math.min(maternity, Math.min(6, Math.max(0, Math.round(finite(Number(payload.tygodnie_przed_porodem), 0)))));
    postWeeks = maternity - preWeeks;
    extraWeeks = supplementaryWeeks(optionalNumber(payload.tydzien_ciazy_porodu), optionalNumber(payload.masa_urodzeniowa_g), optionalNumber(payload.dni_w_szpitalu), optionalNumber(payload.hospitalizacja_od_dnia), optionalNumber(payload.hospitalizacja_do_dnia));
  }
  if (event === "ciaza_l4") {
    postWeeks = 0;
    preWeeks = 0;
    parental = 0;
    extraWeeks = 0;
  }
  const fatherExclusive = Math.min(9, parental);
  const motherParental = Math.max(0, parental - fatherExclusive);
  let etat = optionalNumber(payload.etat_pracy);
  if (etat == null) {
    const legacy = finite(Number(payload.work_share), 0);
    etat = legacy > 1 ? legacy / 100 : legacy;
  }
  etat = Math.min(0.5, Math.max(0, etat));
  if (employment !== "uop") etat = 0;
  const ownerPool = role === "ojciec" ? fatherExclusive : motherParental;
  const combineInput = optionalNumber(payload.tygodnie_laczenia);
  const combine = etat > 0 ? (combineInput == null ? ownerPool : Math.min(ownerPool, Math.max(0, combineInput))) : 0;
  const cap = zaZyciem ? (children === 1 ? 130 : 134) : children === 1 ? 82 : 86;
  const rawExtra = Math.min(combine * etat, Math.max(0, cap - parental));
  const extensionDaysTotal = Math.floor(rawExtra * 7);
  const ageMonths = optionalNumber(payload.wiek_dziecka_miesiace);
  let paternity = payload.include_paternity === false ? 0 : Math.max(0, finite(Number(law.paternity_weeks), 2));
  if (event === "piecza" || event === "ciaza_l4" || maternity + parental === 0) paternity = 0;
  if (event === "porod" && ageMonths != null && ageMonths >= 12) paternity = 0;
  if (event === "adopcja" && ageYears != null && ageYears >= 14) paternity = 0;
  const insured = Math.round(finite(Number(payload.liczba_ubezpieczonych), 21));
  const zus = employment === "jdg" || employment === "ustanie" || insured <= 20;
  const payerTitle = employment === "zlecenie" && !zus ? "Zleceniodawca" : zus ? "ZUS" : "Pracodawca";
  const forms = employment === "jdg" ? ["ZAM do ZUS"] : zus && employment === "zlecenie" ? ["Z-3a"] : zus && employment === "uop" ? ["Z-3"] : [];
  const main = monthlyAmount(payBasis, event === "ciaza_l4" ? rateFull : rateMaternity);
  const sickDays = Math.min(270, Math.max(0, Math.round(finite(Number(payload.dni_niezdolnosci), 0))));
  const age = optionalNumber(payload.wiek_ubezpieczonego);
  const employerDays = event === "ciaza_l4" && employment === "uop" ? Math.min(sickDays, age != null && age >= 50 ? 14 : 33) : 0;
  const rehabDays = event === "ciaza_l4" && sickDays >= 270 ? Math.min(365, Math.max(0, Math.round(finite(Number(payload.miesiace_rehabilitacji), 0)) * 30)) : 0;
  const totalDays = event === "ciaza_l4"
    ? sickDays + rehabDays
    : (preWeeks + postWeeks + extraWeeks + parental) * 7 + extensionDaysTotal + paternity * 7;
  const schedule: BenefitPlan["schedule"] = [];
  if (entitled && dueDate && payBasis > 0 && event !== "ciaza_l4") {
    const care = payload.matka_nie_moze_opiekowac ? father : mother;
    const chunks: { days: number; parent: string; kind: string; rate: number }[] = [];
    if (postWeeks) chunks.push({ days: postWeeks * 7, parent: care, kind: "Zasiłek macierzyński", rate: rateMaternity });
    if (extraWeeks) chunks.push({ days: extraWeeks * 7, parent: care, kind: "Uzupełniający urlop macierzyński", rate: rateFull });
    const fullParentalRate = role === "ojciec" ? rateOther : rateOwn;
    const reducedRate = fullParentalRate * (1 - etat);
    const ownerDays = Math.round(ownerPool * 7);
    const reducedDays = Math.round(combine * 7);
    const fullDays = Math.max(0, ownerDays - reducedDays);
    if (role === "ojciec") {
      if (fullDays) chunks.push({ days: fullDays, parent: father, kind: "Urlop rodzicielski ojca", rate: rateOther });
      if (reducedDays) chunks.push({ days: reducedDays, parent: father, kind: "Rodzicielski łączony z pracą", rate: reducedRate });
      if (extensionDaysTotal) chunks.push({ days: extensionDaysTotal, parent: father, kind: "Wydłużenie za pracę", rate: fullParentalRate });
      if (motherParental) chunks.push({ days: motherParental * 7, parent: mother, kind: "Urlop rodzicielski matki", rate: rateOwn });
    } else {
      if (fullDays) chunks.push({ days: fullDays, parent: mother, kind: "Urlop rodzicielski", rate: rateOwn });
      if (reducedDays) chunks.push({ days: reducedDays, parent: mother, kind: "Rodzicielski łączony z pracą", rate: reducedRate });
      if (extensionDaysTotal) chunks.push({ days: extensionDaysTotal, parent: mother, kind: "Wydłużenie za pracę", rate: fullParentalRate });
      if (fatherExclusive) chunks.push({ days: fatherExclusive * 7, parent: father, kind: "9 tyg. wyłącznie dla drugiego rodzica", rate: rateOther });
    }
    const [year, month, day] = dueDate.split("-").map(Number);
    let cursor = new Date(year, month - 1, day);
    if (preWeeks) {
      const preStart = new Date(cursor);
      preStart.setDate(preStart.getDate() - preWeeks * 7);
      pushChunk(schedule, preStart, preWeeks * 7, care, "Urlop przed porodem", rateFull, payBasis);
    }
    chunks.forEach((chunk) => {
      pushChunk(schedule, cursor, chunk.days, chunk.parent, chunk.kind, chunk.rate, payBasis);
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + chunk.days);
    });
    if (paternity) pushChunk(schedule, new Date(year, month - 1, day), paternity * 7, father, "Urlop ojcowski", rateFull, payBasis);
  }
  return {
    monthly_gross: main.gross,
    monthly_net: main.net,
    uplift_applied: main.uplift,
    benefit_base: basis,
    declared_gross: declared,
    entitled,
    denial_reason: denial,
    event,
    total_weeks: Math.floor(totalDays / 7),
    total_extra_days: totalDays % 7,
    total_months_approx: Math.round(Math.floor(totalDays / 7) / 4.33),
    payer: { title: payerTitle, is_zus: zus, required_forms: forms, note: zus ? "Zasiłek wypłaca ZUS." : "Zasiłek wypłaca płatnik składek.", insured_count: insured },
    parents: { mother, father, role },
    notes,
    pregnancy: event === "ciaza_l4" ? { sick_days_paid: sickDays, employer_days: employerDays, zus_sick_days: sickDays - employerDays, rehab_days: rehabDays, limit_days: 270 } : undefined,
    breakdown: {
      maternity_weeks: postWeeks,
      pre_birth_weeks: preWeeks,
      parental_weeks_mother: motherParental,
      parental_weeks_father_exclusive: fatherExclusive,
      paternity_weeks: paternity,
      premature_weeks: extraWeeks,
      extension_weeks: Math.floor(extensionDaysTotal / 7),
      extension_days: extensionDaysTotal % 7,
      parental_cap: cap,
    },
    deadline_21_days: dueDate ? addDaysIso(dueDate, Math.max(1, finite(Number(law.deadline_days_81_5), 21))) : "",
    schedule,
  };
}

function pushChunk(schedule: BenefitPlan["schedule"], start: Date, days: number, parent: string, kind: string, rate: number, basis: number) {
  const amount = monthlyAmount(basis, rate).gross;
  for (let offset = 0; offset < days && offset < 800; offset += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + offset);
    const label = `${MONTHS_PL[current.getMonth()]} ${current.getFullYear()}`;
    const existing = schedule.find((row) => row.month_label === label && row.parent === parent && row.benefit_type === kind);
    const share = money(amount / 30);
    if (existing) existing.gross_amount = money(existing.gross_amount + share);
    else schedule.push({ month_label: label, parent, benefit_type: kind, rate: rateLabel(rate), gross_amount: share });
  }
}

export const FALLBACK_SCENARIOS: Scenario[] = [
  {
    id: "uop_over_20",
    label: "1. Pracownica UoP (>20 os.)",
    user_name: "Anna Kowalska",
    first_name: "Anna",
    insurance_status: "AKTYWNE (UoP)",
    insurance_type: "Obowiązkowe • umowa o pracę • ciągłość od 14.02.2022",
    waiting_period: { status: "Spełniony", note: "minimum 30 dni", ok: true },
    benefit_payer: { title: "Pracodawca", note: "powyżej 20 ubezpieczonych", is_zus: false },
    due_date: "2026-09-18",
    payer_account: { has_debt: false, debt_amount: 0, note: "Brak zadłużenia • Saldo na dzień nabycia prawa: 0,00 zł" },
    ezla: { period: "03.06–30.08.2026", days_used: 76, days_limit: 270, days_left: 194, code: "KOD B • 100%" },
    base_salary_gross: 8200,
    risks: [
      { level: "warning", badge: "DO SPRAWDZENIA", title: "Ciągłość ubezpieczenia do porodu", desc: "Rozwiązanie umowy przed dniem porodu może zmienić prawo do świadczeń. Wyjątki dotyczą m.in. upadłości lub likwidacji pracodawcy." },
      { level: "info", badge: "WAŻNE DLA JDG", title: "Podstawa wymiaru świadczenia", desc: "ZUS lub płatnik uwzględni przeciętne wynagrodzenie z pełnych miesięcy ubezpieczenia poprzedzających niezdolność do pracy." },
      { level: "ok", badge: "OCHRONA AKTYWNA", title: "Ochrona stosunku pracy", desc: "W okresie ciąży i urlopu pracodawca co do zasady nie może wypowiedzieć ani rozwiązać umowy o pracę." },
    ],
  },
  {
    id: "jdg_active",
    label: "2. JDG — dobrowolne chorobowe (>90 dni)",
    user_name: "Anna Kowalska (JDG)",
    first_name: "Anna",
    insurance_status: "AKTYWNE (JDG)",
    insurance_type: "Dobrowolne chorobowe • JDG • opłacane od 01.01.2024",
    waiting_period: { status: "Spełniony", note: "minimum 90 dni dla JDG", ok: true },
    benefit_payer: { title: "ZUS", note: "płatnik samodzielny (JDG)", is_zus: true },
    due_date: "2026-09-18",
    payer_account: { has_debt: false, debt_amount: 0, note: "Brak zadłużenia > 1% minimalnego wynagrodzenia" },
    ezla: { period: "10.07–30.08.2026", days_used: 52, days_limit: 270, days_left: 218, code: "KOD B • 100%" },
    base_salary_gross: 6500,
    risks: [
      { level: "warning", badge: "KONTROLA ZUS", title: "Podwyższenie podstawy składek", desc: "Nagła deklaracja maksymalnej podstawy przed porodem często skutkuje kontrolą tytułu ubezpieczenia przez ZUS." },
      { level: "warning", badge: "PILNUJ TERMINÓW", title: "Zadłużenie powyżej 1% płacy minimalnej", desc: "Zaległość przekraczająca 1% minimalnego wynagrodzenia wstrzymuje wypłatę zasiłku do czasu pełnej spłaty." },
      { level: "ok", badge: "ZUS PŁATNIKIEM", title: "Wniosek ZAM bezpośrednio do ZUS", desc: "Przy JDG składasz wyłącznie wniosek ZAM przez eZUS bez zaświadczenia Z-3." },
    ],
  },
  {
    id: "zlecenie_no_waiting",
    label: "3. Umowa zlecenie (<90 dni chorobowego)",
    user_name: "Anna Kowalska (Zlecenie)",
    first_name: "Anna",
    insurance_status: "AKTYWNE (Zlecenie)",
    insurance_type: "Dobrowolne chorobowe • zgłoszenie od 01.08.2026",
    waiting_period: { status: "Brak 90 dni (dla L4)", note: "Macierzyński przysługuje od 1. dnia!", ok: true },
    benefit_payer: { title: "ZUS", note: "zleceniodawca < 20 ubezpieczonych", is_zus: true },
    due_date: "2026-09-18",
    payer_account: { has_debt: false, debt_amount: 0, note: "Składki rozliczane przez zleceniodawcę" },
    ezla: { period: "Brak e-ZLA", days_used: 0, days_limit: 270, days_left: 270, code: "BRAK L4" },
    base_salary_gross: 5400,
    risks: [
      { level: "ok", badge: "WAŻNY WYJĄTEK", title: "Zasiłek macierzyński bez okresu wyczekiwania", desc: "Do zasiłku macierzyńskiego NIE obowiązuje 90-dniowy okres wyczekiwania — wystarczy podleganie ubezpieczeniu w dniu porodu." },
      { level: "warning", badge: "UWAGA NA L4", title: "Brak prawa do zasiłku chorobowego przed porodem", desc: "Przed upływem 90 dni dobrowolnego ubezpieczenia zwolnienie lekarskie w ciąży będzie bezpłatne." },
      { level: "info", badge: "DOKUMENT Z-3a", title: "Wymagane zaświadczenie zleceniodawcy Z-3a", desc: "Zleceniodawca musi przekazać do ZUS formularz Z-3a z podstawą składek." },
    ],
  },
];

export const FALLBACK_PDF_CASES: PdfCase[] = [
  {
    id: "uop_complete",
    filename: "ZAM_Anna_Kowalska_2026.pdf",
    pages: 3,
    confidence: 96,
    extracted: { insurance_title: "Umowa o pracę", insurance_period: "od 14.02.2022 – ciągły", base_amount: "8 200,00 zł", base_amount_value: 8200, due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres", applicant_name: "Anna Kowalska", role: "matka", employment_type: "uop", insured_count: 25 },
    completeness: { ok: true, title: "Dokumentacja kompletna", detail: "ZAM, Z-3 oraz akt urodzenia zostały rozpoznane." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE", subtitle: "Warunki do przyznania zasiłku macierzyńskiego zostały spełnione.", monthly_gross: "5 766,76 zł", rate_note: "81,5% podstawy po odliczeniu 13,71%", legal_basis: "Ubezpieczona podlega ubezpieczeniu chorobowemu w dniu porodu. Wniosek o wypłatę w wysokości 81,5% złożono w terminie 21 dni (art. 30a ustawy zasiłkowej)." },
  },
  {
    id: "jdg_no_90_days",
    filename: "ZAM_JDG_Krotki_Staz_2026.pdf",
    pages: 2,
    confidence: 94,
    extracted: { insurance_title: "Pozarolnicza działalność gospodarcza (JDG)", insurance_period: "od 01.08.2026 (48 dni przed porodem)", base_amount: "6 500,00 zł", base_amount_value: 6500, due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres", applicant_name: "Anna Kowalska", role: "matka", employment_type: "jdg", insured_count: 1 },
    completeness: { ok: true, title: "Dokumentacja kompletna (ZAM + akt urodzenia)", detail: "Dla JDG nie jest wymagane zaświadczenie Z-3." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE (WYJĄTEK OD 90 DNI)", subtitle: "Do zasiłku macierzyńskiego nie stosuje się 90-dniowego okresu wyczekiwania.", monthly_gross: "4 571,21 zł", rate_note: "81,5% zadeklarowanej podstawy po 13,71%", legal_basis: "Art. 29 ust. 1 pkt 1 ustawy zasiłkowej — prawo do zasiłku macierzyńskiego powstaje od pierwszego dnia podlegania dobrowolnemu ubezpieczeniu chorobowemu." },
  },
  {
    id: "zlecenie_missing_z3a",
    filename: "ZAM_Zlecenie_Brak_Z3a_2026.pdf",
    pages: 1,
    confidence: 91,
    extracted: { insurance_title: "Umowa zlecenie", insurance_period: "od 10.03.2025 – ciągły", base_amount: "Brak danych w aktach", base_amount_value: null, due_or_birth_date: "18.09.2026", requested_variant: "100% + 70%", applicant_name: "Anna Kowalska", role: "matka", employment_type: "zlecenie", insured_count: 12 },
    completeness: { ok: false, title: "Brak zaświadczenia Z-3a od zleceniodawcy", detail: "Wykryto wniosek ZAM, ale brakuje zaświadczenia płatnika składek Z-3a niezbędnego do ustalenia podstawy." },
    decision: { approved: false, status_title: "POSTĘPOWANIE DO UZUPEŁNIENIA", subtitle: "ZUS wezwie płatnika lub ubezpieczoną do złożenia formularza Z-3a (termin 7 dni).", monthly_gross: "Do wyliczenia po wpływie Z-3a", rate_note: "Wariant 100% (20 tyg.) + 70% (32 tyg.)", legal_basis: "§ 2 rozporządzenia MRPiPS w sprawie zakresu informacji o okolicznościach mających wpływ na prawo do zasiłków." },
  },
  {
    id: "employer_bankruptcy",
    filename: "ZAM_Upadlosc_Pracodawcy_2026.pdf",
    pages: 4,
    confidence: 95,
    extracted: { insurance_title: "Umowa o pracę (rozwiązana z powodu upadłości)", insurance_period: "01.03.2021 – 15.07.2026 (likwidacja pracodawcy)", base_amount: "7 800,00 zł", base_amount_value: 7800, due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres", applicant_name: "Anna Kowalska", role: "matka", employment_type: "ustanie", insured_count: 8 },
    completeness: { ok: true, title: "Dokumentacja kompletna + postanowienie sądu", detail: "Rozpoznano ZAM, świadectwo pracy oraz odpis postanowienia o ogłoszeniu upadłości." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE (ART. 30 UST. 1)", subtitle: "Szczególna ochrona w razie ustania zatrudnienia w ciąży z powodu upadłości/likwidacji.", monthly_gross: "5 485,46 zł", rate_note: "Wypłata bezpośrednio przez ZUS", legal_basis: "Art. 30 ust. 1 pkt 1 ustawy zasiłkowej — zasiłek macierzyński przysługuje również w razie urodzenia dziecka po ustaniu ubezpieczenia chorobowego z powodu ogłoszenia upadłości lub likwidacji pracodawcy." },
  },
];

export const PDF_CHIP_LABELS: Record<string, string> = {
  uop_complete: "UoP + ZAM + Z-3",
  jdg_no_90_days: "JDG · brak 90 dni",
  zlecenie_missing_z3a: "Zlecenie · brak Z-3a",
  employer_bankruptcy: "Upadłość pracodawcy",
};

export const FALLBACK_ORGANIZATIONS: Organization[] = [
  { id: 1, category: "strata", badge: "STRATA I ŻAŁOBA", name: "Fundacja Ernesta", description: "Bezpłatne wsparcie psychologiczne i prawne po stracie ciąży i dziecka.", phone: "22 123 00 80", website: "https://fundacjaernesta.pl", verified: 1 },
  { id: 2, category: "wczesniactwo", badge: "WCZEŚNIACTWO", name: "Fundacja Wcześniak", description: "Informacja, grupy wsparcia i pomoc rodzinom wcześniaków w szpitalach.", phone: "22 231 35 50", website: "https://wczesniak.pl", verified: 1 },
  { id: 3, category: "za_zyciem", badge: "WSPARCIE RODZINY", name: "Fundacja Dajemy Dzieciom Siłę", description: "Pomoc psychologiczna i prawna dla dzieci oraz opiekunów.", phone: "116 111", website: "https://fdds.pl", verified: 1 },
];

export function offlinePdfResult(filename: string): PdfCase {
  return {
    id: "offline-upload",
    filename,
    pages: 1,
    confidence: 0,
    text_layer: false,
    error: "Analiza PDF działa na serwerze. Uruchom API, aby odczytać tekst wniosku. Aplikacja nie podstawia kwot ani dat.",
    extracted: {
      insurance_title: "Nie odczytano",
      insurance_period: "Nie odczytano",
      base_amount: "Nie odczytano",
      base_amount_value: null,
      due_or_birth_date: null,
      requested_variant: "Nie odczytano",
      applicant_name: null,
      role: null,
      employment_type: null,
      insured_count: null,
    },
    completeness: { ok: false, title: "Brak analizy", detail: "Plik został wybrany, ale serwer nie odpowiedział. Nie pokazujemy przykładowych kwot." },
    decision: {
      approved: false,
      status_title: "ANALIZA NIEDOSTĘPNA",
      subtitle: "Połącz aplikację z API, aby odczytać tekst PDF. Dane nie zostały uzupełnione stałymi.",
      monthly_gross: "—",
      rate_note: "Brak wyliczenia",
      legal_basis: "Ustawa z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa.",
    },
  };
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function initMobywatel() {
  return request<AuthSession>("/api/auth/mobywatel/init", { method: "POST" });
}

export function confirmMobywatel(sessionId: string) {
  return request<{ authenticated: boolean; provider: string; user: AuthUser }>(`/api/auth/mobywatel/confirm/${sessionId}`, { method: "POST" });
}

export function getScenarios() {
  return request<Scenario[]>("/api/scenarios");
}

export function getScenario(scenarioId: string) {
  return request<Scenario>(`/api/scenarios/${scenarioId}`);
}

export function simulateBenefits(payload: CalculatorInput) {
  return request<BenefitPlan>("/api/calculator/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getPdfTestCases() {
  return request<PdfCase[]>("/api/pdf/test-cases");
}

export function verifyPdf(file: File) {
  const body = new FormData();
  body.append("file", file);
  return request<PdfCase>("/api/pdf/verify", { method: "POST", body }, 30000);
}

export function listOrganizations(query = "") {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request<Organization[]>(`/api/support/organizations${suffix}`);
}

export async function createOrganization(payload: OrgInput): Promise<{ org: Organization | null; offline: boolean; error: string | null }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${API_BASE}/api/support/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.ok) return { org: (await response.json()) as Organization, offline: false, error: null };
    const detail = await response.json().catch(() => null);
    const message = detail && typeof detail === "object" && "detail" in detail ? String(detail.detail) : "Nie udało się zapisać organizacji.";
    return { org: null, offline: false, error: message };
  } catch {
    return { org: null, offline: true, error: null };
  } finally {
    window.clearTimeout(timer);
  }
}

export function getLegislation() {
  return request<LegislationParams>("/api/admin/params");
}

export async function saveLegislation(payload: LegislationParams): Promise<{ params: LegislationParams | null; offline: boolean; error: string | null }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${API_BASE}/api/admin/params`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.ok) return { params: (await response.json()) as LegislationParams, offline: false, error: null };
    const detail = await response.json().catch(() => null);
    const message = detail && typeof detail === "object" && "detail" in detail ? String(detail.detail) : "Nie udało się zapisać parametrów.";
    return { params: null, offline: false, error: message };
  } catch {
    return { params: payload, offline: true, error: null };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function resetLegislation(): Promise<{ params: LegislationParams | null; offline: boolean }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${API_BASE}/api/admin/params/reset`, { method: "POST", signal: controller.signal });
    if (!response.ok) return { params: null, offline: false };
    return { params: (await response.json()) as LegislationParams, offline: false };
  } catch {
    return { params: { ...FALLBACK_LEGISLATION }, offline: true };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function downloadPdf(path: string, body: unknown, filename: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob.size || blob.type.includes("json")) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const header = response.headers.get("Content-Disposition") ?? "";
    const named = /filename="?([^";]+)"?/i.exec(header);
    link.href = url;
    link.download = named?.[1] || filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function removeOrganization(orgId: number): Promise<"deleted" | "missing" | "offline"> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${API_BASE}/api/support/organizations/${orgId}`, { method: "DELETE", signal: controller.signal });
    if (response.status === 404) return "missing";
    if (!response.ok) return "offline";
    return "deleted";
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timer);
  }
}
