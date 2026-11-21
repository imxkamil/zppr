export const API_BASE = "http://localhost:8000";
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
  total_weeks: number;
  total_months_approx: number;
  breakdown: {
    maternity_weeks: number;
    parental_weeks_mother: number;
    parental_weeks_father_exclusive: number;
    paternity_weeks: number;
    premature_weeks: number;
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
  start_before_birth: boolean;
  za_zyciem: boolean;
  premature_extra_weeks: number;
  variant: string;
  work_share: number;
  base_salary_gross: number;
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
    due_or_birth_date: string;
    requested_variant: string;
  };
  completeness: { ok: boolean; title: string; detail: string };
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

export function calculateLocally(payload: CalculatorInput, law: LegislationParams = FALLBACK_LEGISLATION): BenefitPlan {
  const grossBase = Math.max(0, finite(Number(payload.base_salary_gross), 8200));
  const variant = payload.variant || "81.5";
  const childrenCount = Math.min(5, Math.max(1, Math.round(finite(Number(payload.children_count), 1))));
  const workShare = Math.min(50, Math.max(0, finite(Number(payload.work_share), 0))) / 100;
  const zaZyciem = Boolean(payload.za_zyciem);
  const prematureWeeks = Math.min(52, Math.max(0, Math.round(finite(Number(payload.premature_extra_weeks), 0))));
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date) ? payload.due_date : "2026-09-18";
  const [year, month, day] = dueDate.split("-").map(Number);

  const maternityBase = finite(Number(law.maternity_weeks_single), 20);
  const weekShift = maternityBase - 20;
  const maternityMap: Record<number, number> = { 1: maternityBase, 2: 31 + weekShift, 3: 33 + weekShift, 4: 35 + weekShift, 5: 37 + weekShift };
  const maternityWeeks = Math.max(1, maternityMap[childrenCount] ?? maternityBase);
  const parentalBase = finite(Number(law.parental_weeks_single), 41);
  const parentalShift = parentalBase - 41;
  const parentalWeeks = Math.max(1, zaZyciem ? (childrenCount === 1 ? 65 : 67) + parentalShift : childrenCount === 1 ? parentalBase : parentalBase + 2);
  const paternityWeeks = Math.max(0, finite(Number(law.paternity_weeks), 2));
  const totalWeeks = maternityWeeks + parentalWeeks + paternityWeeks + prematureWeeks;
  const rateMaternity = (variant === "81.5" ? finite(Number(law.rate_single_variant), 81.5) : finite(Number(law.rate_maternity), 100)) / 100;
  const rateParental = variant === "81.5" ? rateMaternity : finite(Number(law.rate_parental), 70) / 100;
  const effectiveParentalRate = rateParental * (1 - workShare);
  const monthlyGrossMaternity = Math.round(grossBase * rateMaternity * 100) / 100;
  const monthlyGrossParental = Math.round(grossBase * effectiveParentalRate * 100) / 100;
  const monthlyNetMaternity = Math.round(monthlyGrossMaternity * 0.88 * 100) / 100;
  const maternityMonths = Math.round((maternityWeeks + prematureWeeks) / 4.33);
  const schedule: BenefitPlan["schedule"] = [];

  for (let idx = 0; idx < 12; idx += 1) {
    const monthIndex = month - 1 + idx;
    const y = year + Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    const fraction = idx === 0 && day > 1 ? (30 - day + 1) / 30 : 1;
    const isMaternity = idx < maternityMonths;
    const amount = Math.round((isMaternity ? monthlyGrossMaternity : monthlyGrossParental) * fraction * 100) / 100;
    schedule.push({
      month_label: `${MONTHS_PL[m - 1]} ${y}`,
      parent: "Anna",
      benefit_type: isMaternity ? "Macierzyński" : "Rodzicielski",
      rate: rateLabel(isMaternity ? rateMaternity : effectiveParentalRate),
      gross_amount: amount,
    });
  }

  return {
    monthly_gross: monthlyGrossMaternity,
    monthly_net: monthlyNetMaternity,
    total_weeks: totalWeeks,
    total_months_approx: Math.round(totalWeeks / 4.33),
    breakdown: {
      maternity_weeks: maternityWeeks,
      parental_weeks_mother: parentalWeeks - Math.min(9, parentalWeeks),
      parental_weeks_father_exclusive: Math.min(9, parentalWeeks),
      paternity_weeks: paternityWeeks,
      premature_weeks: prematureWeeks,
    },
    deadline_21_days: addDaysIso(dueDate, Math.max(1, finite(Number(law.deadline_days_81_5), 21))),
    schedule,
  };
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
    extracted: { insurance_title: "Umowa o pracę", insurance_period: "od 14.02.2022 – ciągły", base_amount: "8 200,00 zł", due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres" },
    completeness: { ok: true, title: "Dokumentacja kompletna", detail: "ZAM, Z-3 oraz akt urodzenia zostały rozpoznane." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE", subtitle: "Warunki do przyznania zasiłku macierzyńskiego zostały spełnione.", monthly_gross: "6 683,00 zł", rate_note: "81,5% podstawy wymiaru", legal_basis: "Ubezpieczona podlega ubezpieczeniu chorobowemu w dniu porodu. Wniosek o wypłatę w wysokości 81,5% złożono w terminie 21 dni (art. 30a ustawy zasiłkowej)." },
  },
  {
    id: "jdg_no_90_days",
    filename: "ZAM_JDG_Krotki_Staz_2026.pdf",
    pages: 2,
    confidence: 94,
    extracted: { insurance_title: "Pozarolnicza działalność gospodarcza (JDG)", insurance_period: "od 01.08.2026 (48 dni przed porodem)", base_amount: "6 500,00 zł", due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres" },
    completeness: { ok: true, title: "Dokumentacja kompletna (ZAM + akt urodzenia)", detail: "Dla JDG nie jest wymagane zaświadczenie Z-3." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE (WYJĄTEK OD 90 DNI)", subtitle: "Do zasiłku macierzyńskiego nie stosuje się 90-dniowego okresu wyczekiwania.", monthly_gross: "5 297,50 zł", rate_note: "81,5% zadeklarowanej podstawy (możliwa weryfikacja ZUS)", legal_basis: "Art. 29 ust. 1 pkt 1 ustawy zasiłkowej — prawo do zasiłku macierzyńskiego powstaje od pierwszego dnia podlegania dobrowolnemu ubezpieczeniu chorobowemu." },
  },
  {
    id: "zlecenie_missing_z3a",
    filename: "ZAM_Zlecenie_Brak_Z3a_2026.pdf",
    pages: 1,
    confidence: 91,
    extracted: { insurance_title: "Umowa zlecenie", insurance_period: "od 10.03.2025 – ciągły", base_amount: "Brak danych w aktach", due_or_birth_date: "18.09.2026", requested_variant: "100% + 70%" },
    completeness: { ok: false, title: "Brak zaświadczenia Z-3a od zleceniodawcy", detail: "Wykryto wniosek ZAM, ale brakuje zaświadczenia płatnika składek Z-3a niezbędnego do ustalenia podstawy." },
    decision: { approved: false, status_title: "POSTĘPOWANIE DO UZUPEŁNIENIA", subtitle: "ZUS wezwie płatnika lub ubezpieczoną do złożenia formularza Z-3a (termin 7 dni).", monthly_gross: "Do wyliczenia po wpływie Z-3a", rate_note: "Wariant 100% (20 tyg.) + 70% (32 tyg.)", legal_basis: "§ 2 rozporządzenia MRPiPS w sprawie zakresu informacji o okolicznościach mających wpływ na prawo do zasiłków." },
  },
  {
    id: "employer_bankruptcy",
    filename: "ZAM_Upadlosc_Pracodawcy_2026.pdf",
    pages: 4,
    confidence: 95,
    extracted: { insurance_title: "Umowa o pracę (rozwiązana z powodu upadłości)", insurance_period: "01.03.2021 – 15.07.2026 (likwidacja pracodawcy)", base_amount: "7 800,00 zł", due_or_birth_date: "18.09.2026", requested_variant: "81,5% przez cały okres" },
    completeness: { ok: true, title: "Dokumentacja kompletna + postanowienie sądu", detail: "Rozpoznano ZAM, świadectwo pracy oraz odpis postanowienia o ogłoszeniu upadłości." },
    decision: { approved: true, status_title: "PRAWO PRZYZNANE (ART. 30 UST. 1)", subtitle: "Szczególna ochrona w razie ustania zatrudnienia w ciąży z powodu upadłości/likwidacji.", monthly_gross: "6 357,00 zł", rate_note: "Wypłata bezpośrednio przez ZUS", legal_basis: "Art. 30 ust. 1 pkt 1 ustawy zasiłkowej — zasiłek macierzyński przysługuje również w razie urodzenia dziecka po ustaniu ubezpieczenia chorobowego z powodu ogłoszenia upadłości lub likwidacji pracodawcy." },
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
    confidence: 70,
    extracted: {
      insurance_title: "Odczyt lokalny niedostępny",
      insurance_period: "Backend na localhost:8000 nie odpowiada",
      base_amount: "8 200,00 zł",
      due_or_birth_date: "18.09.2026",
      requested_variant: "81,5% przez cały okres",
    },
    completeness: { ok: false, title: "Tryb offline", detail: "Plik został wybrany, ale analiza PDF działa po uruchomieniu backendu. Poniżej pokazano przykładową symulację." },
    decision: {
      approved: false,
      status_title: "PODGLĄD OFFLINE",
      subtitle: "Połącz aplikację z API, aby odczytać tekst PDF i ocenić kompletność wniosku.",
      monthly_gross: "6 683,00 zł",
      rate_note: "Przykład: 81,5% podstawy 8 200 zł",
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
