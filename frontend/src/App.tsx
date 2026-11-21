import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import zusOfficialLogo from "./assets/logo-zus-official.svg";
import {
  FALLBACK_LEGISLATION,
  FALLBACK_ORGANIZATIONS,
  FALLBACK_PDF_CASES,
  FALLBACK_SCENARIOS,
  PDF_CHIP_LABELS,
  SIMULATION_AS_OF,
  addDaysIso,
  calculateLocally,
  parsePlnAmount,
  supplementaryWeeks,
  confirmMobywatel,
  createOrganization,
  daysBetween,
  downloadPdf,
  formatLongPl,
  formatPlDate,
  formatRate,
  getLegislation,
  getPdfTestCases,
  getScenario,
  getScenarios,
  initMobywatel,
  listOrganizations,
  offlinePdfResult,
  removeOrganization,
  resetLegislation,
  saveLegislation,
  simulateBenefits,
  verifyPdf,
  type AuthUser,
  type BenefitPlan,
  type CalculatorInput,
  type LegislationParams,
  type Organization,
  type OrgInput,
  type PdfCase,
  type Scenario,
} from "./api";

type View = "status" | "calculator" | "pdf" | "documents" | "support";
type AuthStep = "portal-entry" | "login-gov-mobywatel" | "authenticating" | "authenticated-dashboard";
type IconName =
  | "home"
  | "calculator"
  | "file"
  | "clipboard"
  | "heart"
  | "shield"
  | "check"
  | "alert"
  | "info"
  | "user"
  | "link"
  | "chevron"
  | "arrow"
  | "upload"
  | "sparkles"
  | "calendar"
  | "clock"
  | "external"
  | "phone"
  | "search"
  | "settings"
  | "download"
  | "plus"
  | "lock";

const icons: Record<IconName, ReactNode> = {
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  calculator: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h6M9 9h1" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 22c0-4 3.6-7 8-7s8 3 8 7" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
  sparkles: <><path d="m12 3 1.4 4.1L17.5 8l-4.1 1.4L12 13.5l-1.4-4.1L6.5 8l4.1-1.4L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v7H4V6h7" /></>,
  phone: <path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2A16 16 0 0 1 3 5c0-1.1.9-2 2-2Z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const navItems: { id: View; label: string; short: string; icon: IconName }[] = [
  { id: "status", label: "Mój Status i Symulacja eZUS", short: "Mój status", icon: "home" },
  { id: "calculator", label: "Zintegrowany Kalkulator Zasiłków", short: "Kalkulator", icon: "calculator" },
  { id: "pdf", label: "Weryfikator Spraw PDF (Test ZUS)", short: "Weryfikator PDF", icon: "file" },
  { id: "documents", label: "Wnioski, Dokumenty i Terminy", short: "Dokumenty", icon: "clipboard" },
  { id: "support", label: "Strefa Wsparcia i Sytuacje Trudne", short: "Wsparcie", icon: "heart" },
];

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Button({ children, variant = "primary", icon, onClick, className = "", type = "button", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost"; icon?: IconName; onClick?: () => void; className?: string; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={17} />}{children}</button>;
}

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function pln(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function employmentFor(scenario: Scenario) {
  if (scenario.id.includes("jdg")) return "jdg";
  if (scenario.id.includes("zlecenie")) return "zlecenie";
  return "uop";
}

function insuredFor(employment: string) {
  if (employment === "jdg") return 1;
  if (employment === "zlecenie") return 12;
  if (employment === "ustanie") return 8;
  return 25;
}

function toIsoDate(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function blankNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function pagesLabel(count: number) {
  if (count === 1) return "1 strona";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} strony`;
  return `${count} stron`;
}

const RISK_TONE: Record<string, "warning" | "info" | "success"> = { warning: "warning", info: "info", ok: "success" };
const RISK_ICON: Record<string, IconName> = { warning: "clock", info: "alert", ok: "shield" };
const ORG_BADGES: Record<string, string> = {
  strata: "STRATA I ŻAŁOBA",
  wczesniactwo: "WCZEŚNIACTWO",
  za_zyciem: "WSPARCIE RODZINY",
  inne: "WSPARCIE",
};

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PageIntro({ step, title, description, children }: { step: string; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{step}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function AiInfo({ focus }: { focus: "risks" | "pdf" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-info">
      <button type="button" className="ai-trigger" onClick={() => setOpen(true)}><Icon name="sparkles" size={16} /> Jak działa AI w tym module?</button>
      {open && <AiExplainer focus={focus} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AiExplainer({ focus, onClose }: { focus: "risks" | "pdf"; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">SZTUCZNA INTELIGENCJA · PKT 4 I 9 REGULAMINU</p>
            <h2 id="ai-title">{focus === "pdf" ? "Jak AI czyta dokumenty PDF" : "Jak AI wskazuje ryzyka w radarze"}</h2>
            <p>Model podpowiada. Decyzję wydaje płatnik albo ZUS.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="ai-explainer">
          <article>
            <h3>Ekstrakcja pól z PDF</h3>
            <p>Najpierw PyMuPDF wyciąga tekst, a lokalny parser czyta z niego imię i rolę, datę porodu albo przyjęcia, podstawę, tytuł ubezpieczenia i liczbę ubezpieczonych. Ten odczyt jest powtarzalny i nie podstawia kwot, gdy pola nie ma w pliku.</p>
            <p>Gdy ustawiony jest klucz <strong>GEMINI_API_KEY</strong>, model <strong>Gemini 2.5 Flash</strong> uzupełnia tylko puste pola, a przy skanie bez warstwy tekstowej może zrobić OCR. Bez klucza skan kończy się komunikatem o braku OCR. Kalkulator liczy już odczytaną podstawę po odjęciu 13,71%.</p>
          </article>
          <article>
            <h3>Radar ryzyk prawnych</h3>
            <p>Karty ryzyka nie są swobodną odpowiedzią czatu. Dla wybranego scenariusza silnik dokłada reguły kontekstu:</p>
            <ul>
              <li>ciągłość ubezpieczenia do dnia porodu,</li>
              <li>nagłe podwyższenie podstawy składek przed porodem,</li>
              <li>zadłużenie JDG powyżej 1% minimalnego wynagrodzenia, które wstrzymuje wypłatę.</li>
            </ul>
          </article>
          <p className="muted">Kalkulator obejmuje stan prawny 2026: Kodeks pracy (Dz.U. 2026 poz. 1245) i ustawę zasiłkową (Dz.U. 2026 poz. 854), w tym urlop przed porodem, uzupełniający urlop macierzyński, adopcję, pieczę, łączenie z pracą i świadczenie rehabilitacyjne. Wymiary i stawki bazowe biorą się z SQLite, a sam wzór nie wywołuje modelu.</p>
        </div>
        <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Zamknij</Button></div>
      </div>
    </div>
  );
}

function StatusView({ goTo, scenario, legislation }: { goTo: (view: View) => void; scenario: Scenario; legislation: LegislationParams }) {
  const waitingOk = scenario.waiting_period.ok;
  const hasDebt = scenario.payer_account.has_debt;
  const accountWarning = !waitingOk || hasDebt;
  const usedShare = scenario.ezla.days_limit ? Math.min(100, Math.round((scenario.ezla.days_used / scenario.ezla.days_limit) * 100)) : 0;
  const daysLeft = daysBetween(SIMULATION_AS_OF, scenario.due_date);
  return (
    <>
      <PageIntro step="KROK 1 Z 4 · TWÓJ PUNKT STARTOWY" title={`Dzień dobry, ${scenario.first_name}`} description="Sprawdź, co wynika z Twojego ubezpieczenia i na co warto zwrócić uwagę przed złożeniem wniosku.">
        <div className="last-sync"><span className="status-dot" /> Dane symulacyjne aktualne na <strong>12.06.2026, 10:42</strong></div>
      </PageIntro>

      <section className="status-hero card">
        <div className="status-main">
          <div className="status-icon"><Icon name="shield" size={27} /></div>
          <div>
            <div className="inline-heading"><h2>Ubezpieczenie chorobowe: {waitingOk ? "aktywne" : "weryfikacja"}</h2><Badge tone={waitingOk ? "success" : "warning"}>{waitingOk ? "POTWIERDZONE" : "RYZYKO ODMOWY"}</Badge></div>
            <p>{scenario.insurance_type}</p>
          </div>
        </div>
        <div className="status-metrics">
          <div><span>Okres wyczekiwania</span><strong className={waitingOk ? "" : "danger-text"}>{scenario.waiting_period.status}</strong><small>{scenario.waiting_period.note}</small></div>
          <div><span>Płatnik zasiłku</span><strong>{scenario.benefit_payer.title}</strong><small>{scenario.benefit_payer.note}</small></div>
          <div><span>Prognozowany poród</span><strong className="tabular">{formatPlDate(scenario.due_date)}</strong><small>{daysLeft >= 0 ? `za ${daysLeft} dni` : `${Math.abs(daysLeft)} dni po terminie`}</small></div>
        </div>
        <div className="payer-strip"><Icon name="info" size={18} /><span>{scenario.benefit_payer.is_zus ? <><strong>Płatnikiem świadczenia jest {scenario.benefit_payer.title}</strong> — {scenario.benefit_payer.note}. Dokumenty przekazujesz elektronicznie przez PUE/eZUS.</> : <><strong>Płatnik składek: {scenario.benefit_payer.title}</strong> — {scenario.benefit_payer.note}. Zasiłek wypłaca pracodawca.</>}</span><button type="button" onClick={() => goTo("documents")}>Zobacz ścieżkę dokumentów <Icon name="arrow" size={15} /></button></div>
      </section>

      <div className="dashboard-grid">
        <section className="card account-card">
          <SectionHeader eyebrow="KONTO PŁATNIKA" title="Składki i zadłużenie" />
          <div className={`account-ok ${accountWarning ? "account-warning" : ""}`}><Icon name={accountWarning ? "alert" : "check"} size={20} /><div><strong>{!waitingOk ? scenario.waiting_period.status : hasDebt ? "Zadłużenie na koncie płatnika" : "Saldo składek sprawdzone"}</strong><span>{waitingOk ? scenario.payer_account.note : scenario.waiting_period.note}</span></div></div>
          <p className="helper">W przypadku działalności gospodarczej zadłużenie przekraczające 1% minimalnego wynagrodzenia może wstrzymać wypłatę do czasu spłaty.</p>
          <button type="button" className="text-link" onClick={() => goTo("calculator")}>Sprawdź podstawę w kalkulatorze <Icon name="chevron" size={14} /></button>
        </section>

        <section className="card zla-card">
          <SectionHeader eyebrow="E-ZLA · OSTATNIE ZAŚWIADCZENIE" title="Zwolnienie lekarskie w ciąży" action={<Badge tone="info">{scenario.ezla.code}</Badge>} />
          <div className="zla-row">
            <div><span>Okres</span><strong className="tabular">{scenario.ezla.period}</strong></div>
            <div><span>Dni wykorzystane</span><strong className="tabular">{scenario.ezla.days_used} z {scenario.ezla.days_limit}</strong></div>
            <div><span>Pozostało</span><strong className="tabular green">{scenario.ezla.days_left} dni</strong></div>
          </div>
          <div className="progress-label"><span>Okres zasiłkowy</span><strong>{usedShare}%</strong></div>
          <div className="progress"><span style={{ width: `${usedShare}%` }} /></div>
          {scenario.ezla.days_used > 0 ? (
            <div className="benefit-track"><span className="done"><Icon name="check" size={14} /> 33 dni · wynagrodzenie chorobowe</span><span className="active"><span /> od 34. dnia · zasiłek chorobowy FUS</span></div>
          ) : (
            <div className="benefit-track"><span className="active"><span /> Brak aktywnego e-ZLA w tym scenariuszu</span></div>
          )}
        </section>
      </div>

      <section className="risk-section">
        <SectionHeader eyebrow="RADAR RYZYK I PUŁAPEK" title={`${scenario.risks.length} ${scenario.risks.length === 1 ? "rzecz" : "rzeczy"}, które warto sprawdzić teraz`} action={<AiInfo focus="risks" />} />
        <div className="risk-grid">
          {scenario.risks.map((risk) => (
            <article className={`risk-card ${risk.level === "ok" ? "success" : risk.level}`} key={risk.title}>
              <div className="risk-top"><span className="risk-icon"><Icon name={RISK_ICON[risk.level] ?? "alert"} /></span><Badge tone={RISK_TONE[risk.level] ?? "warning"}>{risk.badge}</Badge></div>
              <h3>{risk.title}</h3>
              <p>{risk.desc}</p>
              <button type="button" className="text-link" onClick={() => goTo(risk.level === "ok" ? "documents" : "calculator")}>Zobacz w scenariuszu <Icon name="arrow" size={14} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="next-step">
        <div><span className="step-number">2</span><div><p className="eyebrow">NASTĘPNY KROK</p><h3>Oblicz wysokość i okres wypłaty</h3><p>Porównaj wariant {formatRate(legislation.rate_single_variant)} z podziałem {formatRate(legislation.rate_maternity)} + {formatRate(legislation.rate_parental)}.</p></div></div>
        <Button onClick={() => goTo("calculator")} icon="calculator">Przejdź do kalkulatora</Button>
      </section>
    </>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button></label>;
}

function CalculatorView({ scenario, legislation, pdfCase }: { scenario: Scenario; legislation: LegislationParams; pdfCase: PdfCase | null }) {
  const [benefitKind, setBenefitKind] = useState("birth");
  const [children, setChildren] = useState("1");
  const [base, setBase] = useState(scenario.base_salary_gross);
  const [option, setOption] = useState("81.5");
  const [life, setLife] = useState(false);
  const [etat, setEtat] = useState(0);
  const [combineWeeks, setCombineWeeks] = useState("0");
  const [employment, setEmployment] = useState(employmentFor(scenario));
  const [due, setDue] = useState(scenario.due_date);
  const [preWeeks, setPreWeeks] = useState(0);
  const [gestation, setGestation] = useState("");
  const [grams, setGrams] = useState("");
  const [hospitalDays, setHospitalDays] = useState("");
  const [stayFrom, setStayFrom] = useState("");
  const [stayTo, setStayTo] = useState("");
  const [contractFte, setContractFte] = useState("1");
  const [childAge, setChildAge] = useState("");
  const [schoolDeferral, setSchoolDeferral] = useState(false);
  const [parentName, setParentName] = useState(scenario.first_name);
  const [secondParent, setSecondParent] = useState("");
  const [role, setRole] = useState("matka");
  const [insured, setInsured] = useState(insuredFor(employmentFor(scenario)));
  const [insuredAge, setInsuredAge] = useState("");
  const [sickDays, setSickDays] = useState("100");
  const [rehabMonths, setRehabMonths] = useState("0");
  const [rehabPregnant, setRehabPregnant] = useState(true);
  const [waitingDays, setWaitingDays] = useState("");
  const [debt, setDebt] = useState("0");
  const [motherUnavailable, setMotherUnavailable] = useState(false);
  const [paternity, setPaternity] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [imported, setImported] = useState("");
  const [remotePlan, setRemotePlan] = useState<BenefitPlan | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");

  useEffect(() => {
    const nextEmployment = employmentFor(scenario);
    setBase(scenario.base_salary_gross);
    setEmployment(nextEmployment);
    setInsured(insuredFor(nextEmployment));
    setDue(scenario.due_date);
    setParentName(scenario.first_name);
    setSecondParent("");
    setImported("");
  }, [scenario.id, scenario.base_salary_gross, scenario.due_date, scenario.user_name, scenario.first_name]);

  const payload = useMemo<CalculatorInput>(() => ({
    benefit_type: benefitKind === "pregnancy" ? "ciaza_l4" : benefitKind === "adoption" ? "adopcja" : benefitKind === "foster" ? "piecza" : "porod",
    employment_type: employment,
    children_count: Number(children) || 1,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "",
    za_zyciem: life,
    variant: option === "81.5" ? "81.5" : "100_70",
    base_salary_gross: Number.isFinite(base) ? base : 0,
    parent_name: parentName,
    second_parent_name: secondParent,
    parent_role: role,
    tygodnie_przed_porodem: preWeeks,
    tydzien_ciazy_porodu: blankNumber(gestation),
    masa_urodzeniowa_g: blankNumber(grams),
    dni_w_szpitalu: blankNumber(hospitalDays),
    hospitalizacja_od_dnia: blankNumber(stayFrom),
    hospitalizacja_do_dnia: blankNumber(stayTo),
    wymiar_etatu: blankNumber(contractFte) ?? 1,
    etat_pracy: employment === "uop" ? etat : 0,
    tygodnie_laczenia: blankNumber(combineWeeks),
    wiek_dziecka_lata: blankNumber(childAge),
    odroczenie_obowiazku_szkolnego: schoolDeferral,
    liczba_ubezpieczonych: insured,
    wiek_ubezpieczonego: blankNumber(insuredAge),
    dni_niezdolnosci: Number(sickDays) || 0,
    miesiace_rehabilitacji: Number(rehabMonths) || 0,
    rehabilitacja_w_ciazy: rehabPregnant,
    waiting_days: blankNumber(waitingDays),
    debt_amount: Number(debt) || 0,
    matka_nie_moze_opiekowac: motherUnavailable,
    include_paternity: paternity,
  }), [benefitKind, employment, children, due, life, option, base, parentName, secondParent, role, preWeeks, gestation, grams, hospitalDays, stayFrom, stayTo, contractFte, etat, combineWeeks, childAge, schoolDeferral, insured, insuredAge, sickDays, rehabMonths, rehabPregnant, waitingDays, debt, motherUnavailable, paternity]);

  const localPlan = useMemo(() => calculateLocally(payload, legislation), [payload, legislation]);

  useEffect(() => {
    let cancelled = false;
    setRemotePlan(null);
    const timer = window.setTimeout(() => {
      simulateBenefits(payload).then((plan) => {
        if (!cancelled) setRemotePlan(plan);
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payload, legislation]);

  const plan = remotePlan ?? localPlan;
  const breakdown = plan.breakdown;
  const hospitalPreview = supplementaryWeeks(blankNumber(gestation), blankNumber(grams), blankNumber(hospitalDays), blankNumber(stayFrom), blankNumber(stayTo));
  const extensionWeeks = breakdown.extension_weeks ?? 0;
  const maternitySpan = (breakdown.pre_birth_weeks ?? 0) + breakdown.maternity_weeks + breakdown.premature_weeks;
  const motherShare = breakdown.parental_weeks_mother + (role === "ojciec" ? 0 : extensionWeeks);
  const fatherShare = breakdown.parental_weeks_father_exclusive + (role === "ojciec" ? extensionWeeks : 0);
  const span = Math.max(1, maternitySpan + motherShare + fatherShare + breakdown.paternity_weeks);
  const pct = (weeks: number) => `${(weeks / span) * 100}%`;
  const maternityRate = option === "81.5" ? formatRate(legislation.rate_single_variant) : formatRate(legislation.rate_maternity);
  const singleLabel = formatRate(legislation.rate_single_variant);
  const splitLabel = `${formatRate(legislation.rate_maternity)} + ${formatRate(legislation.rate_parental)}`;
  const rows = showAll ? plan.schedule : plan.schedule.slice(0, 4);
  const childCount = Number(children) || 1;

  async function downloadPlan() {
    setExporting(true);
    setExportNote("");
    const saved = await downloadPdf("/api/export/calculator-pdf", {
      ...payload,
      scenario_label: scenario.label,
    }, "plan-swiadczen.pdf");
    setExporting(false);
    if (!saved) {
      setExportNote("Brak połączenia z API — otwarto podgląd wydruku.");
      window.print();
    }
  }

  function importParsed() {
    const extracted = pdfCase?.extracted;
    if (!pdfCase || !extracted) {
      setImported("Najpierw wgraj PDF albo wybierz sprawę w weryfikatorze. Formularz zostaje bez zmian i nie bierze kwoty ze scenariusza.");
      return;
    }
    const amount = extracted.base_amount_value ?? parsePlnAmount(extracted.base_amount);
    const iso = toIsoDate(extracted.due_or_birth_date);
    if (pdfCase.error && amount == null && !iso && !extracted.applicant_name) {
      setImported(pdfCase.error);
      return;
    }
    if (amount == null && !iso && !extracted.applicant_name) {
      setImported("W tym dokumencie nie ma kwoty, daty ani nazwiska. Nic nie zostało podstawione.");
      return;
    }
    if (amount != null) setBase(amount);
    if (iso) setDue(iso);
    if (extracted.employment_type && ["uop", "jdg", "zlecenie", "ustanie"].includes(extracted.employment_type)) setEmployment(extracted.employment_type);
    if (extracted.applicant_name) setParentName(extracted.applicant_name);
    if (extracted.role === "matka" || extracted.role === "ojciec" || extracted.role === "opiekun") setRole(extracted.role);
    if (typeof extracted.insured_count === "number") setInsured(extracted.insured_count);
    if ((extracted.requested_variant || "").includes("100")) setOption("100_70");
    else if ((extracted.requested_variant || "").includes("81")) setOption("81.5");
    const missing = [amount == null ? "podstawy" : "", iso ? "" : "daty"].filter(Boolean).join(" i ");
    setImported(missing ? `Wczytano ${pdfCase.filename}. Brak ${missing} w pliku — tych pól nie zmieniam.` : `Wczytano dane z ${pdfCase.filename}.`);
  }

  function resetForm() {
    const nextEmployment = employmentFor(scenario);
    setBenefitKind("birth");
    setChildren("1");
    setBase(scenario.base_salary_gross);
    setOption("81.5");
    setLife(false);
    setEtat(0);
    setCombineWeeks("0");
    setEmployment(nextEmployment);
    setInsured(insuredFor(nextEmployment));
    setDue(scenario.due_date);
    setPreWeeks(0);
    setGestation("");
    setGrams("");
    setHospitalDays("");
    setStayFrom("");
    setStayTo("");
    setContractFte("1");
    setChildAge("");
    setSchoolDeferral(false);
    setParentName(scenario.first_name);
    setSecondParent("");
    setRole("matka");
    setInsuredAge("");
    setSickDays("100");
    setRehabMonths("0");
    setRehabPregnant(true);
    setWaitingDays("");
    setDebt("0");
    setMotherUnavailable(false);
    setPaternity(true);
    setImported("");
    setShowAll(false);
  }

  return (
    <>
      <PageIntro step="KROK 2 Z 4 · KALKULATOR" title="Zaplanuj świadczenia i czas opieki" description="Porównaj dostępne warianty, podziel opiekę między rodziców i zobacz prognozę wypłat miesiąc po miesiącu.">
        <Badge tone="neutral"><Icon name="lock" size={14} /> Obliczenia nie są zapisywane</Badge>
      </PageIntro>
      <div className="calculator-layout">
        <aside className="config-panel card">
          <div className="panel-head"><div><span className="step-bubble">1</span><div><h2>Ustaw scenariusz</h2><p>Dopasuj dane do swojej sytuacji</p></div></div><button type="button" className="reset-button" onClick={resetForm}>Wyczyść</button></div>
          <div className="field-group">
            <label>Rodzaj świadczenia</label>
            <div className="scenario-tabs">
              <button type="button" className={benefitKind === "birth" ? "active" : ""} onClick={() => setBenefitKind("birth")}>Poród</button>
              <button type="button" className={benefitKind === "pregnancy" ? "active" : ""} onClick={() => setBenefitKind("pregnancy")}>Ciąża L4 + rehabilitacyjne</button>
              <button type="button" className={benefitKind === "adoption" ? "active" : ""} onClick={() => setBenefitKind("adoption")}>Adopcja</button>
              <button type="button" className={benefitKind === "foster" ? "active" : ""} onClick={() => setBenefitKind("foster")}>Piecza zastępcza</button>
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="employment">Forma zatrudnienia</label>
            <select id="employment" value={employment} onChange={(e) => { setEmployment(e.target.value); setInsured(insuredFor(e.target.value)); }}>
              <option value="uop">Umowa o pracę</option>
              <option value="zlecenie">Umowa zlecenie</option>
              <option value="jdg">Działalność gospodarcza (JDG)</option>
              <option value="ustanie">Ustanie zatrudnienia (upadłość/likwidacja)</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="children">Liczba dzieci przy jednym porodzie</label>
            <select id="children" value={children} onChange={(e) => setChildren(e.target.value)}>
              <option value="1">1 dziecko · {legislation.maternity_weeks_single} tyg. macierzyńskiego</option><option value="2">2 dzieci · {31 + legislation.maternity_weeks_single - 20} tygodni</option><option value="3">3 dzieci · {33 + legislation.maternity_weeks_single - 20} tygodnie</option><option value="4">4 dzieci · {35 + legislation.maternity_weeks_single - 20} tygodni</option><option value="5">5+ dzieci · {37 + legislation.maternity_weeks_single - 20} tygodni</option>
            </select>
          </div>
          <div className="two-fields">
            <div className="field-group"><label htmlFor="parent-name">Imię i nazwisko wnioskodawcy</label><input id="parent-name" value={parentName} onChange={(e) => setParentName(e.target.value)} /></div>
            <div className="field-group"><label htmlFor="second-parent">Drugi rodzic</label><input id="second-parent" value={secondParent} placeholder="Ojciec" onChange={(e) => setSecondParent(e.target.value)} /></div>
          </div>
          <div className="two-fields">
            <div className="field-group"><label htmlFor="role">Rola wnioskodawcy</label><select id="role" value={role} onChange={(e) => setRole(e.target.value)}><option value="matka">Matka</option><option value="ojciec">Ojciec</option><option value="opiekun">Opiekun</option></select></div>
            <div className="field-group"><label htmlFor="birthdate">{benefitKind === "pregnancy" ? "Początek zwolnienia" : benefitKind === "birth" ? "Data porodu" : "Data przyjęcia dziecka"}</label><div className="input-icon"><Icon name="calendar" size={17} /><input id="birthdate" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div></div>
          </div>
          {(benefitKind === "adoption" || benefitKind === "foster") && (
            <div className="law-block">
              <h3>{benefitKind === "adoption" ? "Wiek dziecka przy adopcji (limit 14 lat)" : "Wiek dziecka w pieczy (limit 7 lat, 10 przy odroczeniu)"}</h3>
              <div className="two-fields">
                <div className="field-group"><label htmlFor="child-age">Wiek dziecka w latach</label><input id="child-age" type="number" min="0" max="18" step="0.01" value={childAge} onChange={(e) => setChildAge(e.target.value)} /></div>
                {benefitKind === "foster" && <Toggle checked={schoolDeferral} onChange={setSchoolDeferral} label="Odroczenie obowiązku szkolnego" hint="Podnosi limit wieku do 10 lat" />}
              </div>
            </div>
          )}
          {benefitKind === "birth" && (
            <div className="law-block">
              <h3>Urlop przed porodem (art. 180 § 2–3 KP)</h3>
              <div className="label-line"><label htmlFor="pre-weeks">Tygodnie urlopu przed porodem (0–6)</label><strong>{preWeeks} tyg. · 100%</strong></div>
              <input id="pre-weeks" type="range" min="0" max="6" step="1" value={preWeeks} onChange={(e) => setPreWeeks(Number(e.target.value))} />
            </div>
          )}
          {benefitKind === "birth" && (
            <div className="law-block">
              <h3>Hospitalizacja noworodka / wcześniactwo</h3>
              <div className="triple-fields">
                <div className="field-group"><label htmlFor="gestation">Tydzień ciąży</label><input id="gestation" type="number" min="20" max="42" value={gestation} onChange={(e) => setGestation(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="grams">Masa (g)</label><input id="grams" type="number" min="0" value={grams} onChange={(e) => setGrams(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="hospital-days">Dni w szpitalu</label><input id="hospital-days" type="number" min="0" value={hospitalDays} onChange={(e) => setHospitalDays(e.target.value)} /></div>
              </div>
              <div className="two-fields">
                <div className="field-group"><label htmlFor="stay-from">Pobyt od dnia życia</label><input id="stay-from" type="number" min="1" max="28" value={stayFrom} onChange={(e) => setStayFrom(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="stay-to">Pobyt do dnia życia</label><input id="stay-to" type="number" min="1" max="40" value={stayTo} onChange={(e) => setStayTo(e.target.value)} /></div>
              </div>
              <p className="import-note">Uzupełniający urlop: {hospitalPreview} tyg. · płatne 100% i poza uśrednieniem 81,5%. Od 37. tygodnia liczą się co najmniej 2 dni między 5. a 28. dniem życia.</p>
            </div>
          )}
          {benefitKind === "pregnancy" && (
            <div className="law-block">
              <h3>Ciąża, e-ZLA kod B i świadczenie rehabilitacyjne</h3>
              <div className="triple-fields">
                <div className="field-group"><label htmlFor="insured-age">Wiek ubezpieczonej</label><input id="insured-age" type="number" min="15" max="80" value={insuredAge} onChange={(e) => setInsuredAge(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="sick-days">Dni niezdolności</label><input id="sick-days" type="number" min="0" max="400" value={sickDays} onChange={(e) => setSickDays(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="rehab-months">Miesiące rehabilitacji</label><input id="rehab-months" type="number" min="0" max="12" value={rehabMonths} onChange={(e) => setRehabMonths(e.target.value)} /></div>
              </div>
              <Toggle checked={rehabPregnant} onChange={setRehabPregnant} label="Rehabilitacja nadal w ciąży" hint="100% podstawy. Poza ciążą: 90% przez 90 dni, potem 75%." />
              {(employment === "jdg" || employment === "zlecenie") && (
                <div className="field-group"><label htmlFor="waiting">Dni podlegania dobrowolnemu ubezpieczeniu</label><input id="waiting" type="number" min="0" value={waitingDays} onChange={(e) => setWaitingDays(e.target.value)} /></div>
              )}
            </div>
          )}
          <div className="toggle-box">
            <Toggle checked={life} onChange={setLife} label="Zaświadczenie „Za życiem”" hint="Urlop rodzicielski 65/67 tygodni, a przy gwarancji minimalnej 62 tygodnie" />
            <Toggle checked={paternity} onChange={setPaternity} label="Urlop ojcowski" hint="2 tygodnie, 100% podstawy, do 12. miesiąca życia albo 14. roku przy adopcji" />
            <Toggle checked={motherUnavailable} onChange={setMotherUnavailable} label="Matka nie może sprawować opieki" hint="Wtedy pierwsze 14 tygodni może wykorzystać ojciec" />
          </div>
          <div className="field-group">
            <label>Wariant wypłaty</label>
            <label className={`radio-card ${option === "81.5" ? "selected" : ""}`}><input type="radio" name="variant" checked={option === "81.5"} onChange={() => setOption("81.5")} /><span><strong>{singleLabel} przez cały okres</strong><small>Wniosek do {legislation.deadline_days_81_5} dni po porodzie</small></span><Badge tone="success">STABILNY</Badge></label>
            <label className={`radio-card ${option === "100_70" ? "selected" : ""}`}><input type="radio" name="variant" checked={option === "100_70"} onChange={() => setOption("100_70")} /><span><strong>{splitLabel}</strong><small>Macierzyński {formatRate(legislation.rate_maternity)}, rodzicielski {formatRate(legislation.rate_parental)}</small></span></label>
          </div>
          <div className="law-block">
            <h3>Łączenie urlopu rodzicielskiego z pracą</h3>
            <div className="label-line"><label htmlFor="work">Wymiar etatu (0–0,5)</label><strong>{etat.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}</strong></div>
            <input id="work" type="range" min="0" max="0.5" step="0.1" value={etat} disabled={employment !== "uop"} onChange={(e) => setEtat(Number(e.target.value))} />
            <div className="field-group"><label htmlFor="combine-weeks">Tygodnie łączenia</label><input id="combine-weeks" type="number" min="0" max="134" step="1" value={combineWeeks} disabled={employment !== "uop" || etat === 0} onChange={(e) => setCombineWeeks(e.target.value)} /></div>
            {employment !== "uop" && <p className="form-error">Łączenie z pracą jest dostępne tylko przy umowie o pracę.</p>}
          </div>
          <div className="two-fields">
            <div className="field-group">
              <label htmlFor="payer-size">Wielkość płatnika</label>
              <select id="payer-size" value={insured > 20 ? "over" : "under"} onChange={(e) => setInsured(e.target.value === "over" ? 21 : 20)}>
                <option value="under">Do 20 ubezpieczonych</option>
                <option value="over">Powyżej 20 ubezpieczonych</option>
              </select>
            </div>
            <div className="field-group"><label htmlFor="insured-count">Liczba ubezpieczonych</label><input id="insured-count" type="number" min="0" value={insured} onChange={(e) => setInsured(Number(e.target.value) || 0)} /></div>
          </div>
          {(employment === "jdg" || employment === "zlecenie") && (
            <div className="field-group"><label htmlFor="debt">Zadłużenie wobec ZUS (zł)</label><input id="debt" type="number" min="0" step="0.01" value={debt} onChange={(e) => setDebt(e.target.value)} /></div>
          )}
          <div className="field-group">
            <label htmlFor="contract-fte">Wymiar etatu w umowie</label>
            <select id="contract-fte" value={contractFte} onChange={(e) => setContractFte(e.target.value)}>
              <option value="1">Pełny etat</option>
              <option value="0.75">3/4 etatu</option>
              <option value="0.5">1/2 etatu</option>
              <option value="0.25">1/4 etatu</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="base">Wynagrodzenie lub przychód brutto przed odliczeniem 13,71%</label>
            <div className="money-input"><input id="base" type="number" min="0" value={Number.isFinite(base) ? base : 0} onChange={(e) => setBase(e.target.value === "" ? 0 : Number(e.target.value))} /><span>PLN</span></div>
            <button type="button" className="import-button" onClick={importParsed}><Icon name="download" size={15} /> Importuj z symulacji ZUS / PDF</button>
            {imported && <p className={imported.startsWith("Wczytano") ? "import-note" : "form-error"}>{imported}</p>}
          </div>
        </aside>

        <main className="results-panel">
          <div className="result-heading"><div><span className="step-bubble">2</span><div><h2>Twój plan świadczeń</h2><p>Prognoza na podstawie wprowadzonych danych{benefitKind !== "pregnancy" && option === "81.5" && plan.deadline_21_days ? ` · wniosek ${singleLabel} do ${formatLongPl(plan.deadline_21_days)}` : ""}</p>{exportNote && <p className="export-note">{exportNote}</p>}</div></div><Button variant="secondary" icon="download" disabled={exporting} onClick={() => void downloadPlan()}>{exporting ? "Przygotowuję PDF…" : "Pobierz PDF"}</Button></div>
          <div className="kpi-grid">
            <article className="kpi primary"><span>{benefitKind === "pregnancy" ? "Zasiłek chorobowy brutto / mies." : "Macierzyński brutto / mies."}</span><strong className="tabular">{pln(plan.monthly_gross)}</strong><small>podstawa po 13,71% {pln(plan.benefit_base ?? 0)} · {maternityRate}{plan.uplift_applied ? " · podwyższenie do 1000 zł" : ""}</small></article>
            <article className="kpi"><span>Szacunkowo netto</span><strong className="tabular">{pln(plan.monthly_net)}</strong><small>po zaliczce na PIT 12%</small></article>
            <article className="kpi"><span>{plan.payer?.title ? `Płatnik: ${plan.payer.title}` : "Łączny czas opieki"}</span><strong className="tabular">{plan.total_weeks} tyg.{plan.total_extra_days ? ` ${plan.total_extra_days} dni` : ""}</strong><small>{plan.payer?.note || `ok. ${plan.total_months_approx} mies.`}</small></article>
          </div>
          {plan.entitled === false && <p className="form-error">{plan.denial_reason}</p>}
          {plan.event === "ciaza_l4" && plan.pregnancy?.limit_days ? <p className="import-note">Okres zasiłkowy {plan.pregnancy.sick_days_paid} dni (pracodawca {plan.pregnancy.employer_days}, ZUS {plan.pregnancy.zus_sick_days}). Rehabilitacja {plan.pregnancy.rehab_days} dni.</p> : null}
          {plan.notes?.map((note) => <p className="helper" key={note}>{note}</p>)}

          <section className="timeline-card card">
            <div className="timeline-head"><div><h3>Podział opieki: Mama + Tata</h3><p>Wymiary z silnika zasiłków, w tym 9 tygodni tylko dla drugiego rodzica</p></div><Badge tone="info">{childCount} {childCount === 1 ? "DZIECKO" : "DZIECI"}</Badge></div>
            <div className="timeline-legend"><span><i className="mama" /> Mama</span><span><i className="tata" /> Tata</span><span><i className="shared" /> Do podziału</span></div>
            <div className="parent-row">
              <div className="parent-label"><div className="avatar mama-avatar">{initials(plan.parents?.mother || parentName || "Matka")}</div><div><strong>{role === "opiekun" ? "Opiekun" : "Mama"}</strong><span>{plan.parents?.mother || parentName || "Matka"}</span></div></div>
              <div className="timeline">
                {maternitySpan > 0 && <div className="timeline-block maternity" style={{ width: pct(maternitySpan) }}><strong>Macierzyński</strong><span>{maternitySpan} tyg. · {maternityRate}</span></div>}
                {motherShare > 0 && <div className="timeline-block parental" style={{ width: pct(motherShare) }}><strong>Rodzicielski</strong><span>{motherShare} tyg.</span></div>}
                <div className="timeline-empty" />
              </div>
            </div>
            <div className="parent-row">
              <div className="parent-label"><div className="avatar tata-avatar">{initials(plan.parents?.father || secondParent || "Ojciec")}</div><div><strong>Tata</strong><span>{plan.parents?.father || secondParent || "Ojciec"}</span></div></div>
              <div className="timeline">
                <div className="timeline-offset" style={{ width: pct(maternitySpan) }} />
                {fatherShare > 0 && <div className="timeline-block father" style={{ width: pct(fatherShare) }}><strong>{fatherShare} tyg.</strong><span>70%</span></div>}
                {breakdown.paternity_weeks > 0 && <div className="timeline-block paternity" style={{ width: pct(breakdown.paternity_weeks) }}><strong>{breakdown.paternity_weeks} tyg.</strong><span>ojcowski</span></div>}
              </div>
            </div>
            <div className="timeline-scale"><span>Poród</span><span>{maternitySpan} tyg.</span><span>{maternitySpan + motherShare} tyg.</span><span>{span} tyg.</span></div>
            <div className="quota-note"><Icon name="info" size={18} /><span><strong>9 tygodni jest wyłączne dla drugiego rodzica.</strong> Niewykorzystana część nie przechodzi na pierwszego rodzica. Urlop rodzicielski można podzielić na maksymalnie 5 części do końca roku, w którym dziecko kończy 6 lat.</span></div>
          </section>

          <section className="payout-card card">
            <div className="payout-head"><div><h3>Harmonogram wypłat</h3><p>Pierwsze 12 miesięcy od daty porodu</p></div><button type="button" className="text-link" onClick={() => setShowAll((value) => !value)}>{showAll ? "Pokaż skrót" : "Pokaż wszystkie miesiące"} <Icon name="chevron" size={14} /></button></div>
            <div className="table-wrap">
              <table><thead><tr><th>Miesiąc</th><th>Rodzic</th><th>Rodzaj świadczenia</th><th>Stawka</th><th className="right">Kwota brutto</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.month_label}-${row.parent}-${row.benefit_type}-${index}`}>
                    <td className="tabular" data-label="Miesiąc">{row.month_label}</td>
                    <td data-label="Rodzic"><span className="person-cell"><i className={`person-dot ${row.parent === (plan.parents?.father || "") ? "tata" : "mama"}`} /> {row.parent}</span></td>
                    <td data-label="Świadczenie">{row.benefit_type}</td>
                    <td className="tabular" data-label="Stawka">{row.rate}</td>
                    <td className="right tabular" data-label="Kwota brutto"><strong>{pln(row.gross_amount)}</strong></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </section>
        </main>
      </div>
      <div className="mobile-summary"><span><small>Szacunkowo netto / mies.</small><strong>{pln(plan.monthly_net)}</strong></span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Zmień dane</button></div>
    </>
  );
}

function pdfChipLabel(item: PdfCase, index: number) {
  if (item.id && PDF_CHIP_LABELS[item.id]) return PDF_CHIP_LABELS[item.id];
  return item.extracted.insurance_title || `Przypadek ${index + 1}`;
}

function pdfChipStatus(item: PdfCase) {
  if (!item.completeness.ok) return "Do uzupełnienia";
  if (item.decision.approved) return "Pozytywny";
  return "Do analizy";
}

function PdfView({ onParsed }: { onParsed: (item: PdfCase) => void }) {
  const [cases, setCases] = useState<PdfCase[]>(FALLBACK_PDF_CASES);
  const [activeKey, setActiveKey] = useState(FALLBACK_PDF_CASES[0].id ?? FALLBACK_PDF_CASES[0].filename);
  const [result, setResult] = useState<PdfCase>(FALLBACK_PDF_CASES[0]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportNote, setExportNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPdfTestCases().then((list) => {
      if (cancelled || !list?.length) return;
      setCases(list);
      setActiveKey(list[0].id ?? list[0].filename);
      setResult(list[0]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onParsed(result);
  }, [result, onParsed]);

  async function downloadReport() {
    setExporting(true);
    setExportNote("");
    const saved = await downloadPdf("/api/export/verification-pdf", result, "raport-weryfikacji.pdf");
    setExporting(false);
    if (!saved) {
      setExportNote("Brak połączenia z API — otwarto podgląd wydruku.");
      window.print();
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Dozwolone są wyłącznie pliki PDF.");
      return;
    }
    setBusy(true);
    setError("");
    const analyzed = await verifyPdf(file);
    setResult(analyzed ?? offlinePdfResult(file.name));
    setActiveKey("upload");
    setBusy(false);
  }

  return (
    <>
      <PageIntro step="MODUŁ TESTOWY · WERYFIKACJA DOKUMENTÓW" title="Weryfikator spraw PDF" description="Wgraj dokumenty lub wybierz przypadek testowy. System odczyta dane, sprawdzi kompletność i przygotuje symulację rozstrzygnięcia.">
        <AiInfo focus="pdf" />
      </PageIntro>
      <section className="upload-card card" style={busy ? { opacity: 0.72 } : undefined}>
        <div className="upload-icon"><Icon name="upload" size={25} /></div>
        <div><h3>{busy ? "Analizuję dokument PDF…" : "Wgraj wniosek PDF z zestawów testowych ZUS"}</h3><p>ZAM, Z-3, Z-3a lub poświadczenie ubezpieczenia · PDF do 20 MB</p>{error && <p className="form-error">{error}</p>}</div>
        <div className="upload-actions"><Badge tone="info"><Icon name="sparkles" size={13} /> AI OCR PARSER</Badge><Button variant="secondary">Wybierz plik</Button></div>
        <input type="file" aria-label="Wgraj dokument PDF" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void handleUpload(file); }} />
      </section>
      <section className="quick-cases">
        <div className="quick-title"><span>ALBO WYBIERZ PRZYPADEK TESTOWY</span><small>Jedno kliknięcie uruchamia analizę</small></div>
        <div className="case-chips">{cases.map((item, index) => {
          const key = item.id ?? item.filename;
          return <button type="button" key={key} className={activeKey === key ? "active" : ""} onClick={() => { setActiveKey(key); setResult(item); setError(""); }}><span>#{index + 1}</span><div><strong>{pdfChipLabel(item, index)}</strong><small>{pdfChipStatus(item)}</small></div><Icon name="chevron" size={15} /></button>;
        })}</div>
      </section>
      <div className="verification-grid">
        <section className="card extracted-card">
          <div className="document-title"><div className="pdf-icon">PDF</div><div><h3>{result.filename}</h3><p>{pagesLabel(result.pages)} · odczyt zakończony</p></div><Badge tone={result.completeness.ok ? "success" : "warning"}><Icon name={result.completeness.ok ? "check" : "alert"} size={13} /> {result.completeness.ok ? "ODCZYTANO" : "BRAKI"}</Badge></div>
          <div className="confidence"><span>Pewność odczytu AI</span><div className="progress"><span style={{ width: `${result.confidence}%` }} /></div><strong>{result.confidence}%</strong></div>
          <h4>Odczytane dane</h4>
          <dl className="extracted-list">
            <div><dt>Wnioskodawca</dt><dd>{result.extracted.applicant_name || "Nie odczytano"} · {result.extracted.role || "rola nieodczytana"}</dd></div>
            <div><dt>Tytuł ubezpieczenia</dt><dd>{result.extracted.insurance_title}</dd></div>
            <div><dt>Okres ubezpieczenia</dt><dd className="tabular">{result.extracted.insurance_period}</dd></div>
            <div><dt>Podstawa wymiaru</dt><dd className="tabular">{result.extracted.base_amount}</dd></div>
            <div><dt>Data porodu / przyjęcia</dt><dd className="tabular">{result.extracted.due_or_birth_date || "Nie odczytano"}</dd></div>
            <div><dt>Ubezpieczeni u płatnika</dt><dd className="tabular">{result.extracted.insured_count ?? "Nie odczytano"}</dd></div>
            <div><dt>Wnioskowany wariant</dt><dd>{result.extracted.requested_variant}</dd></div>
          </dl>
          {result.error && <p className="form-error">{result.error}</p>}
          <div className={`completeness ${result.completeness.ok ? "ok" : "bad"}`}><Icon name={result.completeness.ok ? "check" : "alert"} size={20} /><div><strong>{result.completeness.title}</strong><p>{result.completeness.detail}</p></div></div>
        </section>
        <section className={`decision-card card ${result.decision.approved ? "approved" : "denied"}`}>
          <div className="decision-shield"><Icon name={result.decision.approved ? "check" : "alert"} size={28} /></div>
          <p className="eyebrow">SYMULACJA ROZSTRZYGNIĘCIA</p>
          <h2>{result.decision.status_title}</h2>
          <p className="decision-lead">{result.decision.subtitle}</p>
          <div className="decision-value"><span>Prognozowana miesięczna kwota brutto</span><strong className="tabular">{result.decision.monthly_gross}</strong><small>{result.decision.rate_note}</small></div>
          <div className="legal-basis"><strong>Uzasadnienie i podstawa prawna</strong><p>{result.decision.legal_basis}</p><a href="https://isap.sejm.gov.pl" target="_blank" rel="noreferrer">Ustawa zasiłkowa · tekst obowiązujący w 2026 r. <Icon name="external" size={14} /></a></div>
          <div className="decision-actions"><Button icon="download" disabled={exporting} onClick={() => void downloadReport()}>{exporting ? "Przygotowuję PDF…" : "Pobierz raport"}</Button><Button variant="secondary" onClick={() => setError("To symulacja. Decyzję wydaje płatnik albo ZUS.")}>Przekaż do weryfikacji</Button></div>
          {exportNote && <p className="export-note">{exportNote}</p>}
          <p className="disclaimer"><Icon name="info" size={14} /> To symulacja, nie decyzja administracyjna ZUS.</p>
        </section>
      </div>
    </>
  );
}

function downloadDeadline(dateIso: string, rateLabel = "81,5%", days = 21) {
  const stamp = dateIso.replace(/-/g, "");
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//eZUS Rodzic+//PL\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${stamp}\nSUMMARY:Wniosek ZUS o wariant ${rateLabel}\nDESCRIPTION:Złóż wniosek ZAM o stałą stawkę ${rateLabel} w ciągu ${days} dni od porodu.\nEND:VEVENT\nEND:VCALENDAR`;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "termin-zam-81-5.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function DocumentsView({ scenario, legislation }: { scenario: Scenario; legislation: LegislationParams }) {
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const [wizard, setWizard] = useState<"zam" | "leave" | "birth" | "attachment" | null>(null);
  const [sent, setSent] = useState({ zam: false, leave: false, birth: false });
  const isZus = scenario.benefit_payer.is_zus;
  const isJdg = scenario.id.includes("jdg");
  const isContract = scenario.id.includes("zlecenie");
  const deadlineIso = addDaysIso(scenario.due_date, legislation.deadline_days_81_5);
  const rateLabel = formatRate(legislation.rate_single_variant);

  useEffect(() => {
    setSent({ zam: false, leave: false, birth: false });
    setWizard(null);
  }, [scenario.id]);
  const documents: { title: string; text: string; status: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }[] = [
    { title: "Wniosek ZAM", text: "Zasiłek macierzyński, rodzicielski lub ojcowski", status: sent.zam ? "WYSŁANO (UPO wygenerowane)" : "Gotowy do wypełnienia", tone: "success" },
    {
      title: isContract ? "Zaświadczenie płatnika Z-3a" : "Zaświadczenie płatnika Z-3",
      text: isJdg ? "Przy działalności gospodarczej zaświadczenie Z-3 nie jest wymagane." : isContract ? "Zleceniodawca przekazuje do ZUS formularz Z-3a z podstawą składek." : "Przekazuje pracodawca do ZUS, gdy ZUS jest płatnikiem świadczenia.",
      status: isJdg ? "Nie jest wymagane" : isZus ? "Wymagane do ZUS" : "Po stronie pracodawcy",
      tone: isJdg ? "success" : isZus ? "warning" : "info",
    },
    { title: "Wniosek o urlop do pracodawcy", text: "Oddzielny od wniosku o wypłatę zasiłku", status: sent.leave ? "WYSŁANO (UPO wygenerowane)" : "Wymaga podpisu", tone: sent.leave ? "success" : "warning" },
    { title: "Odpis aktu urodzenia", text: "ZUS może pozyskać dane elektronicznie z rejestru", status: sent.birth ? "WNIOSEK ZŁOŻONY" : "Do potwierdzenia", tone: sent.birth ? "success" : "neutral" },
  ];
  return (
    <>
      <PageIntro step="KROK 3 Z 4 · DOKUMENTY I TERMINY" title="Właściwy dokument, we właściwym miejscu" description="Twoja ścieżka zależy od liczby osób zgłoszonych przez płatnika do ubezpieczenia chorobowego.">
        <div className="intro-actions">
          <Button icon="clipboard" disabled={exporting} onClick={() => void (async () => {
            setExporting(true);
            setExportNote("");
            const saved = await downloadPdf("/api/export/checklist-pdf", { scenario_id: scenario.id }, "checklista-dokumentow.pdf");
            setExporting(false);
            if (!saved) {
              setExportNote("Brak połączenia z API — otwarto podgląd wydruku.");
              window.print();
            }
          })()}>{exporting ? "Przygotowuję PDF…" : "Utwórz checklistę PDF"}</Button>
          {exportNote && <p className="export-note">{exportNote}</p>}
        </div>
      </PageIntro>
      <section className="routing-card card">
        <SectionHeader eyebrow={isZus ? `TWOJA ŚCIEŻKA · PŁATNIK: ${scenario.benefit_payer.title.toUpperCase()}` : "TWOJA ŚCIEŻKA · PRACODAWCA > 20 UBEZPIECZONYCH"} title={isZus ? "Zasiłek wypłaci bezpośrednio ZUS" : "Zasiłek wypłaci Twój pracodawca"} />
        <div className="routing-flow">
          <div className="route-node active"><span><Icon name="user" /></span><strong>Ty</strong><small>Wniosek + dokumenty</small></div><div className="route-arrow"><Icon name="arrow" /></div>
          <div className="route-node active"><span><Icon name={isZus ? "shield" : "clipboard"} /></span><strong>{isZus ? "ZUS" : "Pracodawca"}</strong><small>{isJdg ? "Wniosek ZAM bez Z-3" : isContract ? "Po otrzymaniu Z-3a" : isZus ? "Wypłata po Z-3" : "Weryfikuje i nalicza"}</small></div><div className="route-arrow"><Icon name="arrow" /></div>
          <div className="route-node success"><span><Icon name="check" /></span><strong>Wypłata</strong><small>{isZus ? "Bezpośrednio z ZUS" : "W terminie wypłaty wynagrodzeń"}</small></div>
        </div>
        <div className="alternate-route">{isZus ? <><span>Ścieżka dla tego scenariusza:</span><strong>Ty</strong><Icon name="arrow" size={14} /><strong>{isJdg ? "ZUS" : "Płatnik + Z-3/Z-3a"}</strong><Icon name="arrow" size={14} /><strong>Wypłata</strong></> : <><span>Gdy płatnik zgłasza ≤ 20 osób:</span><strong>Ty</strong><Icon name="arrow" size={14} /><strong>Pracodawca + Z-3/Z-3a</strong><Icon name="arrow" size={14} /><strong>ZUS</strong><Icon name="arrow" size={14} /><strong>Wypłata</strong></>}</div>
      </section>
      <div className="legislative-callout"><div className="callout-icon"><Icon name="info" /></div><div><Badge tone="info">AKTUALIZACJA 2026</Badge><h3>Zmiana od 24.10.2026 r.</h3><p>Formularze ZUR, ZAO oraz Z-3b zostały zlikwidowane. Wnioski o zasiłek macierzyński, rodzicielski i ojcowski składasz na zunifikowanym formularzu <strong>ZAM</strong>.</p></div><button>Sprawdź komunikat ZUS <Icon name="external" size={14} /></button></div>
      <section className="checklist-section">
        <SectionHeader eyebrow="TWOJA CHECKLISTA" title="4 kroki do złożenia wniosku" description={isZus ? `Lista dopasowana do płatnika: ${scenario.benefit_payer.title}.` : "Dostosowaliśmy listę do umowy o pracę i płatnika powyżej 20 osób."} />
        <div className="document-list">{documents.map((doc, index) => <article className="document-row card" key={doc.title}><span className="doc-number">{index + 1}</span><div className="doc-icon"><Icon name={index === 3 ? "external" : "file"} /></div><div className="doc-copy"><h3>{doc.title}</h3><p>{doc.text}</p></div><Badge tone={doc.tone}>{doc.status}</Badge><div className="doc-actions"><Button variant="secondary" onClick={() => setWizard(index === 3 ? "birth" : index === 2 ? "leave" : index === 0 ? "zam" : "attachment")}>{index === 3 ? "Przejdź do gov.pl" : "Podgląd"}</Button>{index === 0 && <Button onClick={() => setWizard("zam")}>Wypełnij online</Button>}</div></article>)}</div>
      </section>
      <section className="deadline-card card"><div><span className="deadline-icon"><Icon name="calendar" /></span><div><p className="eyebrow">NAJWAŻNIEJSZY TERMIN</p><h3>Do {formatLongPl(deadlineIso)}</h3><p>Złóż wniosek o wariant {rateLabel} w ciągu {legislation.deadline_days_81_5} dni od dnia porodu ({formatPlDate(scenario.due_date)}).</p></div></div><Button variant="secondary" onClick={() => downloadDeadline(deadlineIso, rateLabel, legislation.deadline_days_81_5)}>Dodaj do kalendarza</Button></section>
      <div className="official-links"><span>Oficjalne źródła:</span><a href="https://www.zus.pl" target="_blank" rel="noreferrer">zus.pl <Icon name="external" size={12} /></a><a href="https://www.gov.pl/web/rodzina/urlop-rodzicielski" target="_blank" rel="noreferrer">urlop rodzicielski <Icon name="external" size={12} /></a><a href="https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo" target="_blank" rel="noreferrer">PIP · rodzicielstwo <Icon name="external" size={12} /></a></div>
      {wizard && <DocumentWizard kind={wizard} scenario={scenario} legislation={legislation} onClose={() => setWizard(null)} onSent={(kind) => setSent((current) => ({ ...current, [kind]: true }))} />}
    </>
  );
}

function newCaseNumber() {
  const stamp = String(Math.floor(100000 + Math.random() * 900000));
  return `ZUS/PUE/2026/${stamp}`;
}

function DocumentWizard({ kind, scenario, legislation, onClose, onSent }: { kind: "zam" | "leave" | "birth" | "attachment"; scenario: Scenario; legislation: LegislationParams; onClose: () => void; onSent: (kind: "zam" | "leave" | "birth") => void }) {
  const [sentNow, setSentNow] = useState("");
  const [copy, setCopy] = useState(kind === "birth" ? "skrocony" : "zupelny");

  function send(target: "zam" | "leave" | "birth") {
    const assigned = newCaseNumber();
    setSentNow(assigned);
    onSent(target);
  }

  const title = kind === "zam" ? "Wniosek ZAM" : kind === "leave" ? "Wniosek o urlop do pracodawcy" : kind === "birth" ? "Odpis aktu urodzenia" : "Zaświadczenie płatnika";
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">SYMULACJA WNIOSKU · {scenario.label}</p>
            <h2 id="wizard-title">{title}</h2>
            <p>Dane pochodzą z wybranego scenariusza testowego. To nie jest wysyłka do prawdziwego ZUS.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="wizard-body">
          {kind === "attachment" && <p>Dla tego scenariusza zaświadczenie jest {scenario.benefit_payer.is_zus ? "składane do ZUS" : "po stronie pracodawcy"}. {scenario.id.includes("jdg") ? "Przy JDG formularz Z-3 nie jest wymagany." : ""}</p>}
          {kind === "zam" && (
            <dl className="wizard-fields">
              <div><dt>Ubezpieczona</dt><dd>{scenario.user_name}</dd></div>
              <div><dt>Tytuł ubezpieczenia</dt><dd>{scenario.insurance_type}</dd></div>
              <div><dt>Płatnik</dt><dd>{scenario.benefit_payer.title}</dd></div>
              <div><dt>Podstawa brutto</dt><dd>{pln(scenario.base_salary_gross)}</dd></div>
              <div><dt>Data porodu</dt><dd>{formatPlDate(scenario.due_date)}</dd></div>
              <div><dt>Wariant</dt><dd>{formatRate(legislation.rate_single_variant)} przez cały okres</dd></div>
            </dl>
          )}
          {kind === "leave" && (
            <dl className="wizard-fields">
              <div><dt>Pracownica</dt><dd>{scenario.user_name}</dd></div>
              <div><dt>Adresat</dt><dd>{scenario.benefit_payer.is_zus ? "Pracodawca (urlop) · zasiłek wypłaca ZUS" : "Pracodawca"}</dd></div>
              <div><dt>Od dnia porodu</dt><dd>{formatPlDate(scenario.due_date)}</dd></div>
              <div><dt>Urlop macierzyński</dt><dd>{legislation.maternity_weeks_single} tygodni przy jednym dziecku</dd></div>
              <div><dt>Urlop rodzicielski</dt><dd>{legislation.parental_weeks_single} tygodni do podziału, w tym 9 tygodni drugiego rodzica</dd></div>
            </dl>
          )}
          {kind === "birth" && (
            <>
              <p>Symulacja wniosku o odpis aktu urodzenia w Rejestrze Stanu Cywilnego.</p>
              <div className="wizard-choice">
                <label><input type="radio" name="copy" checked={copy === "skrocony"} onChange={() => setCopy("skrocony")} /> Odpis skrócony</label>
                <label><input type="radio" name="copy" checked={copy === "zupelny"} onChange={() => setCopy("zupelny")} /> Odpis zupełny</label>
              </div>
              <a className="text-link" href="https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego" target="_blank" rel="noreferrer">Otwórz informację gov.pl o Rejestrze Stanu Cywilnego <Icon name="external" size={14} /></a>
            </>
          )}
          {sentNow && kind !== "attachment" && <p className="form-ok">Nadano numer sprawy {sentNow}. Status kroku został zaktualizowany.</p>}
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>Zamknij</Button>
          {kind === "zam" && <Button onClick={() => send("zam")}>Symuluj podpis i wysyłkę do ZUS / Pracodawcy</Button>}
          {kind === "leave" && <Button onClick={() => send("leave")}>Symuluj podpis i wysyłkę do ZUS / Pracodawcy</Button>}
          {kind === "birth" && <Button onClick={() => send("birth")}>Złóż wniosek o odpis {copy === "skrocony" ? "skrócony" : "zupełny"}</Button>}
        </div>
      </div>
    </div>
  );
}

function SupportView({ goTo, legislation, onLegislation }: { goTo: (view: View) => void; legislation: LegislationParams; onLegislation: (next: LegislationParams) => void }) {
  const [admin, setAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [orgs, setOrgs] = useState<Organization[]>(FALLBACK_ORGANIZATIONS);
  const [catalog, setCatalog] = useState<Organization[]>(FALLBACK_ORGANIZATIONS);
  const allOrgs = useRef<Organization[]>(FALLBACK_ORGANIZATIONS);

  function remember(list: Organization[]) {
    allOrgs.current = list;
    setCatalog(list);
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listOrganizations(search).then((rows) => {
        if (cancelled) return;
        if (rows) {
          setOrgs(rows);
          if (!search.trim()) remember(rows);
          return;
        }
        const query = search.trim().toLowerCase();
        setOrgs(allOrgs.current.filter((item) => !query || `${item.name} ${item.badge} ${item.description}`.toLowerCase().includes(query)));
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  async function handleCreate(input: OrgInput) {
    const result = await createOrganization(input);
    const created = result.org ?? (result.offline ? { ...input, id: Date.now(), verified: 1 } : null);
    if (!created) return result.error ?? "Nie udało się zapisać organizacji.";
    const next = [...allOrgs.current.filter((item) => item.id !== created.id), created];
    remember(next);
    const query = search.trim().toLowerCase();
    const visible = !query || `${created.name} ${created.badge} ${created.description}`.toLowerCase().includes(query);
    if (visible) setOrgs((current) => [...current.filter((item) => item.id !== created.id), created]);
    return null;
  }

  async function handleDelete(orgId: number) {
    const status = await removeOrganization(orgId);
    if (status === "missing" && allOrgs.current.every((item) => item.id !== orgId)) return;
    remember(allOrgs.current.filter((item) => item.id !== orgId));
    setOrgs((current) => current.filter((item) => item.id !== orgId));
  }
  return (
    <>
      <PageIntro step="STREFA WSPARCIA" title="Nie musisz przechodzić przez to samodzielnie" description="Rzetelna informacja, spokojnie wyjaśnione prawa i zweryfikowane miejsca bezpłatnej pomocy.">
        <Button variant="secondary" icon="settings" onClick={() => setAdmin(!admin)}>Panel administracyjny</Button>
      </PageIntro>
      <section className="support-hero"><div className="support-heart"><Icon name="heart" size={25} /></div><div><h2>W sytuacji trudnej zacznij od tego, co najważniejsze</h2><p>Wybierz temat. Pokażemy świadczenia, dokumenty i kontakty bez prawniczego żargonu.</p></div></section>
      <div className="hardship-grid">
        <article className="hardship-card card"><span className="topic-icon rose"><Icon name="heart" /></span><Badge tone="neutral">STRATA DZIECKA</Badge><h3>Urodzenie martwego dziecka lub zgon dziecka</h3><p>Prawo do zasiłku za okres 8 tygodni po porodzie, nie krócej niż przez 7 dni od dnia zgonu dziecka — zależnie od sytuacji prawnej.</p><button className="text-link">Zobacz przewodnik krok po kroku <Icon name="arrow" size={14} /></button></article>
        <article className="hardship-card card"><span className="topic-icon blue"><Icon name="clock" /></span><Badge tone="info">WCZEŚNIACTWO</Badge><h3>Przedwczesny poród i hospitalizacja</h3><p>Uzupełniający urlop macierzyński zależy m.in. od tygodnia ciąży, masy urodzeniowej i czasu pobytu dziecka w szpitalu.</p><button type="button" className="text-link" onClick={() => goTo("calculator")}>Oblicz dodatkowy okres <Icon name="arrow" size={14} /></button></article>
        <article className="hardship-card card"><span className="topic-icon green-bg"><Icon name="shield" /></span><Badge tone="success">ZA ŻYCIEM</Badge><h3>Ciężka choroba lub niepełnosprawność dziecka</h3><p>Zaświadczenie „Za życiem” wydłuża wymiar urlopu rodzicielskiego do 65 tygodni przy jednym dziecku lub 67 przy porodzie mnogim.</p><button type="button" className="text-link" onClick={() => goTo("calculator")}>Sprawdź świadczenia i dokumenty <Icon name="arrow" size={14} /></button></article>
      </div>
      <section className="charity-section">
        <SectionHeader eyebrow="ZWERYFIKOWANE ORGANIZACJE" title="Bezpłatna pomoc blisko Ciebie" description="Kontakty sprawdzone przez zespół redakcyjny. W sytuacji zagrożenia życia zadzwoń pod 112." action={<div className="search-box"><Icon name="search" size={17} /><input aria-label="Szukaj organizacji" placeholder="Szukaj organizacji..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>} />
        {orgs.length === 0 ? <p className="empty-note">Brak organizacji dla „{search}”.</p> : <div className="charity-grid">{orgs.map((item) => <article className="charity-card card" key={item.id}><div className="charity-mark">{item.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><div><Badge tone="neutral">{item.badge}</Badge><h3>{item.name}</h3><p>{item.description}</p><div className="charity-links"><a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={15} /> {item.phone}</a><a href={item.website} target="_blank" rel="noreferrer">Strona organizacji <Icon name="external" size={13} /></a></div></div></article>)}</div>}
      </section>
      {admin && <AdminPanel organizations={catalog} legislation={legislation} onLegislation={onLegislation} onCreate={handleCreate} onDelete={handleDelete} onClose={() => setAdmin(false)} />}
    </>
  );
}

function AdminPanel({ onClose, organizations, onCreate, onDelete, legislation, onLegislation }: { onClose: () => void; organizations: Organization[]; onCreate: (input: OrgInput) => Promise<string | null>; onDelete: (id: number) => Promise<void>; legislation: LegislationParams; onLegislation: (next: LegislationParams) => void }) {
  const [tab, setTab] = useState<"orgs" | "law">("orgs");
  const [category, setCategory] = useState("strata");
  const [badge, setBadge] = useState(ORG_BADGES.strata);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("https://");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LegislationParams>(legislation);
  const [lawMessage, setLawMessage] = useState("");
  const [lawError, setLawError] = useState("");
  const [lawSaving, setLawSaving] = useState(false);

  useEffect(() => {
    setDraft(legislation);
  }, [legislation]);

  function setLawField(key: keyof LegislationParams, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    setDraft((current) => ({ ...current, [key]: Number.isFinite(value) ? value : current[key] }));
  }

  async function saveLaw(event: FormEvent) {
    event.preventDefault();
    setLawSaving(true);
    const result = await saveLegislation(draft);
    setLawSaving(false);
    if (result.error || !result.params) {
      setLawError(result.error ?? "Nie udało się zapisać parametrów.");
      setLawMessage("");
      return;
    }
    onLegislation(result.params);
    setLawError("");
    setLawMessage(result.offline ? "Zapisane tylko w tej sesji — API jest niedostępne." : "Zapisane. Kalkulator przeliczy świadczenia według nowych stawek.");
  }

  async function resetLaw() {
    setLawSaving(true);
    const result = await resetLegislation();
    setLawSaving(false);
    if (!result.params) {
      setLawError("Nie udało się przywrócić stawek 2026.");
      return;
    }
    onLegislation(result.params);
    setLawError("");
    setLawMessage("Przywrócono wartości ustawowe 2026.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !phone.trim() || !description.trim()) {
      setError("Uzupełnij nazwę, telefon i opis.");
      setMessage("");
      return;
    }
    setSaving(true);
    const result = await onCreate({
      category,
      badge: badge.trim() || ORG_BADGES[category] || "WSPARCIE",
      name: name.trim(),
      description: description.trim(),
      phone: phone.trim(),
      website: /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`,
    });
    setSaving(false);
    if (result) {
      setError(result);
      setMessage("");
      return;
    }
    setName("");
    setDescription("");
    setPhone("");
    setWebsite("https://");
    setError("");
    setMessage("Organizacja została dodana do Strefy Wsparcia.");
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">PANEL ADMINISTRACYJNY</p><h2>{tab === "orgs" ? "Strefa Wsparcia" : "Parametry ustawowe i stawki ZUS"}</h2><p>{tab === "orgs" ? "Dodawaj i usuwaj zweryfikowane organizacje. Zapis trafia do lokalnej bazy." : "Zmiana stawki od razu przelicza kalkulator zasiłków."}</p></div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
        <div className="admin-tabs" role="tablist">
          <button type="button" className={tab === "orgs" ? "active" : ""} onClick={() => setTab("orgs")}>Organizacje</button>
          <button type="button" className={tab === "law" ? "active" : ""} onClick={() => setTab("law")}>Parametry ustawowe i stawki ZUS</button>
        </div>
        {tab === "law" ? (
          <form className="admin-form" onSubmit={saveLaw}>
            <div className="admin-table">
              {([
                ["rate_single_variant", "Wariant stały (macierzyński i rodzicielski)", "%"],
                ["rate_maternity", "Macierzyński w wariancie dzielonym", "%"],
                ["rate_parental", "Rodzicielski w wariancie dzielonym", "%"],
                ["maternity_weeks_single", "Urlop macierzyński · jedno dziecko", "tyg."],
                ["parental_weeks_single", "Urlop rodzicielski · jedno dziecko", "tyg."],
                ["paternity_weeks", "Urlop ojcowski", "tyg."],
                ["deadline_days_81_5", "Termin wniosku o wariant stały", "dni"],
              ] as const).map(([key, label, unit]) => (
                <div className="admin-row" key={key}>
                  <label htmlFor={`law-${key}`}>{label}</label>
                  <div><input id={`law-${key}`} type="number" step="0.1" value={draft[key]} onChange={(event) => setLawField(key, event.target.value)} /><span>{unit}</span></div>
                </div>
              ))}
            </div>
            <div className="admin-form-actions">
              <span className={lawError ? "form-error" : "form-ok"}>{lawError || lawMessage}</span>
              <Button type="button" variant="secondary" onClick={() => void resetLaw()}>Przywróć 2026</Button>
              <Button type="submit">{lawSaving ? "Zapisuję…" : "Zapisz stawki"}</Button>
            </div>
          </form>
        ) : (
        <form className="admin-form" onSubmit={submit}>
          <h3>Nowa organizacja</h3>
          <div className="admin-form-grid">
            <div><label htmlFor="org-category">Kategoria</label><select id="org-category" value={category} onChange={(event) => { const next = event.target.value; setCategory(next); setBadge(ORG_BADGES[next] ?? "WSPARCIE"); }}><option value="strata">Strata i żałoba</option><option value="wczesniactwo">Wcześniactwo</option><option value="za_zyciem">Wsparcie rodziny</option><option value="inne">Inne</option></select></div>
            <div><label htmlFor="org-badge">Etykieta</label><input id="org-badge" value={badge} onChange={(event) => setBadge(event.target.value)} /></div>
            <div className="span-2"><label htmlFor="org-name">Nazwa</label><input id="org-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nazwa fundacji" /></div>
            <div className="span-2"><label htmlFor="org-description">Opis</label><textarea id="org-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Krótko, co oferuje organizacja" /></div>
            <div><label htmlFor="org-phone">Telefon</label><input id="org-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="22 000 00 00" /></div>
            <div><label htmlFor="org-website">Strona</label><input id="org-website" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></div>
          </div>
          <div className="admin-form-actions">
            <span className={error ? "form-error" : "form-ok"}>{error || message}</span>
            <Button type="submit" icon="plus">{saving ? "Zapisuję…" : "Dodaj organizację"}</Button>
          </div>
          <div className="admin-org-list">
            {organizations.map((org) => (
              <div className="admin-org-row" key={org.id}>
                <div><strong>{org.name}</strong><span>{org.badge} · {org.phone}</span></div>
                <button type="button" onClick={() => void onDelete(org.id)}>Usuń</button>
              </div>
            ))}
          </div>
        </form>
        )}
        <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Zamknij</Button></div>
      </div>
    </div>
  );
}

function ZusLogo() {
  return (
    <div className="official-zus-logo">
      <img src={zusOfficialLogo} alt="Strona główna ZUS" />
    </div>
  );
}

function PortalEntry({ scenarios, onLogin, onPreview }: { scenarios: Scenario[]; onLogin: () => void; onPreview: (scenarioId: string) => void }) {
  return (
    <main className="auth-page portal-page">
      <div className="auth-shell">
        <div className="auth-breadcrumb"><span>ZUS.pl</span><Icon name="chevron" size={13} /><span>eZUS</span><Icon name="chevron" size={13} /><strong>Asystent świadczeń rodzicielskich</strong></div>
        <div className="gateway-intro">
          <p className="eyebrow">EZUS RODZIC+</p>
          <h1>Wybierz sposób uruchomienia asystenta</h1>
          <p>Bezpiecznie sprawdź swoje uprawnienia, przewidywaną kwotę zasiłku oraz dokumenty potrzebne do złożenia wniosku.</p>
        </div>
        <div className="gateway-grid">
          <section className="gateway-card login-card">
            <div className="gateway-icon"><Icon name="shield" size={28} /></div>
            <p className="card-kicker">PEŁNA SYMULACJA</p>
            <h2>Zaloguj się do eZUS i uruchom symulację swojego zasiłku</h2>
            <p>Po potwierdzeniu tożsamości przez Węzeł Krajowy pobierzemy dane potrzebne do obliczeń:</p>
            <ul>
              <li><Icon name="check" size={15} /> historię ubezpieczenia i okres wyczekiwania,</li>
              <li><Icon name="check" size={15} /> podstawę wymiaru składek,</li>
              <li><Icon name="check" size={15} /> elektroniczne zwolnienia lekarskie e-ZLA.</li>
            </ul>
            <button className="gateway-primary" onClick={onLogin}>Przejdź do login.gov.pl <span>mObywatel</span><Icon name="arrow" size={18} /></button>
            <div className="secure-note"><Icon name="lock" size={14} /> Bezpieczne logowanie przez login.gov.pl. ZUS nie otrzymuje danych logowania.</div>
          </section>
          <section className="gateway-card preview-card">
            <div className="gateway-icon preview"><Icon name="calculator" size={28} /></div>
            <p className="card-kicker">BEZ LOGOWANIA</p>
            <h2>Tryb szybkiego podglądu</h2>
            <p>Uruchom asystenta z przykładowymi danymi. Wyniki są demonstracyjne i nie są zapisywane.</p>
            <div className="preview-scenarios">
              {scenarios.slice(0, 3).map((item, index) => (
                <button type="button" key={item.id} onClick={() => onPreview(item.id)}>
                  <span>{index + 1}</span><div><strong>{item.label.replace(/^\d+\.\s*/, "")}</strong><small>Płatnik: {item.benefit_payer.title} · {item.waiting_period.status}</small></div><Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
            <p className="preview-disclaimer"><Icon name="info" size={14} /> Tryb podglądu nie łączy się z kontem PUE/eZUS.</p>
          </section>
        </div>
        <div className="gateway-help"><div><Icon name="phone" /><span><strong>Potrzebujesz pomocy z logowaniem?</strong><small>Centrum Kontaktu Klientów ZUS · pn.–pt. 7:00–18:00</small></span></div><a href="tel:225601600">22 560 16 00</a></div>
      </div>
    </main>
  );
}

function QrCode() {
  const modules = Array.from({ length: 29 * 29 }, (_, index) => {
    const x = index % 29;
    const y = Math.floor(index / 29);
    const inFinder = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    const finderFill = (ox: number, oy: number) => inFinder(ox, oy) && (x === ox || x === ox + 6 || y === oy || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
    const finderArea = inFinder(0, 0) || inFinder(22, 0) || inFinder(0, 22);
    return finderFill(0, 0) || finderFill(22, 0) || finderFill(0, 22) || (!finderArea && ((x * 7 + y * 11 + x * y) % 5 < 2));
  });
  return <svg className="qr-svg" viewBox="-2 -2 33 33" shapeRendering="crispEdges" aria-label="Kod QR mObywatel">{modules.map((filled, index) => filled && <rect key={index} x={index % 29} y={Math.floor(index / 29)} width="1" height="1" />)}</svg>;
}

function LoginGov({ onConfirm, onBack }: { onConfirm: (user: AuthUser | null) => void; onBack: () => void }) {
  const [seconds, setSeconds] = useState(299);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    initMobywatel().then((session) => {
      if (cancelled || !session) return;
      setSessionId(session.session_id);
      setSeconds(session.expires_in_seconds);
    });
    const timer = window.setInterval(() => setSeconds((value) => value > 0 ? value - 1 : 299), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  async function confirmScan() {
    setBusy(true);
    const result = sessionId ? await confirmMobywatel(sessionId) : null;
    setBusy(false);
    onConfirm(result?.user ?? null);
  }
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return (
    <main className="login-gov-page">
      <div className="login-gov-top">
        <div className="login-gov-shell">
          <div className="gov-brand"><span className="flag-mark"><i /><i /></span><strong>login.gov.pl</strong><small>Węzeł Krajowy</small></div>
          <div className="gov-utility"><a>Pomoc</a><a>Kontakt</a><button>PL <Icon name="chevron" size={12} /></button></div>
        </div>
      </div>
      <div className="service-ribbon"><div className="login-gov-shell"><span>Logujesz się do usługi:</span><strong><ZusLogo /> Platforma Usług Elektronicznych ZUS (eZUS)</strong></div></div>
      <div className="login-gov-shell gov-content">
        <button className="back-link" onClick={onBack}>← Wróć do eZUS</button>
        <div className="gov-title"><p>BEZPIECZNE LOGOWANIE</p><h1>Potwierdź swoją tożsamość</h1><span>Wybierz sposób logowania do usługi publicznej.</span></div>
        <div className="method-tabs" role="tablist">
          <button className="active"><span className="phone-method"><Icon name="phone" size={18} /></span>Aplikacja mObywatel</button>
          <button>Profil Zaufany</button><button>Bankowość elektroniczna</button><button>e-Dowód</button>
        </div>
        <section className="mobywatel-panel">
          <div className="mobywatel-steps">
            <div className="mobywatel-heading"><div className="mobywatel-sign">m</div><div><h2>Zaloguj się aplikacją mObywatel</h2><p>Szybko i bez wpisywania hasła</p></div></div>
            <ol>
              <li><span>1</span><div><strong>Otwórz aplikację mObywatel</strong><p>Upewnij się, że korzystasz z aktualnej wersji aplikacji.</p></div></li>
              <li><span>2</span><div><strong>Wybierz „Kod QR” i zeskanuj kod obok</strong><p>Skaner znajdziesz na ekranie startowym aplikacji.</p></div></li>
              <li><span>3</span><div><strong>Potwierdź udostępnienie danych do ZUS</strong><p>Sprawdź nazwę usługi i zaakceptuj logowanie.</p></div></li>
            </ol>
            <div className="data-scope"><Icon name="info" size={17} /><span><strong>Jakie dane udostępnisz?</strong><p>Imię, nazwisko, numer PESEL oraz potwierdzenie tożsamości. Nie udostępniasz dokumentów z aplikacji.</p></span></div>
          </div>
          <div className="qr-column">
            <div className="qr-card"><QrCode /></div>
            <div className="countdown"><span className="live-dot" /> Kod ważny przez: <strong className="tabular">{minutes}:{secs}</strong></div>
            <button type="button" className="simulate-scan" onClick={() => void confirmScan()} disabled={busy}><Icon name="phone" size={19} /><span>{busy ? "Potwierdzam tożsamość w mObywatel…" : "Kliknij, aby zasymulować skan i potwierdzenie w mObywatel"}</span><Icon name="arrow" size={17} /></button>
            <p className="simulation-notice">Przycisk dostępny wyłącznie w demonstracji eZUS Rodzic+.</p>
          </div>
        </section>
        <div className="gov-security"><Icon name="shield" size={19} /><div><strong>Bezpieczne połączenie z Węzłem Krajowym</strong><p>Adres tej strony zaczyna się od https://login.gov.pl. Nigdy nie podawaj kodu PIN do aplikacji na stronie internetowej.</p></div></div>
      </div>
      <footer className="login-gov-footer"><div className="login-gov-shell"><span>login.gov.pl · Serwis Rzeczypospolitej Polskiej</span><div><a>Polityka prywatności</a><a>Dostępność</a><a>Regulamin</a></div></div></footer>
    </main>
  );
}

function Authenticating({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1200);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <main className="authenticating-page">
      <div className="authenticating-card">
        <div className="verify-animation"><span /><Icon name="shield" size={31} /></div>
        <Badge tone="success"><Icon name="check" size={13} /> mObywatel</Badge>
        <h1>Tożsamość potwierdzona</h1>
        <p>Weryfikacja tożsamości w Węźle Krajowym...</p>
        <div className="loading-line"><span /></div>
        <div className="loading-detail"><span className="status-dot" /> Pobieranie danych ubezpieczeniowych z ZUS...</div>
        <small>Za chwilę nastąpi bezpieczne przekierowanie do eZUS.</small>
      </div>
    </main>
  );
}

function PueInquiry({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const [topic, setTopic] = useState("podstawa");
  const [note, setNote] = useState("Proszę o potwierdzenie tytułu ubezpieczenia, podstawy wymiaru zasiłku i salda płatnika.");
  const [caseNo, setCaseNo] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setCaseNo(newCaseNumber());
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="pue-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">POŁĄCZENIE PUE/eZUS · AKTYWNE</p>
            <h2 id="pue-title">Dane z konta ubezpieczonego</h2>
            <p>{scenario.user_name} · {scenario.insurance_status}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <dl className="wizard-fields">
          <div><dt>Tytuł ubezpieczenia</dt><dd>{scenario.insurance_type}</dd></div>
          <div><dt>Podstawa składek</dt><dd>{pln(scenario.base_salary_gross)}</dd></div>
          <div><dt>Zaległości</dt><dd>{scenario.payer_account.has_debt ? pln(scenario.payer_account.debt_amount) : "Brak zaległości"}</dd></div>
          <div><dt>Konto płatnika</dt><dd>{scenario.payer_account.note}</dd></div>
        </dl>
        <form className="admin-form" onSubmit={submit}>
          <h3>Wyślij zapytanie do ZUS (PUE/eZUS)</h3>
          <div className="admin-form-grid">
            <div className="span-2"><label htmlFor="pue-topic">Temat</label><select id="pue-topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="podstawa">Podstawa wymiaru zasiłku</option><option value="ciaglosc">Ciągłość ubezpieczenia</option><option value="zadluzenie">Saldo i zadłużenie płatnika</option></select></div>
            <div className="span-2"><label htmlFor="pue-note">Treść</label><textarea id="pue-note" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          </div>
          {caseNo && <p className="form-ok">Zapytanie przyjęte. Numer sprawy {caseNo}.</p>}
          <div className="admin-form-actions">
            <Button type="submit">Wyślij zapytanie do ZUS (PUE/eZUS)</Button>
          </div>
        </form>
        <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Zamknij</Button></div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("status");
  const [scenarios, setScenarios] = useState<Scenario[]>(FALLBACK_SCENARIOS);
  const [scenarioId, setScenarioId] = useState(FALLBACK_SCENARIOS[0].id);
  const [fontScale, setFontScale] = useState(1);
  const [contrast, setContrast] = useState(false);
  const [language, setLanguage] = useState("PL");
  const [authStep, setAuthStep] = useState<AuthStep>("portal-entry");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [legislation, setLegislation] = useState<LegislationParams>(FALLBACK_LEGISLATION);
  const [pueOpen, setPueOpen] = useState(false);
  const [pdfCase, setPdfCase] = useState<PdfCase | null>(null);
  const activeIndex = useMemo(() => navItems.findIndex((item) => item.id === view), [view]);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function load() {
      const list = await getScenarios();
      if (cancelled) return;
      if (list?.length) {
        setApiOnline(true);
        setScenarios(list);
        setScenarioId((current) => (list.some((item) => item.id === current) ? current : list[0].id));
        return;
      }
      setApiOnline(false);
      timer = window.setTimeout(load, 5000);
    }
    void load();
    getLegislation().then((params) => {
      if (!cancelled && params) setLegislation(params);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  async function changeScenario(id: string) {
    setScenarioId(id);
    const detail = await getScenario(id);
    if (!detail) return;
    setScenarios((current) => current.map((item) => (item.id === id ? detail : item)));
  }

  if (authStep === "login-gov-mobywatel") {
    return <LoginGov onBack={() => setAuthStep("portal-entry")} onConfirm={(user) => { setAuthUser(user); setPreviewMode(false); setAuthStep("authenticating"); }} />;
  }
  if (authStep === "authenticating") {
    return <Authenticating onDone={() => setAuthStep("authenticated-dashboard")} />;
  }

  const authenticated = authStep === "authenticated-dashboard";
  const headerName = previewMode ? scenario.user_name : (authUser?.full_name ?? "Użytkownik");
  const enterPreview = (selectedId: string) => {
    setScenarioId(selectedId);
    setPreviewMode(true);
    setAuthUser(null);
    setView("status");
    setAuthStep("authenticated-dashboard");
  };

  return (
    <div className={`app official-app ${contrast ? "high-contrast" : ""}`} style={{ fontSize: `${fontScale}rem` }}>
      <header>
        <div className="utility-strip">
          <div className="shell utility-shell">
            <div className="utility-links"><a href="#main-content">Przejdź do treści</a><a>Deklaracja dostępności</a><a>BIP <span>(Biuletyn Informacji Publicznej)</span></a></div>
            <div className="accessibility-tools">
              <div className="official-font-controls" aria-label="Zmiana rozmiaru tekstu"><button onClick={() => setFontScale(.94)}>A−</button><button className={fontScale === 1 ? "active" : ""} onClick={() => setFontScale(1)}>A</button><button onClick={() => setFontScale(1.06)}>A+</button></div>
              <button className={`contrast-toggle ${contrast ? "active" : ""}`} onClick={() => setContrast(!contrast)}><span>◐</span> Wersja kontrastowa</button>
              <label className="language-select"><span className="sr-only">Język</span><select value={language} onChange={(e) => setLanguage(e.target.value)}><option>PL</option><option>EN</option><option>UA</option></select></label>
              <div className="eu-badge"><span className="eu-stars">✦</span><div><strong>Fundusze Europejskie</strong><small>Rzeczpospolita Polska</small></div></div>
            </div>
          </div>
        </div>
        <div className="brand-header">
          <div className="shell brand-shell">
            <div className="official-brand"><ZusLogo /><div><span>Platforma Usług Elektronicznych (eZUS) <i /> Asystent Świadczeń Rodzicielskich</span></div></div>
            <div className="brand-actions">
              {!authenticated ? (
                <>
                  <button className="register-button">Zarejestruj w PUE/eZUS</button>
                  <button className="official-login-button" onClick={() => setAuthStep("login-gov-mobywatel")}><Icon name="user" size={17} /> Zaloguj do PUE/eZUS przez mObywatel <Icon name="arrow" size={16} /></button>
                </>
              ) : (
                <>
                  <div className="verified-user"><span className="avatar">{initials(headerName)}</span><div><strong>{headerName}</strong><small>{previewMode ? "Tryb podglądu" : `Zweryfikowano: mObywatel${authUser ? ` · ${authUser.pesel_masked}` : ""}`} <Icon name="check" size={12} /></small></div></div>
                  <button type="button" className="logout-button" onClick={() => { setAuthStep("portal-entry"); setView("status"); setPreviewMode(false); setAuthUser(null); }}>Wyloguj <span>/ Testuj logowanie ponownie</span></button>
                </>
              )}
            </div>
          </div>
        </div>
        {authenticated && <div className="user-bar">
          <div className="shell user-shell">
            <div className="user-profile"><div className="avatar">{initials(scenario.user_name)}</div><div><strong>{scenario.user_name}</strong><span><i /> Ubezpieczenie chorobowe: <b>{scenario.insurance_status}</b></span></div></div>
            <div className="persona-select"><label htmlFor="persona">Scenariusz testowy</label><select id="persona" value={scenario.id} onChange={(event) => void changeScenario(event.target.value)}>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <button type="button" className="connected-pill" onClick={() => setPueOpen(true)}><span><Icon name="link" size={14} /></span><div><small>{previewMode ? "TRYB" : "POŁĄCZENIE"}</small><strong>{previewMode ? "Podgląd · dane przykładowe" : "PUE/eZUS · aktywne"}</strong></div><Icon name="chevron" size={14} /></button>
          </div>
        </div>}
        {authenticated && <nav className="main-nav">
          <div className="shell nav-shell">{navItems.map((item, index) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span className="nav-icon"><Icon name={item.icon} size={18} /></span><span className="nav-number">0{index + 1}</span><span className="nav-label">{item.label}</span><span className="nav-short">{item.short}</span></button>)}</div>
        </nav>}
      </header>
      {authenticated ? (
        <>
          <div className="progress-mobile"><span style={{ width: `${((activeIndex + 1) / 5) * 100}%` }} /></div>
          <div className="shell content-shell" id="main-content">
            {view === "status" && <StatusView goTo={setView} scenario={scenario} legislation={legislation} />}
            {view === "calculator" && <CalculatorView scenario={scenario} legislation={legislation} pdfCase={pdfCase} />}
            {view === "pdf" && <PdfView onParsed={setPdfCase} />}
            {view === "documents" && <DocumentsView scenario={scenario} legislation={legislation} />}
            {view === "support" && <SupportView goTo={setView} legislation={legislation} onLegislation={setLegislation} />}
            {pueOpen && <PueInquiry scenario={scenario} onClose={() => setPueOpen(false)} />}
          </div>
        </>
      ) : <PortalEntry scenarios={scenarios} onLogin={() => setAuthStep("login-gov-mobywatel")} onPreview={enterPreview} />}
      <footer className="official-footer"><div className="shell footer-shell"><div><ZusLogo /><span><strong>eZUS Rodzic+</strong><small>Asystent Świadczeń Rodzicielskich</small></span></div><p>Wyniki mają charakter informacyjny i nie stanowią decyzji ZUS ani porady prawnej.{apiOnline === false ? " Tryb lokalny: obliczenia z danych przykładowych." : ""}{apiOnline === true ? " Połączono z API eZUS Rodzic+." : ""}</p><div><a href="https://www.zus.pl" target="_blank" rel="noreferrer">zus.pl</a><a href="https://www.gov.pl/web/rodzina/urlop-rodzicielski" target="_blank" rel="noreferrer">urlop rodzicielski</a><a href="https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo" target="_blank" rel="noreferrer">PIP · rodzicielstwo</a></div></div></footer>
    </div>
  );
}
