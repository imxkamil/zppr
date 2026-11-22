import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
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

function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral"; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
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

function previewVariantTitle(scenario: Scenario) {
  if (scenario.id.includes("jdg")) return "Działalność gospodarcza (JDG)";
  if (scenario.id.includes("zlecenie")) return "Umowa zlecenie (< 90 dni chorobowego)";
  return "Pracownik UoP (> 20 os.)";
}

function anonymousBarTitle(scenario: Scenario, identity: { subtitle: string } | null) {
  if (!identity) return `Symulacja bez logowania · ${previewVariantTitle(scenario)}`;
  if (identity.subtitle.startsWith("Aktywny preset:")) return `Symulacja bez logowania · ${identity.subtitle}`;
  return "Symulacja bez logowania · Aktywny preset: dane z dokumentu PDF";
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

function SyncSlot({ syncing, pending, children }: { syncing: boolean; pending: string; children: ReactNode }) {
  if (!syncing) return <span className="sync-reveal">{children}</span>;
  return <span className="sync-slot" role="status"><i className="sync-spin" aria-hidden="true" />{pending}</span>;
}

function StatusView({ goTo, scenario, legislation, anonymous = false, onLogin, onInquire }: { goTo: (view: View) => void; scenario: Scenario; legislation: LegislationParams; anonymous?: boolean; onLogin?: () => void; onInquire: () => void }) {
  const [syncing, setSyncing] = useState(!anonymous);
  const [syncRun, setSyncRun] = useState(0);
  useEffect(() => {
    if (anonymous) {
      setSyncing(false);
      return;
    }
    setSyncing(true);
    const timer = window.setTimeout(() => setSyncing(false), 3500);
    return () => window.clearTimeout(timer);
  }, [anonymous, scenario.id, syncRun]);
  const waitingOk = scenario.waiting_period.ok;
  const hasDebt = scenario.payer_account.has_debt;
  const accountWarning = !waitingOk || hasDebt;
  const usedShare = scenario.ezla.days_limit ? Math.min(100, Math.round((scenario.ezla.days_used / scenario.ezla.days_limit) * 100)) : 0;
  const daysLeft = daysBetween(SIMULATION_AS_OF, scenario.due_date);
  return (
    <>
      <PageIntro step="KROK 1 Z 4 · TWÓJ PUNKT STARTOWY" title={anonymous ? `Symulacja uprawnień: ${scenario.label.replace(/^\d+\.\s*/, "")}` : `Dzień dobry, ${scenario.first_name}`} description={anonymous ? "Poniżej są przykładowe parametry wybranej formy zatrudnienia. Nie są to dane z konta ubezpieczonego." : "Sprawdź, co wynika z Twojego ubezpieczenia i na co warto zwrócić uwagę przed złożeniem wniosku."}>
        <div className="intro-actions">
          {anonymous && <div className="last-sync"><span className="status-dot" /> Dane symulacyjne aktualne na <strong>12.06.2026, 10:42</strong></div>}
          <Button variant="secondary" onClick={onInquire}>Wyślij zapytanie do PUE/eZUS</Button>
        </div>
      </PageIntro>
      {anonymous ? (
        <div className="guest-banner">
          <Icon name="info" size={18} />
          <p>Pracujesz w trybie bez logowania na przykładowych parametrach dla wybranej formy zatrudnienia. Aby pobrać własne dane z konta ubezpieczonego i e-ZLA, zaloguj się przez mObywatel.</p>
          <button type="button" onClick={onLogin}>Zaloguj przez mObywatel →</button>
        </div>
      ) : (
        <div className={`sync-banner${syncing ? "" : " done"}`} role="status">
          <span className={syncing ? "sync-spin" : "status-dot"} />
          <p>{syncing ? "Pobieranie danych z Kompleksowego Systemu Informatycznego ZUS (KSI ZUS) i rejestru e-ZLA..." : "Dane pobrane z KSI ZUS i rejestru e-ZLA (aktualne na dzień symulacji)"}</p>
          {!syncing && <button type="button" onClick={() => setSyncRun((value) => value + 1)}>Odśwież dane z ZUS</button>}
        </div>
      )}

      <section className="status-hero card" aria-busy={syncing}>
        <div className="status-main">
          <div className="status-icon"><Icon name="shield" size={27} /></div>
          <div>
            <div className="inline-heading"><h2>Status ubezpieczenia chorobowego</h2>{syncing ? null : <Badge tone={waitingOk ? "success" : "warning"}>{waitingOk ? "POTWIERDZONE" : "RYZYKO ODMOWY"}</Badge>}</div>
            <SyncSlot syncing={syncing} pending="Pobieranie z rejestru ubezpieczonych...">{waitingOk ? "aktywne" : "weryfikacja"} · {scenario.insurance_type}</SyncSlot>
          </div>
        </div>
        <div className="status-metrics">
          <div><span>Okres wyczekiwania</span><SyncSlot syncing={syncing} pending="Pobieranie z rejestru ubezpieczonych..."><strong className={waitingOk ? "" : "danger-text"}>{scenario.waiting_period.status}</strong><small>{scenario.waiting_period.note}</small></SyncSlot></div>
          <div><span>Płatnik zasiłku</span><SyncSlot syncing={syncing} pending="Weryfikacja konta płatnika..."><strong>{scenario.benefit_payer.title}</strong><small>{scenario.benefit_payer.note}</small></SyncSlot></div>
          <div><span>Prognozowany poród</span><SyncSlot syncing={syncing} pending="Pobieranie z rejestru ubezpieczonych..."><strong className="tabular">{formatPlDate(scenario.due_date)}</strong><small>{daysLeft >= 0 ? `za ${daysLeft} dni` : `${Math.abs(daysLeft)} dni po terminie`}</small></SyncSlot></div>
        </div>
        <div className="payer-strip"><Icon name="info" size={18} /><span>{syncing ? <SyncSlot syncing pending="Weryfikacja konta płatnika..."> </SyncSlot> : scenario.benefit_payer.is_zus ? <><strong>Płatnikiem świadczenia jest {scenario.benefit_payer.title}</strong> — {scenario.benefit_payer.note}. Dokumenty przekazujesz elektronicznie przez PUE/eZUS.</> : <><strong>Płatnik składek: {scenario.benefit_payer.title}</strong> — {scenario.benefit_payer.note}. Zasiłek wypłaca pracodawca.</>}</span><button type="button" onClick={() => goTo("documents")}>Zobacz ścieżkę dokumentów <Icon name="arrow" size={15} /></button></div>
      </section>

      <div className="dashboard-grid">
        <section className="card account-card" aria-busy={syncing}>
          <SectionHeader eyebrow="KONTO PŁATNIKA" title="Saldo składek i zadłużenie" />
          <div className={`account-ok ${!syncing && accountWarning ? "account-warning" : ""}`}><Icon name={!syncing && accountWarning ? "alert" : "check"} size={20} /><div><span className="field-label">Saldo składek i zadłużenie</span><SyncSlot syncing={syncing} pending="Weryfikacja konta płatnika..."><strong>{!waitingOk ? scenario.waiting_period.status : hasDebt ? "Zadłużenie na koncie płatnika" : "Saldo składek sprawdzone"}</strong><span>{waitingOk ? scenario.payer_account.note : scenario.waiting_period.note}</span></SyncSlot></div></div>
          <div className="basis-line"><div><span>Przychód brutto (podstawa przed 13,71%)</span><small>Kalkulator automatycznie pomniejszy tę kwotę o 13,71% składek społecznych</small></div><SyncSlot syncing={syncing} pending="Pobieranie z rejestru ubezpieczonych..."><strong className="tabular">{pln(scenario.base_salary_gross)}</strong></SyncSlot></div>
          <p className="helper">W przypadku działalności gospodarczej zadłużenie przekraczające 1% minimalnego wynagrodzenia może wstrzymać wypłatę do czasu spłaty.</p>
          <button type="button" className="text-link" onClick={() => goTo("calculator")}>Sprawdź podstawę w kalkulatorze <Icon name="chevron" size={14} /></button>
        </section>

        <section className="card zla-card" aria-busy={syncing}>
          <SectionHeader eyebrow="E-ZLA · OSTATNIE ZAŚWIADCZENIE" title="Ostatnie zaświadczenie e-ZLA" action={syncing ? <SyncSlot syncing pending="Odczyt e-ZLA..."> </SyncSlot> : <Badge tone="info">{scenario.ezla.code}</Badge>} />
          <div className="zla-row">
            <div><span>Okres</span><SyncSlot syncing={syncing} pending="Odczyt e-ZLA..."><strong className="tabular">{scenario.ezla.period}</strong></SyncSlot></div>
            <div><span>Dni wykorzystane</span><SyncSlot syncing={syncing} pending="Odczyt e-ZLA..."><strong className="tabular">{scenario.ezla.days_used} z {scenario.ezla.days_limit}</strong></SyncSlot></div>
            <div><span>Pozostało</span><SyncSlot syncing={syncing} pending="Odczyt e-ZLA..."><strong className="tabular green">{scenario.ezla.days_left} dni</strong></SyncSlot></div>
          </div>
          <div className="progress-label"><span>Okres zasiłkowy</span>{syncing ? <SyncSlot syncing pending="Odczyt e-ZLA..."> </SyncSlot> : <strong>{usedShare}%</strong>}</div>
          <div className="progress"><span style={{ width: syncing ? "0%" : `${usedShare}%` }} /></div>
          {syncing ? <SyncSlot syncing pending="Odczyt e-ZLA..."> </SyncSlot> : scenario.ezla.days_used > 0 ? (
            <div className="benefit-track"><span className="done"><Icon name="check" size={14} /> 33 dni · wynagrodzenie chorobowe</span><span className="active"><span /> od 34. dnia · zasiłek chorobowy FUS</span></div>
          ) : (
            <div className="benefit-track"><span className="active"><span /> Brak aktywnego e-ZLA w tym scenariuszu</span></div>
          )}
        </section>
      </div>

      <section className="risk-section" aria-busy={syncing}>
        <SectionHeader eyebrow="RADAR RYZYK I PUŁAPEK" title={syncing ? "Ryzyka po odczycie konta" : `${scenario.risks.length} ${scenario.risks.length === 1 ? "rzecz" : "rzeczy"}, które warto sprawdzić teraz`} action={<AiInfo focus="risks" />} />
        {syncing ? <SyncSlot syncing pending="Weryfikacja konta płatnika..."> </SyncSlot> : (
        <div className="risk-grid">
          {scenario.risks.map((risk) => (
            <article className={`risk-card ${risk.level === "ok" ? "success" : risk.level}`} key={risk.title}>
              <div className="risk-top"><span className="risk-icon"><Icon name={RISK_ICON[risk.level] ?? "alert"} /></span><Badge tone={RISK_TONE[risk.level] ?? "warning"}>{risk.badge}</Badge></div>
              <h3>{risk.title}</h3>
              <p>{risk.desc}</p>
              <button type="button" className="text-link" onClick={() => goTo(risk.level === "ok" ? "documents" : "calculator")}>{risk.level === "ok" ? "Sprawdź dokumenty i terminy" : "Symuluj wpływ w kalkulatorze"} <Icon name="arrow" size={14} /></button>
            </article>
          ))}
        </div>
        )}
      </section>

      <section className="next-step">
        <div><span className="step-number">2</span><div><p className="eyebrow">NASTĘPNY KROK</p><h3>Oblicz wysokość i okres wypłaty</h3><p>Porównaj wariant {formatRate(legislation.rate_single_variant)} z podziałem {formatRate(legislation.rate_maternity)} + {formatRate(legislation.rate_parental)}.</p></div></div>
        <Button onClick={() => goTo("calculator")} icon="calculator">Przejdź do kalkulatora świadczeń</Button>
      </section>
    </>
  );
}

function Toggle({ checked, onChange, label, hint, className = "" }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string; className?: string }) {
  return <label className={`toggle-row ${className}`.trim()}><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button></label>;
}

type DemoPreset = {
  id: string;
  label: string;
  hint: string;
  details: { label: string; text: string }[];
  showSchedule: boolean;
  benefitKind: string;
  employment: string;
  children: string;
  base: number;
  option: string;
  life: boolean;
  etat: number;
  combineWeeks: string;
  due: string;
  preWeeks: number;
  gestation: string;
  grams: string;
  hospitalDays: string;
  stayFrom: string;
  stayTo: string;
  contractFte: string;
  childAge: string;
  childMonths: string;
  schoolDeferral: boolean;
  parentName: string;
  secondParent: string;
  role: string;
  insured: number;
  insuredAge: string;
  sickDays: string;
  rehabMonths: string;
  rehabPregnant: boolean;
  waitingDays: string;
  debt: string;
  motherUnavailable: boolean;
  paternity: boolean;
};

const BASE_CALCULATOR_STATE = {
  benefitKind: "birth",
  employment: "uop",
  children: "1",
  parentName: "Ewa Malinowska",
  secondParent: "Piotr Malinowski",
  role: "matka",
  due: "2026-09-18",
  option: "81.5",
  paternity: true,
  insured: 25,
  contractFte: "1",
  base: 8200,
  life: false,
  etat: 0,
  combineWeeks: "0",
  preWeeks: 0,
  gestation: "",
  grams: "",
  hospitalDays: "",
  stayFrom: "",
  stayTo: "",
  childAge: "",
  childMonths: "",
  schoolDeferral: false,
  insuredAge: "",
  sickDays: "0",
  rehabMonths: "0",
  rehabPregnant: true,
  waitingDays: "",
  debt: "0",
  motherUnavailable: false,
};

type CalculatorFormState = typeof BASE_CALCULATOR_STATE;

function scenarioForm(scenario: Scenario, anonymous: boolean): CalculatorFormState {
  const employment = employmentFor(scenario);
  return {
    ...BASE_CALCULATOR_STATE,
    base: scenario.base_salary_gross,
    employment,
    insured: insuredFor(employment),
    due: scenario.due_date,
    parentName: anonymous ? "" : scenario.first_name,
    secondParent: "",
    sickDays: "100",
  };
}

function formFromPreset(preset: DemoPreset): CalculatorFormState {
  return {
    ...BASE_CALCULATOR_STATE,
    benefitKind: preset.benefitKind,
    employment: preset.employment,
    children: preset.children,
    base: preset.base,
    option: preset.option,
    life: preset.life,
    etat: preset.etat,
    combineWeeks: preset.combineWeeks,
    due: preset.due,
    preWeeks: preset.preWeeks,
    gestation: preset.gestation,
    grams: preset.grams,
    hospitalDays: preset.hospitalDays,
    stayFrom: preset.stayFrom,
    stayTo: preset.stayTo,
    contractFte: preset.contractFte,
    childAge: preset.childAge,
    childMonths: preset.childMonths,
    schoolDeferral: preset.schoolDeferral,
    parentName: preset.parentName,
    secondParent: preset.secondParent,
    role: preset.role,
    insured: preset.insured,
    insuredAge: preset.insuredAge,
    sickDays: preset.sickDays,
    rehabMonths: preset.rehabMonths,
    rehabPregnant: preset.rehabPregnant,
    waitingDays: preset.waitingDays,
    debt: preset.debt,
    motherUnavailable: preset.motherUnavailable,
    paternity: preset.paternity,
  };
}

function demoPreset(partial: Pick<DemoPreset, "id" | "label" | "hint" | "details"> & Partial<DemoPreset>): DemoPreset {
  return {
    showSchedule: false,
    benefitKind: "birth",
    employment: "uop",
    children: "1",
    base: 8200,
    option: "81.5",
    life: false,
    etat: 0,
    combineWeeks: "0",
    due: "2026-09-18",
    preWeeks: 0,
    gestation: "",
    grams: "",
    hospitalDays: "",
    stayFrom: "",
    stayTo: "",
    contractFte: "1",
    childAge: "",
    childMonths: "",
    schoolDeferral: false,
    parentName: "Ewa Malinowska",
    secondParent: "Piotr Malinowski",
    role: "matka",
    insured: 25,
    insuredAge: "",
    sickDays: "100",
    rehabMonths: "0",
    rehabPregnant: true,
    waitingDays: "",
    debt: "0",
    motherUnavailable: false,
    paternity: true,
    ...partial,
  };
}

const DEMO_PRESETS: DemoPreset[] = [
  demoPreset({
    id: "uop-standard",
    label: "1. Standard UoP — wariant 81,5% + 9 tyg. ojca",
    hint: "Wzorcowa umowa o pracę: podstawa po składkach, wariant 81,5% i dziewięć tygodni drugiego rodzica liczone osobno, po 70%.",
    details: [
      { label: "Dane", text: "Ewa Malinowska (matka) i Piotr Malinowski, umowa o pracę, pełny etat, 8 200,00 zł brutto, 25 ubezpieczonych, poród 18.09.2026, jedno dziecko. Imiona biorą się z formularza, nie ze stałej w silniku." },
      { label: "Podstawa", text: "8 200,00 × (1 − 13,71%) = 7 075,78 zł. Stawka 81,5% daje 5 766,76 zł brutto miesięcznie, a po zaliczce PIT 12% zostaje 5 074,75 zł netto." },
      { label: "Wymiar", text: "20 tygodni macierzyńskiego i 32 tygodnie rodzicielskiego matki po 81,5%, 9 tygodni wyłącznie dla ojca po 70% oraz 2 tygodnie urlopu ojcowskiego po 100%. Razem 63 tygodnie. Dziewięć tygodni ojca nie wchodzi w uśrednienie 81,5%." },
      { label: "Płatnik", text: "Firma zgłasza powyżej 20 ubezpieczonych, więc zasiłek wypłaca pracodawca. Zaświadczenie Z-3 nie jest potrzebne." },
    ],
  }),
  demoPreset({
    id: "jdg-zus",
    label: "2. JDG (przedsiębiorca) — wypłata przez ZUS (druk ZAM)",
    hint: "Przedsiębiorca składa sam wniosek ZAM do ZUS. Macierzyński nie wymaga 90 dni dobrowolnego chorobowego.",
    details: [
      { label: "Dane", text: "Działalność gospodarcza, zadeklarowane 6 500,00 zł, jeden ubezpieczony, wariant 81,5%, ta sama data porodu. Łączenie rodzicielskiego z pracą jest przy JDG wyłączone." },
      { label: "Podstawa", text: "6 500,00 × (1 − 13,71%) = 5 608,85 zł. Miesięcznie jest to 4 571,21 zł brutto i 4 022,66 zł netto. Kwota mieści się pod sufitem 20 321,30 zł." },
      { label: "Wypłata", text: "Płatnikiem jest ZUS. Składa się wniosek ZAM. Zaświadczenia Z-3 nie ma, a formularz Z-3b został zniesiony 24.10.2026 r." },
      { label: "Wyczekiwanie", text: "90 dni dobrowolnego ubezpieczenia dotyczy zasiłku chorobowego, nie macierzyńskiego. Prawo do macierzyńskiego jest od pierwszego dnia podlegania, jeśli ubezpieczenie trwa w dniu porodu." },
    ],
    employment: "jdg",
    base: 6500,
    insured: 1,
  }),
  demoPreset({
    id: "ceiling",
    label: "3. Sufit podstawy JDG / Zlecenie (limit 250% — 20 321,30 zł)",
    hint: "Deklaracja powyżej limitu 2026 r. jest ścinana przed policzeniem 81,5%. Ten sam sufit dotyczy umowy zlecenia.",
    details: [
      { label: "Dane", text: "JDG i deklarowane 30 000,00 zł brutto. Przy zleceniu z taką samą deklaracją silnik stosuje identyczny limit." },
      { label: "Obcięcie", text: "250% prognozowanego przeciętnego wynagrodzenia na 2026 r. to 23 550,00 zł brutto. Nadwyżka nad tę kwotę odpada, zanim liczone jest 13,71%." },
      { label: "Podstawa", text: "23 550,00 × (1 − 13,71%) = 20 321,30 zł. Dalej 81,5% daje 16 561,86 zł brutto miesięcznie i 14 574,44 zł netto." },
      { label: "Gdzie widać", text: "W kafelku podstawy jest 20 321,30 zł, a w notatce planu zdanie o ścięciu do 23 550,00 zł. Płatnikiem zostaje ZUS." },
    ],
    employment: "jdg",
    base: 30000,
    insured: 1,
  }),
  demoPreset({
    id: "quarter",
    label: "4. Niski wymiar etatu (1/4 etatu) — podwyższenie do 1 000 zł (art. 31 ust. 3a)",
    hint: "Niepełny etat nie jest podciągany do pełnej płacy minimalnej. Gdy netto wyszłoby poniżej 1 000 zł, wypłata jest podnoszona do świadczenia rodzicielskiego.",
    details: [
      { label: "Dane", text: "Umowa o pracę na 1/4 etatu i wynagrodzenie 1 201,50 zł brutto. To dokładnie 4 806,00 × 0,25, czyli podłoga proporcjonalna do etatu, a nie pełne 4 806,00 zł." },
      { label: "Wyliczenie", text: "1 201,50 × (1 − 13,71%) = 1 036,77 zł podstawy. Przy 81,5% wychodzi 844,97 zł brutto i 743,57 zł netto." },
      { label: "Podwyższenie", text: "Art. 31 ust. 3a ustawy zasiłkowej: skoro netto jest niższe niż 1 000,00 zł, miesięczna wypłata brutto i netto staje się 1 000,00 zł. Na kafelku widać dopisek o podwyższeniu." },
      { label: "Podłoga etatu", text: "Pełna podłoga 4 806,00 zł i podstawa 4 147,10 zł dotyczą pełnego etatu. Przy 1/4 etatu wynagrodzenie zostaje 1 201,50 zł, bo tyle wynosi 4 806,00 × 0,25." },
    ],
    base: 1201.5,
    contractFte: "0.25",
  }),
  demoPreset({
    id: "combine",
    label: "5. Łączenie urlopu rodzicielskiego z pracą (10 tyg. na 0,5 etatu -> 68 tyg.)",
    hint: "Pracownik może łączyć rodzicielski z pracą do połowy etatu. W tych tygodniach stawka spada proporcjonalnie, a wydłużenie wraca do pełnych 81,5%.",
    details: [
      { label: "Dane", text: "Ta sama umowa 8 200,00 zł i pełny etat w umowie. Dodatkowo 10 tygodni łączenia z pracą na 0,5 etatu. Przy JDG i zleceniu ten suwak jest zablokowany (art. 182¹e KP)." },
      { label: "Stawka w trakcie pracy", text: "81,5% × (1 − 0,5) = 40,75%. Tyle jest w wierszach „Rodzicielski łączony z pracą”. Dziewięć tygodni ojca dalej idzie po 70%, a ojcowski po 100%." },
      { label: "Wydłużenie", text: "Art. 182¹f KP: dodatkowe tygodnie = 10 × 0,5 = 5. Po okresie pracy stawka wraca do 81,5% w wierszach „Wydłużenie za pracę”. Wymiar rośnie z 63 do 68 tygodni." },
      { label: "Gdzie widać", text: "Harmonogram jest rozwinięty. Obniżona stawka jest dopiero po macierzyńskim, więc trzeba zejść do 2027 r., a nie patrzeć tylko na pierwsze miesiące po porodzie." },
    ],
    etat: 0.5,
    combineWeeks: "10",
    showSchedule: true,
  }),
  demoPreset({
    id: "hospital",
    label: "6. Wcześniactwo i hospitalizacja noworodka (30. tydz., 1400 g, 20 dni)",
    hint: "Uzupełniający urlop macierzyński za pobyt noworodka w szpitalu jest liczony z dni i płacony 100%, obok wariantu 81,5%.",
    details: [
      { label: "Dane", text: "Poród w 30. tygodniu ciąży, masa 1 400 g, 20 dni w szpitalu, ta sama podstawa 8 200,00 zł i wariant 81,5%. Pól „pobyt od / do dnia życia” nie ustawiamy, bo okno 5.–28. dnia dotyczy dopiero porodu od 37. tygodnia." },
      { label: "Tygodnie", text: "Art. 180² KP: dla 28.–36. tygodnia i masy powyżej 1 000 g limit wynosi 8 tygodni. Z 20 dni wychodzi ceil(20 / 7) = 3 tygodnie. Przy tygodniu poniżej 28. albo masie do 1 000 g limit wynosi 15 tygodni." },
      { label: "Pieniądze", text: "Te 3 tygodnie stoją bezpośrednio po macierzyńskim i mają stawkę 100%. Macierzyński zostaje osobno: 5 766,76 zł, czyli 81,5% podstawy 7 075,78 zł." },
      { label: "Gdzie widać", text: "Pod polami szpitala jest żywy licznik „Uzupełniający urlop: 3 tyg.”, a w harmonogramie osobny wiersz płatny 100%." },
    ],
    gestation: "30",
    grams: "1400",
    hospitalDays: "20",
    showSchedule: true,
  }),
  demoPreset({
    id: "prebirth",
    label: "7. Urlop macierzyński przed porodem (4 tygodnie przed terminem)",
    hint: "Część macierzyńskiego można wykorzystać przed porodem. Te tygodnie są płatne pełniej niż reszta wariantu 81,5% i skracają pulę po porodzie.",
    details: [
      { label: "Dane", text: "Umowa o pracę, 8 200,00 zł, wariant 81,5% i 4 tygodnie urlopu przed porodem. Ustawa pozwala na 0–6 tygodni; wartość powyżej 6 jest obcinana do 6." },
      { label: "Podział 20 tygodni", text: "Art. 180 § 2–3 KP: 4 tygodnie przed 18.09.2026 są płatne 100% podstawy. Po porodzie zostaje 16 tygodni macierzyńskiego po 81,5%. Rodzicielski, 9 tygodni ojca i ojcowski się nie skracają." },
      { label: "Długość", text: "Łączny czas opieki zostaje 63 tygodnie, bo 4 tygodnie nie dochodzą obok 20, tylko wychodzą z tej dwudziestki i przesuwają się przed datę porodu." },
      { label: "Gdzie widać", text: "Suwak pokazuje „4 tyg. · 100%”, a w harmonogramie sprzed września 2026 jest wiersz „Urlop przed porodem” ze stawką 100%." },
    ],
    preWeeks: 4,
  }),
  demoPreset({
    id: "adoption",
    label: "8. Adopcja dziecka w wieku 13,95 roku — gwarancja 9 + 38 tygodni",
    hint: "Przy adopcji tuż przed 14. rokiem życia pełny urlop już by się nie zmieścił, więc ustawa daje gwarantowane minimum zamiast ucinać do zera.",
    details: [
      { label: "Dane", text: "Zdarzenie adopcja, wiek dziecka 13,95 roku, bez zaświadczenia „Za życiem”. Do 14. urodzin zostaje około 2,6 tygodnia, czyli mniej niż zwykłe 20 + 41." },
      { label: "Gwarancja", text: "Art. 183 KP: skoro dziecko nie ukończyło 14 lat, a zwykły wymiar się nie mieści, przyznawane jest minimum 9 tygodni na warunkach macierzyńskiego i 38 tygodni rodzicielskiego. Z tych 38 ojciec ma 9 tygodni po 70%." },
      { label: "Za życiem", text: "Włączenie przełącznika w formularzu zmienia gwarancję na 9 + 62 tygodnie. Sam preset zostawia przełącznik wyłączony, żeby najpierw było widać 9 + 38." },
      { label: "Ojcowski", text: "Dwa tygodnie urlopu ojcowskiego po 100% dochodzą obok tej gwarancji, bo dziecko nie ma jeszcze 14 lat. Do puli 9 + 38 ich nie wliczamy." },
    ],
    benefitKind: "adoption",
    childAge: "13.95",
    showSchedule: true,
  }),
  demoPreset({
    id: "pregnancy",
    label: "9. Ciąża L4 (270 dni) + Świadczenie rehabilitacyjne (100%)",
    hint: "Zwolnienie w ciąży jest płatne 100% podstawy. Najpierw wynagrodzenie chorobowe pracodawcy, potem zasiłek do 270. dnia, a po wyczerpaniu limitu rehabilitacja nadal w ciąży.",
    details: [
      { label: "Dane", text: "Zdarzenie ciąża i L4, umowa o pracę, wiek 40 lat, 270 dni niezdolności i 2 miesiące rehabilitacji nadal w ciąży. Podstawa z 8 200,00 zł to 7 075,78 zł, więc miesiąc po 100% wynosi 7 075,78 zł brutto i 6 226,69 zł netto. Wariant 81,5% tego świadczenia nie dotyczy." },
      { label: "270 dni", text: "Poniżej 50. roku życia pierwsze 33 dni to wynagrodzenie chorobowe pracodawcy (art. 92 KP). Od 50. roku byłyby to 14 dni. Reszta, tutaj 237 dni, to zasiłek chorobowy 100% do łącznego limitu 270 dni." },
      { label: "Rehabilitacja", text: "Zaczyna się dopiero po 270 dniach. Dwa miesiące to 60 dni. W ciąży stawka zostaje 100%. Poza ciążą byłoby 90% przez pierwsze 90 dni i 75% dalej, najwyżej przez 12 miesięcy." },
      { label: "Płatnik", text: "Firma ma 25 ubezpieczonych, więc świadczenie wypłaca pracodawca. Przy JDG albo zleceniu zasiłek chorobowy wymaga 90 dni dobrowolnego ubezpieczenia; ten preset tego progu nie włącza, bo tytułem jest umowa o pracę." },
    ],
    benefitKind: "pregnancy",
    insuredAge: "40",
    sickDays: "270",
    rehabMonths: "2",
    rehabPregnant: true,
    paternity: false,
    showSchedule: true,
  }),
];

type FiledPlan = {
  applicantName: string;
  role: string;
  due: string;
  benefitKind: string;
  children: number;
  employment: string;
  base: number;
  option: string;
  payerTitle: string;
  payerNote: string;
  isZus: boolean;
  forms: string[];
  deadline: string;
  maternityWeeks: number;
  parentalWeeks: number;
};

function AdvancedSection({ title, active, className = "", children }: { title: string; active: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <details className={`law-block advanced ${active ? "is-live" : ""} ${className}`.trim()} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{title}</summary>
      <div className="advanced-body">{children}</div>
    </details>
  );
}

function childCountLabel(kind: string) {
  if (kind === "adoption") return "Liczba jednocześnie przysposobionych dzieci";
  if (kind === "foster") return "Liczba jednocześnie przyjętych dzieci";
  return "Liczba dzieci przy jednym porodzie";
}

function childWeekSuffix(kind: string) {
  return kind === "birth" ? "tyg. macierzyńskiego" : "tyg. na warunkach macierzyńskiego";
}

function applicantFieldLabel(role: string) {
  if (role === "ojciec") return "Ojciec (wnioskodawca)";
  if (role === "opiekun") return "Opiekun (wnioskodawca)";
  return "Matka (wnioskodawczyni)";
}

function secondParentLabel(role: string) {
  if (role === "ojciec") return "Matka dziecka";
  if (role === "matka") return "Ojciec dziecka";
  return "Drugi rodzic";
}

function employmentCaption(employment: string) {
  if (employment === "jdg") return "Działalność gospodarcza";
  if (employment === "zlecenie") return "Umowa zlecenie";
  if (employment === "ustanie") return "Ustanie zatrudnienia";
  return "Umowa o pracę";
}

function firstMonths(schedule: BenefitPlan["schedule"], months: number) {
  const seen: string[] = [];
  const rows: BenefitPlan["schedule"] = [];
  for (const row of schedule) {
    if (!seen.includes(row.month_label)) {
      if (seen.length >= months) break;
      seen.push(row.month_label);
    }
    rows.push(row);
  }
  return rows;
}

function CalculatorView({ scenario, legislation, pdfCase, transfer, onDemoIdentity, onFiledCase, onResetChecklist, goTo, anonymous = false, form, setForm, presetId, setPresetId, showSchedule, setShowSchedule, seenTransfer }: { scenario: Scenario; legislation: LegislationParams; pdfCase: PdfCase | null; transfer: { token: number; item: PdfCase } | null; onDemoIdentity: (identity: { name: string; subtitle: string } | null) => void; onFiledCase: (plan: FiledPlan) => void; onResetChecklist: () => void; goTo: (view: View) => void; anonymous?: boolean; form: CalculatorFormState; setForm: (value: CalculatorFormState | ((current: CalculatorFormState) => CalculatorFormState)) => void; presetId: string; setPresetId: (value: string) => void; showSchedule: boolean; setShowSchedule: (value: boolean | ((current: boolean) => boolean)) => void; seenTransfer: { current: number } }) {
  const { benefitKind, children, base, option, life, etat, combineWeeks, employment, due, preWeeks, gestation, grams, hospitalDays, stayFrom, stayTo, contractFte, childAge, childMonths, schoolDeferral, parentName, secondParent, role, insured, insuredAge, sickDays, rehabMonths, rehabPregnant, waitingDays, debt, motherUnavailable, paternity } = form;
  const setBenefitKind = (value: string) => setForm((current) => ({ ...current, benefitKind: value }));
  const setChildren = (value: string) => setForm((current) => ({ ...current, children: value }));
  const setBase = (value: number) => setForm((current) => ({ ...current, base: value }));
  const setOption = (value: string) => setForm((current) => ({ ...current, option: value }));
  const setLife = (value: boolean) => setForm((current) => ({ ...current, life: value }));
  const setEtat = (value: number) => setForm((current) => ({ ...current, etat: value }));
  const setCombineWeeks = (value: string | ((current: string) => string)) => setForm((current) => ({ ...current, combineWeeks: typeof value === "function" ? value(current.combineWeeks) : value }));
  const setEmployment = (value: string) => setForm((current) => ({ ...current, employment: value }));
  const setDue = (value: string) => setForm((current) => ({ ...current, due: value }));
  const setPreWeeks = (value: number) => setForm((current) => ({ ...current, preWeeks: value }));
  const setGestation = (value: string) => setForm((current) => ({ ...current, gestation: value }));
  const setGrams = (value: string) => setForm((current) => ({ ...current, grams: value }));
  const setHospitalDays = (value: string) => setForm((current) => ({ ...current, hospitalDays: value }));
  const setStayFrom = (value: string) => setForm((current) => ({ ...current, stayFrom: value }));
  const setStayTo = (value: string) => setForm((current) => ({ ...current, stayTo: value }));
  const setContractFte = (value: string) => setForm((current) => ({ ...current, contractFte: value }));
  const setChildAge = (value: string) => setForm((current) => ({ ...current, childAge: value }));
  const setChildMonths = (value: string) => setForm((current) => ({ ...current, childMonths: value }));
  const setSchoolDeferral = (value: boolean) => setForm((current) => ({ ...current, schoolDeferral: value }));
  const setParentName = (value: string) => setForm((current) => ({ ...current, parentName: value }));
  const setSecondParent = (value: string) => setForm((current) => ({ ...current, secondParent: value }));
  const setRole = (value: string) => setForm((current) => ({ ...current, role: value }));
  const setInsured = (value: number | ((current: number) => number)) => setForm((current) => ({ ...current, insured: typeof value === "function" ? value(current.insured) : value }));
  const setInsuredAge = (value: string) => setForm((current) => ({ ...current, insuredAge: value }));
  const setSickDays = (value: string) => setForm((current) => ({ ...current, sickDays: value }));
  const setRehabMonths = (value: string) => setForm((current) => ({ ...current, rehabMonths: value }));
  const setRehabPregnant = (value: boolean) => setForm((current) => ({ ...current, rehabPregnant: value }));
  const setWaitingDays = (value: string) => setForm((current) => ({ ...current, waitingDays: value }));
  const setDebt = (value: string) => setForm((current) => ({ ...current, debt: value }));
  const setMotherUnavailable = (value: boolean) => setForm((current) => ({ ...current, motherUnavailable: value }));
  const setPaternity = (value: boolean) => setForm((current) => ({ ...current, paternity: value }));
  const showAll = showSchedule;
  const setShowAll = (value: boolean | ((current: boolean) => boolean)) => setShowSchedule(typeof value === "function" ? value(showSchedule) : value);
  const demoId = presetId;
  const setDemoId = setPresetId;
  const [flashKeys, setFlashKeys] = useState<string[]>([]);
  const applyingPreset = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const [imported, setImported] = useState("");
  const [remotePlan, setRemotePlan] = useState<{ key: string; plan: BenefitPlan } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");

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
    wiek_dziecka_miesiace: blankNumber(childMonths),
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
  }), [benefitKind, employment, children, due, life, option, base, parentName, secondParent, role, preWeeks, gestation, grams, hospitalDays, stayFrom, stayTo, contractFte, etat, combineWeeks, childAge, childMonths, schoolDeferral, insured, insuredAge, sickDays, rehabMonths, rehabPregnant, waitingDays, debt, motherUnavailable, paternity]);

  const localPlan = useMemo(() => calculateLocally(payload, legislation), [payload, legislation]);
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      simulateBenefits(payload).then((plan) => {
        if (!cancelled && plan) setRemotePlan({ key: payloadKey, plan });
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payload, payloadKey, legislation]);

  const plan = remotePlan?.key === payloadKey ? remotePlan.plan : localPlan;
  const breakdown = plan.breakdown;
  const hospitalPreview = supplementaryWeeks(blankNumber(gestation), blankNumber(grams), blankNumber(hospitalDays), blankNumber(stayFrom), blankNumber(stayTo));
  const hospitalAuto = benefitKind === "birth" && Number(gestation) >= 37 && stayFrom !== "" && stayTo !== "";
  const showPaternity = benefitKind !== "foster" && role !== "opiekun";
  const extensionWeeks = breakdown.extension_weeks ?? 0;
  const preSpan = breakdown.pre_birth_weeks ?? 0;
  const postSpan = breakdown.maternity_weeks + (breakdown.premature_weeks ?? 0);
  const maternitySpan = preSpan + postSpan;
  const motherShare = breakdown.parental_weeks_mother + (role === "ojciec" ? 0 : extensionWeeks);
  const fatherShare = breakdown.parental_weeks_father_exclusive + (role === "ojciec" ? extensionWeeks : 0);
  const span = Math.max(1, maternitySpan + motherShare + fatherShare + breakdown.paternity_weeks);
  const pct = (weeks: number) => `${(weeks / span) * 100}%`;
  const maternityRate = option === "81.5" ? formatRate(legislation.rate_single_variant) : formatRate(legislation.rate_maternity);
  const singleLabel = formatRate(legislation.rate_single_variant);
  const splitLabel = `${formatRate(legislation.rate_maternity)} + ${formatRate(legislation.rate_parental)}`;
  const rows = showAll ? plan.schedule : firstMonths(plan.schedule, 12);
  const scheduleHasMore = rows.length < plan.schedule.length;
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

  function markImported(keys: string[]) {
    setDemoId("");
    setFlashKeys(keys);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashKeys([]), 1600);
  }

  function applyPdf(item: PdfCase | null) {
    const extracted = item?.extracted;
    if (!item || !extracted) {
      setImported("Najpierw wgraj PDF albo wybierz sprawę w weryfikatorze. Formularz zostaje bez zmian i nie bierze kwoty ze scenariusza.");
      return;
    }
    const amount = extracted.base_amount_value ?? parsePlnAmount(extracted.base_amount);
    const iso = toIsoDate(extracted.due_or_birth_date);
    if (item.error && amount == null && !iso && !extracted.applicant_name) {
      setImported(item.error);
      return;
    }
    if (amount == null && !iso && !extracted.applicant_name) {
      setImported("W tym dokumencie nie ma kwoty, daty ani nazwiska. Nic nie zostało podstawione.");
      return;
    }
    const touched: string[] = [];
    if (amount != null) {
      setBase(amount);
      touched.push("base");
    }
    if (iso) {
      setDue(iso);
      touched.push("due");
    }
    if (extracted.employment_type && ["uop", "jdg", "zlecenie", "ustanie"].includes(extracted.employment_type)) {
      setEmployment(extracted.employment_type);
      if (extracted.employment_type !== "uop") {
        setEtat(0);
        setCombineWeeks("0");
      }
      touched.push("employment");
    }
    if (extracted.applicant_name) {
      setParentName(extracted.applicant_name);
      touched.push("parentName");
    }
    if (extracted.role === "matka" || extracted.role === "ojciec" || extracted.role === "opiekun") {
      setRole(extracted.role);
      touched.push("role");
    }
    if (typeof extracted.insured_count === "number") {
      setInsured(extracted.insured_count);
      touched.push("insured");
    }
    if ((extracted.requested_variant || "").includes("100")) {
      setOption("100_70");
      touched.push("option");
    } else if ((extracted.requested_variant || "").includes("81")) {
      setOption("81.5");
      touched.push("option");
    }
    markImported(touched);
    const missing = [amount == null ? "podstawy" : "", iso ? "" : "daty"].filter(Boolean).join(" i ");
    setImported(missing ? `Wczytano ${item.filename}. Brak ${missing} w pliku — tych pól nie zmieniam.` : `Wczytano dane z ${item.filename}.`);
  }

  function importParsed() {
    applyPdf(pdfCase);
  }

  useEffect(() => {
    if (!transfer || transfer.token === seenTransfer.current) return;
    seenTransfer.current = transfer.token;
    applyPdf(transfer.item);
  }, [transfer]);

  useEffect(() => {
    onFiledCase({
      applicantName: parentName.trim() || (anonymous ? "" : "Wnioskodawca"),
      role,
      due,
      benefitKind,
      children: childCount,
      employment,
      base: Number.isFinite(base) ? base : 0,
      option,
      payerTitle: plan.payer?.title || "Płatnik",
      payerNote: plan.payer?.note || "",
      isZus: Boolean(plan.payer?.is_zus),
      forms: plan.payer?.required_forms ?? [],
      deadline: plan.deadline_21_days || "",
      maternityWeeks: breakdown.maternity_weeks || 0,
      parentalWeeks: (breakdown.parental_weeks_mother || 0) + (breakdown.parental_weeks_father_exclusive || 0),
    });
  }, [onFiledCase, parentName, role, due, benefitKind, childCount, employment, base, option, plan, breakdown, anonymous]);

  function applyCalculatorState(state: CalculatorFormState) {
    setBenefitKind(state.benefitKind);
    setChildren(state.children);
    setBase(state.base);
    setOption(state.option);
    setLife(state.life);
    setEtat(state.etat);
    setCombineWeeks(state.combineWeeks);
    setEmployment(state.employment);
    setDue(state.due);
    setPreWeeks(state.preWeeks);
    setGestation(state.gestation);
    setGrams(state.grams);
    setHospitalDays(state.hospitalDays);
    setStayFrom(state.stayFrom);
    setStayTo(state.stayTo);
    setContractFte(state.contractFte);
    setChildAge(state.childAge);
    setChildMonths(state.childMonths);
    setSchoolDeferral(state.schoolDeferral);
    setParentName(state.parentName);
    setSecondParent(state.secondParent);
    setRole(state.role);
    setInsured(state.insured);
    setInsuredAge(state.insuredAge);
    setSickDays(state.sickDays);
    setRehabMonths(state.rehabMonths);
    setRehabPregnant(state.rehabPregnant);
    setWaitingDays(state.waitingDays);
    setDebt(state.debt);
    setMotherUnavailable(state.motherUnavailable);
    setPaternity(state.paternity);
  }

  function resetForm() {
    onResetChecklist();
    const nextEmployment = employmentFor(scenario);
    applyingPreset.current = true;
    applyCalculatorState({
      ...BASE_CALCULATOR_STATE,
      base: scenario.base_salary_gross,
      employment: nextEmployment,
      insured: insuredFor(nextEmployment),
      due: scenario.due_date,
      parentName: anonymous ? "" : scenario.first_name,
      secondParent: "",
      sickDays: "100",
    });
    setImported("");
    setShowAll(false);
    setDemoId("");
    setFlashKeys([]);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    window.setTimeout(() => { applyingPreset.current = false; }, 0);
  }

  function applyDemo(id: string) {
    const preset = DEMO_PRESETS.find((item) => item.id === id);
    if (!preset) {
      setDemoId("");
      setFlashKeys([]);
      return;
    }
    const next = formFromPreset(preset);
    applyingPreset.current = true;
    applyCalculatorState(next);
    setDemoId(preset.id);
    setShowAll(preset.showSchedule);
    setImported("");
    const changed = (Object.keys(BASE_CALCULATOR_STATE) as (keyof CalculatorFormState)[])
      .filter((key) => next[key] !== BASE_CALCULATOR_STATE[key])
      .map(String);
    setFlashKeys(changed);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashKeys([]), 1600);
    window.setTimeout(() => { applyingPreset.current = false; }, 0);
    window.setTimeout(() => {
      if (window.innerWidth <= 900) document.querySelector(".results-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
  }

  function onEtatChange(next: number) {
    setCombineWeeks((weeks) => {
      if (next === 0) return "0";
      if (!applyingPreset.current && etat === 0 && next > 0 && (weeks === "0" || weeks === "")) return "10";
      return weeks;
    });
    setEtat(next);
  }

  function onPayerSize(value: string) {
    setInsured((current) => {
      if (value === "under") return current > 20 ? 15 : current;
      return current <= 20 ? 25 : current;
    });
  }

  const activeDemo = DEMO_PRESETS.find((item) => item.id === demoId);
  const flash = (key: string) => (flashKeys.includes(key) ? "field-preset-flash" : "");

  useEffect(() => {
    if (activeDemo) {
      onDemoIdentity({ name: activeDemo.parentName, subtitle: `Aktywny preset: ${activeDemo.label}` });
      return;
    }
    const importedName = pdfCase?.extracted.applicant_name?.trim();
    if (importedName) {
      onDemoIdentity({ name: importedName, subtitle: pdfCase?.filename ? `Dokument: ${pdfCase.filename}` : "Dane z dokumentu PDF" });
      return;
    }
    onDemoIdentity(null);
  }, [activeDemo, pdfCase, onDemoIdentity]);

  useEffect(() => () => onDemoIdentity(null), [onDemoIdentity]);

  return (
    <>
      <PageIntro step="KROK 2 Z 4 · KALKULATOR" title="Zaplanuj świadczenia i czas opieki" description="Porównaj dostępne warianty, podziel opiekę między rodziców i zobacz prognozę wypłat miesiąc po miesiącu.">
        <Badge tone="neutral"><Icon name="lock" size={14} /> Obliczenia nie są zapisywane</Badge>
      </PageIntro>
      <div className="calculator-layout">
        <aside className="config-panel card">
          <div className="panel-head"><div><span className="step-bubble">1</span><div><h2>Ustaw scenariusz</h2><p>Dopasuj dane do swojej sytuacji</p></div></div><button type="button" className="reset-button" onClick={resetForm}>Wyczyść</button></div>
          <div className="demo-preset">
            <div className="demo-preset-head">
              <label htmlFor="demo-preset">Scenariusz demonstracyjny (presety 2026)</label>
              <button type="button" className="reset-button" onClick={resetForm}>Wyczyść / Resetuj formularz</button>
            </div>
            <select id="demo-preset" value={demoId} onChange={(event) => applyDemo(event.target.value)}>
              <option value="">Wybierz scenariusz testowy / przypadek życiowy...</option>
              {DEMO_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {activeDemo && (
              <div className="demo-hint">
                <p>{activeDemo.hint}</p>
                <ul>
                  {activeDemo.details.map((item) => <li key={item.label}><strong>{item.label}.</strong> {item.text}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div className={`field-group ${flash("benefitKind")}`}>
            <label>Rodzaj świadczenia</label>
            <div className="scenario-tabs">
              <button type="button" className={benefitKind === "birth" ? "active" : ""} onClick={() => setBenefitKind("birth")}>Poród</button>
              <button type="button" className={benefitKind === "pregnancy" ? "active" : ""} onClick={() => setBenefitKind("pregnancy")}>Ciąża L4 + rehabilitacyjne</button>
              <button type="button" className={benefitKind === "adoption" ? "active" : ""} onClick={() => setBenefitKind("adoption")}>Adopcja</button>
              <button type="button" className={benefitKind === "foster" ? "active" : ""} onClick={() => setBenefitKind("foster")}>Piecza zastępcza</button>
            </div>
          </div>
          <div className={`field-group ${flash("employment")}`}>
            <label htmlFor="employment">Forma zatrudnienia</label>
            <select id="employment" value={employment} onChange={(e) => { const next = e.target.value; setEmployment(next); setInsured(insuredFor(next)); if (next !== "uop") { setEtat(0); setCombineWeeks("0"); } }}>
              <option value="uop">Umowa o pracę</option>
              <option value="zlecenie">Umowa zlecenie</option>
              <option value="jdg">Działalność gospodarcza (JDG)</option>
              <option value="ustanie">Ustanie zatrudnienia (upadłość/likwidacja)</option>
            </select>
          </div>
          {benefitKind !== "pregnancy" && (
          <div className={`field-group ${flash("children")}`}>
            <label htmlFor="children">{childCountLabel(benefitKind)}</label>
            <select id="children" value={children} onChange={(e) => setChildren(e.target.value)}>
              <option value="1">1 dziecko · {legislation.maternity_weeks_single} {childWeekSuffix(benefitKind)}</option>
              <option value="2">2 dzieci · {31 + legislation.maternity_weeks_single - 20} {childWeekSuffix(benefitKind)}</option>
              <option value="3">3 dzieci · {33 + legislation.maternity_weeks_single - 20} {childWeekSuffix(benefitKind)}</option>
              <option value="4">4 dzieci · {35 + legislation.maternity_weeks_single - 20} {childWeekSuffix(benefitKind)}</option>
              <option value="5">5+ dzieci · {37 + legislation.maternity_weeks_single - 20} {childWeekSuffix(benefitKind)}</option>
            </select>
          </div>
          )}
          <div className="two-fields">
            <div className={`field-group ${flash("parentName")}`}><label htmlFor="parent-name">{applicantFieldLabel(role)}</label><input id="parent-name" value={parentName} placeholder={anonymous ? "Wpisz imię i nazwisko lub wybierz preset..." : undefined} onChange={(e) => setParentName(e.target.value)} /></div>
            <div className={`field-group ${flash("secondParent")}`}><label htmlFor="second-parent">{secondParentLabel(role)}</label><input id="second-parent" value={secondParent} placeholder={role === "ojciec" ? "Matka" : "Ojciec"} onChange={(e) => setSecondParent(e.target.value)} /></div>
          </div>
          <div className="two-fields">
            <div className={`field-group ${flash("role")}`}><label htmlFor="role">Rola wnioskodawcy</label><select id="role" value={role} onChange={(e) => setRole(e.target.value)}><option value="matka">Matka</option><option value="ojciec">Ojciec</option><option value="opiekun">Opiekun</option></select></div>
            <div className={`field-group ${flash("due")}`}><label htmlFor="birthdate">{benefitKind === "pregnancy" ? "Początek zwolnienia" : benefitKind === "birth" ? "Data porodu" : "Data przyjęcia dziecka"}</label><div className="input-icon"><Icon name="calendar" size={17} /><input id="birthdate" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div></div>
          </div>
          {benefitKind === "birth" && (
            <div className={`field-group ${flash("childMonths")}`}>
              <label htmlFor="child-months">Wiek dziecka (w miesiącach)</label>
              <input id="child-months" type="number" min="0" max="216" step="1" value={childMonths} onChange={(e) => setChildMonths(e.target.value)} />
              <p className="helper">Po ukończeniu 12. miesiąca urlop ojcowski wygasa.</p>
            </div>
          )}
          {(benefitKind === "adoption" || benefitKind === "foster") && (
            <div className={`law-block ${childAge ? "is-live" : ""}`}>
              <h3>{benefitKind === "adoption" ? "Wiek dziecka przy adopcji (limit 14 lat)" : "Wiek dziecka w pieczy (limit 7 lat, 10 przy odroczeniu)"}</h3>
              <div className={`field-group ${flash("childAge")}`}><label htmlFor="child-age">Wiek dziecka (w latach)</label><input id="child-age" type="number" min="0" max="18" step="0.01" value={childAge} onChange={(e) => setChildAge(e.target.value)} /></div>
              {benefitKind === "foster" && <Toggle className={flash("schoolDeferral")} checked={schoolDeferral} onChange={setSchoolDeferral} label="Odroczenie obowiązku szkolnego" hint="Podnosi limit wieku do 10 lat" />}
            </div>
          )}
          {benefitKind === "birth" && (
            <AdvancedSection title="Urlop przed porodem (art. 180 § 2–3 KP)" active={preWeeks > 0}>
              <div className={`label-line ${flash("preWeeks")}`}><label htmlFor="pre-weeks">Tygodnie urlopu przed porodem (0–6)</label><strong>{preWeeks} tyg. · 100%</strong></div>
              <input id="pre-weeks" type="range" min="0" max="6" step="1" value={preWeeks} onChange={(e) => setPreWeeks(Number(e.target.value))} />
            </AdvancedSection>
          )}
          {benefitKind === "birth" && (
            <AdvancedSection title="Hospitalizacja noworodka / wcześniactwo" active={Boolean(gestation || grams || hospitalDays || stayFrom || stayTo)} className={`${flash("gestation")} ${flash("grams")} ${flash("hospitalDays")}`}>
              {Number(children) > 1 && <p className="helper">Poród mnogi: wymiar uzupełniającego urlopu macierzyńskiego ustala się na podstawie dziecka o najniższej masie urodzeniowej oraz najdłuższym okresie hospitalizacji.</p>}
              <div className="triple-fields">
                <div className="field-group"><label htmlFor="gestation">Tydzień ciąży</label><input id="gestation" type="number" min="20" max="42" value={gestation} onChange={(e) => setGestation(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="grams">Masa (g)</label><input id="grams" type="number" min="0" value={grams} onChange={(e) => setGrams(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="hospital-days">Dni w szpitalu</label><input id="hospital-days" type="number" min="0" value={hospitalDays} disabled={hospitalAuto} onChange={(e) => setHospitalDays(e.target.value)} />{hospitalAuto && <p className="helper">Liczba dni wyliczana automatycznie z okna 5.–28. dnia życia na podstawie zakresu pobytu od–do.</p>}</div>
              </div>
              <div className="two-fields">
                <div className="field-group"><label htmlFor="stay-from">Pobyt od dnia życia</label><input id="stay-from" type="number" min="1" max="28" value={stayFrom} onChange={(e) => setStayFrom(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="stay-to">Pobyt do dnia życia</label><input id="stay-to" type="number" min="1" max="40" value={stayTo} onChange={(e) => setStayTo(e.target.value)} /></div>
              </div>
              <p className="import-note">Uzupełniający urlop: {hospitalPreview} tyg. · płatne 100% i poza uśrednieniem 81,5%. Od 37. tygodnia liczą się co najmniej 2 dni między 5. a 28. dniem życia.</p>
            </AdvancedSection>
          )}
          {benefitKind === "pregnancy" && (
            <div className={`law-block ${benefitKind === "pregnancy" ? "is-live" : ""}`}>
              <h3>Ciąża, e-ZLA kod B i świadczenie rehabilitacyjne</h3>
              <div className="triple-fields">
                <div className={`field-group ${flash("insuredAge")}`}><label htmlFor="insured-age">Wiek ubezpieczonej</label><input id="insured-age" type="number" min="15" max="80" value={insuredAge} onChange={(e) => setInsuredAge(e.target.value)} /></div>
                <div className={`field-group ${flash("sickDays")}`}><label htmlFor="sick-days">Dni niezdolności</label><input id="sick-days" type="number" min="0" max="400" value={sickDays} onChange={(e) => setSickDays(e.target.value)} /></div>
                <div className={`field-group ${flash("rehabMonths")}`}><label htmlFor="rehab-months">Miesiące rehabilitacji</label><input id="rehab-months" type="number" min="0" max="12" value={rehabMonths} onChange={(e) => setRehabMonths(e.target.value)} /><p className="helper">Świadczenie rehabilitacyjne przysługuje dopiero po wyczerpaniu pełnego okresu zasiłkowego (270 dni L4).</p></div>
              </div>
              <Toggle className={flash("rehabPregnant")} checked={rehabPregnant} onChange={setRehabPregnant} label="Rehabilitacja nadal w ciąży" hint="100% podstawy. Poza ciążą: 90% przez 90 dni, potem 75%." />
              {(employment === "jdg" || employment === "zlecenie") && (
                <div className="field-group"><label htmlFor="waiting">Dni podlegania dobrowolnemu ubezpieczeniu</label><input id="waiting" type="number" min="0" value={waitingDays} onChange={(e) => setWaitingDays(e.target.value)} /></div>
              )}
            </div>
          )}
          {benefitKind !== "pregnancy" && (
          <div className="toggle-box">
            <Toggle className={flash("life")} checked={life} onChange={setLife} label="Zaświadczenie „Za życiem”" hint="Urlop rodzicielski 65/67 tygodni, a przy gwarancji minimalnej 62 tygodnie" />
            {showPaternity && <Toggle className={flash("paternity")} checked={paternity} onChange={setPaternity} label="Urlop ojcowski" hint="2 tygodnie, 100% podstawy, do 12. miesiąca życia albo 14. roku przy adopcji" />}
            <Toggle className={flash("motherUnavailable")} checked={motherUnavailable} onChange={setMotherUnavailable} label="Matka nie może sprawować opieki" hint={benefitKind === "birth" ? undefined : "Wtedy blok po przyjęciu dziecka może wykorzystać ojciec"} />
            {benefitKind === "birth" && <p className="helper">Gdy matka nie może sprawować opieki, urlop przed porodem zostaje przy niej, a zasiłek po porodzie i urlop uzupełniający przejmuje ojciec.</p>}
          </div>
          )}
          {benefitKind !== "pregnancy" && <div className={`field-group ${flash("option")}`}>
            <label>Wariant wypłaty</label>
            <label className={`radio-card ${option === "81.5" ? "selected" : ""}`}><input type="radio" name="variant" checked={option === "81.5"} onChange={() => setOption("81.5")} /><span><strong>{singleLabel} przez cały okres</strong><small>Urlop przed porodem, uzupełniający (szpitalny) i ojcowski są płatne 100%, a 9 nieprzenoszalnych tygodni drugiego rodzica 70%.</small><small>{plan.deadline_21_days ? `Najpóźniej do ${formatLongPl(plan.deadline_21_days)}` : `Wniosek do ${legislation.deadline_days_81_5} dni po porodzie`}</small></span><Badge tone="success">STABILNY</Badge></label>
            <label className={`radio-card ${option === "100_70" ? "selected" : ""}`}><input type="radio" name="variant" checked={option === "100_70"} onChange={() => setOption("100_70")} /><span><strong>{splitLabel}</strong><small>{benefitKind === "birth" ? "Macierzyński" : "Na warunkach macierzyńskiego"} {formatRate(legislation.rate_maternity)}, rodzicielski {formatRate(legislation.rate_parental)}</small></span></label>
            {plan.deadline_21_days ? <p className="helper">Wniosek o {singleLabel} należy złożyć najpóźniej do <strong>{formatLongPl(plan.deadline_21_days)}</strong> ({legislation.deadline_days_81_5} dni po porodzie lub przyjęciu dziecka). Po przekroczeniu tego terminu nie można już wybrać wariantu {singleLabel}: obowiązuje {formatRate(legislation.rate_maternity)} + {formatRate(legislation.rate_parental)}. Przełączenie wariantu w kalkulatorze zostaje ręczne.</p> : null}
          </div>}
          {benefitKind !== "pregnancy" && employment === "uop" && (
          <AdvancedSection title="Łączenie urlopu rodzicielskiego z pracą" active={etat > 0 || Number(combineWeeks) > 0}>
            <div className={`label-line ${flash("etat")}`}><label htmlFor="work">Wymiar etatu (0–0,5)</label><strong>{etat.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}</strong></div>
            <input id="work" type="range" min="0" max="0.5" step="0.1" value={etat} onChange={(e) => onEtatChange(Number(e.target.value))} />
            <div className={`field-group ${flash("combineWeeks")}`}><label htmlFor="combine-weeks">Tygodnie łączenia</label><input id="combine-weeks" type="number" min="0" max="134" step="1" value={combineWeeks} disabled={etat === 0} onChange={(e) => setCombineWeeks(e.target.value)} /></div>
          </AdvancedSection>
          )}
          {employment === "jdg" || employment === "ustanie" ? (
            <p className="helper">{employment === "jdg" ? "Przy działalności gospodarczej zasiłek wypłaca ZUS. Próg 20 ubezpieczonych nie zmienia płatnika, a zaświadczenie Z-3 nie jest wymagane." : "Po ustaniu zatrudnienia zasiłek wypłaca ZUS. Próg 20 ubezpieczonych nie ma tu znaczenia. Do wniosku dołącza się ZAM i dokument potwierdzający ustanie."}</p>
          ) : (
          <div className="two-fields">
            <div className={`field-group ${flash("insured")}`}>
              <label htmlFor="payer-size">Wielkość płatnika</label>
              <select id="payer-size" value={insured > 20 ? "over" : "under"} onChange={(e) => onPayerSize(e.target.value)}>
                <option value="under">Do 20 ubezpieczonych</option>
                <option value="over">Powyżej 20 ubezpieczonych</option>
              </select>
            </div>
            <div className={`field-group ${flash("insured")}`}><label htmlFor="insured-count">Liczba ubezpieczonych</label><input id="insured-count" type="number" min="0" value={insured} onChange={(e) => setInsured(Number(e.target.value) || 0)} /></div>
          </div>
          )}
          {(employment === "jdg" || employment === "zlecenie") && (
            <div className={`field-group ${flash("debt")}`}><label htmlFor="debt">Zadłużenie wobec ZUS (zł)</label><input id="debt" type="number" min="0" step="0.01" value={debt} onChange={(e) => setDebt(e.target.value)} /></div>
          )}
          {employment === "uop" && <div className={`field-group ${flash("contractFte")}`}>
            <label htmlFor="contract-fte">Wymiar etatu w umowie</label>
            <select id="contract-fte" value={contractFte} onChange={(e) => setContractFte(e.target.value)}>
              <option value="1">Pełny etat</option>
              <option value="0.75">3/4 etatu</option>
              <option value="0.5">1/2 etatu</option>
              <option value="0.25">1/4 etatu</option>
            </select>
          </div>}
          <div className={`field-group ${flash("base")}`}>
            <label htmlFor="base">Wynagrodzenie lub przychód brutto przed odliczeniem 13,71%</label>
            <div className="money-input"><input id="base" type="number" min="0" value={Number.isFinite(base) ? base : 0} onChange={(e) => setBase(e.target.value === "" ? 0 : Number(e.target.value))} /><span>PLN</span></div>
            <button type="button" className="import-button" onClick={importParsed}><Icon name="download" size={15} /> Importuj z symulacji ZUS / PDF</button>
            {imported && <p className={imported.startsWith("Wczytano") ? "import-note" : "form-error"}>{imported}</p>}
          </div>
        </aside>

        <main className="results-panel">
          <div className="result-heading"><div><span className="step-bubble">2</span><div><h2>Twój plan świadczeń</h2><p>Prognoza na podstawie wprowadzonych danych{benefitKind !== "pregnancy" && option === "81.5" && plan.deadline_21_days ? ` · wniosek ${singleLabel} do ${formatLongPl(plan.deadline_21_days)}` : ""}</p>{exportNote && <p className="export-note">{exportNote}</p>}</div></div><Button variant="secondary" icon="download" disabled={exporting} onClick={() => void downloadPlan()}>{exporting ? "Przygotowuję PDF…" : "Pobierz PDF"}</Button></div>
          <div className="kpi-grid">
            <article className="kpi primary"><span>{benefitKind === "pregnancy" ? "Zasiłek chorobowy brutto / mies." : benefitKind === "birth" ? "Macierzyński brutto / mies." : "Na warunkach macierzyńskiego / mies."}</span><strong className="tabular">{pln(plan.monthly_gross)}</strong><small>{plan.monthly_gross === 0 && plan.notes?.find((note) => note.includes("ukończyło")) ? plan.notes.find((note) => note.includes("ukończyło")) : <>podstawa po 13,71% {pln(plan.benefit_base ?? 0)} · {maternityRate}{plan.uplift_applied ? " · podwyższenie do 1000 zł" : ""}</>}</small></article>
            <article className="kpi"><span>Szacunkowo netto</span><strong className="tabular">{pln(plan.monthly_net)}</strong><small>po zaliczce na PIT 12%</small></article>
            <article className="kpi"><span>{plan.payer?.title ? `Płatnik: ${plan.payer.title}` : "Łączny czas opieki"}</span><strong className="tabular">{plan.total_weeks} tyg.{plan.total_extra_days ? ` ${plan.total_extra_days} dni` : ""}</strong><small>{plan.payer?.note || `ok. ${plan.total_months_approx} mies.`}</small></article>
          </div>
          {plan.entitled === false && <p className="form-error">{plan.denial_reason}</p>}
          {plan.event === "ciaza_l4" && plan.pregnancy?.limit_days ? <p className="import-note">Okres zasiłkowy {plan.pregnancy.sick_days_paid} dni (pracodawca {plan.pregnancy.employer_days}, ZUS {plan.pregnancy.zus_sick_days}). Rehabilitacja {plan.pregnancy.rehab_days} dni.</p> : null}
          {plan.notes?.map((note) => <p className="helper" key={note}>{note}</p>)}

          {plan.event === "ciaza_l4" ? (
            <section className="timeline-card card">
              <div className="timeline-head"><div><h3>Rozkład okresu chorobowego</h3><p>Wynagrodzenie chorobowe, zasiłek chorobowy i świadczenie rehabilitacyjne</p></div></div>
              <div className="timeline sick-track">
                {(plan.pregnancy?.employer_days ?? 0) > 0 && <div className="timeline-block maternity" style={{ width: `${((plan.pregnancy?.employer_days ?? 0) / Math.max(1, (plan.pregnancy?.employer_days ?? 0) + (plan.pregnancy?.zus_sick_days ?? 0) + (plan.pregnancy?.rehab_days ?? 0))) * 100}%` }}><strong>Wynagrodzenie chorobowe pracodawcy</strong><span>{plan.pregnancy?.employer_days} dni · 100%</span></div>}
                {(plan.pregnancy?.zus_sick_days ?? 0) > 0 && <div className="timeline-block parental" style={{ width: `${((plan.pregnancy?.zus_sick_days ?? 0) / Math.max(1, (plan.pregnancy?.employer_days ?? 0) + (plan.pregnancy?.zus_sick_days ?? 0) + (plan.pregnancy?.rehab_days ?? 0))) * 100}%` }}><strong>Zasiłek chorobowy ZUS</strong><span>do 270 dni · 100%</span></div>}
                {(plan.pregnancy?.rehab_days ?? 0) > 0 && <div className="timeline-block father" style={{ width: `${((plan.pregnancy?.rehab_days ?? 0) / Math.max(1, (plan.pregnancy?.employer_days ?? 0) + (plan.pregnancy?.zus_sick_days ?? 0) + (plan.pregnancy?.rehab_days ?? 0))) * 100}%` }}><strong>Świadczenie rehabilitacyjne</strong><span>{plan.pregnancy?.rehab_in_pregnancy === false ? "90% / 75%" : "100%"}</span></div>}
              </div>
            </section>
          ) : (
          <section className="timeline-card card">
            <div className="timeline-head"><div><h3>Podział opieki: Matka + Ojciec</h3><p>Wymiary z silnika zasiłków, w tym 9 tygodni tylko dla drugiego rodzica</p></div><Badge tone="info">{childCount} {childCount === 1 ? "DZIECKO" : "DZIECI"}</Badge></div>
            <div className="timeline-legend"><span><i className="mama" /> Matka</span><span><i className="tata" /> Ojciec</span><span><i className="shared" /> Do podziału</span></div>
            <div className="parent-row">
              <div className="parent-label"><div className="avatar mama-avatar">{initials(plan.parents?.mother || parentName || "Matka")}</div><div><strong>{role === "opiekun" ? "Opiekun" : "Matka"}</strong><span>{plan.parents?.mother || parentName || "Matka"}</span></div></div>
              <div className="timeline">
                {motherUnavailable && preSpan > 0 && <div className="timeline-block maternity" style={{ width: pct(preSpan) }}><strong>Przed porodem</strong><span>{preSpan} tyg. · 100%</span></div>}
                {motherUnavailable && postSpan > 0 && <div className="timeline-offset" style={{ width: pct(postSpan) }} />}
                {!motherUnavailable && maternitySpan > 0 && <div className="timeline-block maternity" style={{ width: pct(maternitySpan) }}><strong>{benefitKind === "birth" ? "Macierzyński" : "Na warunkach macierzyńskiego"}</strong><span>{maternitySpan} tyg. · {maternityRate}</span></div>}
                {motherShare > 0 && <div className="timeline-block parental" style={{ width: pct(motherShare) }}><strong>Rodzicielski</strong><span>{motherShare} tyg.</span></div>}
                <div className="timeline-empty" />
              </div>
            </div>
            <div className="parent-row">
              <div className="parent-label"><div className="avatar tata-avatar">{initials(plan.parents?.father || secondParent || "Ojciec")}</div><div><strong>Ojciec</strong><span>{plan.parents?.father || secondParent || "Ojciec"}</span></div></div>
              <div className="timeline">
                <div className="timeline-offset" style={{ width: pct(motherUnavailable ? preSpan : maternitySpan) }} />
                {motherUnavailable && postSpan > 0 && <div className="timeline-block maternity" style={{ width: pct(postSpan) }}><strong>{benefitKind === "birth" ? "Macierzyński" : "Na warunkach macierzyńskiego"}</strong><span>{postSpan} tyg. · {maternityRate}</span></div>}
                {fatherShare > 0 && <div className="timeline-block father" style={{ width: pct(fatherShare) }}><strong>{fatherShare} tyg.</strong><span>70%</span></div>}
                {breakdown.paternity_weeks > 0 && <div className="timeline-block paternity" style={{ width: pct(breakdown.paternity_weeks) }}><strong>{breakdown.paternity_weeks} tyg.</strong><span>ojcowski</span></div>}
              </div>
            </div>
            <div className="timeline-scale"><span>{benefitKind === "birth" ? "Poród" : "Przyjęcie"}</span><span>{maternitySpan} tyg.</span><span>{maternitySpan + motherShare} tyg.</span><span>{span} tyg.</span></div>
            <p className="helper">Symulacja układa urlop ciągiem. W praktyce urlop rodzicielski możesz wykorzystać jednorazowo albo podzielić maksymalnie na 5 części — aż do zakończenia roku kalendarzowego, w którym dziecko kończy 6 lat.</p>
            <div className="quota-note"><Icon name="info" size={18} /><span><strong>9 tygodni jest wyłączne dla drugiego rodzica.</strong> Niewykorzystana część nie przechodzi na pierwszego rodzica. Urlop rodzicielski można podzielić na maksymalnie 5 części do końca roku, w którym dziecko kończy 6 lat.</span></div>
          </section>
          )}

          <section className="payout-card card">
            <div className="payout-head"><div><h3>Harmonogram wypłat</h3><p>{showAll || !scheduleHasMore ? "Cały okres świadczenia" : "Pierwsze 12 miesięcy od daty porodu"}</p></div>{scheduleHasMore || showAll ? <button type="button" className="text-link" onClick={() => setShowAll((value) => !value)}>{showAll ? "Pokaż skrót" : "Pokaż wszystkie miesiące"} <Icon name="chevron" size={14} /></button> : null}</div>
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
      <section className="next-step">
        <div><span className="step-number">3</span><div><p className="eyebrow">NASTĘPNY KROK</p><h3>Wniosek z tego planu</h3><p>Imię, data, wariant i płatnik przejdą do checklisty oraz pliku kalendarza.</p></div></div>
        <Button onClick={() => goTo("documents")} icon="arrow">Przejdź do wniosku ZAM i dokumentów</Button>
      </section>
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

function PdfView({ onParsed, onCalculate }: { onParsed: (item: PdfCase) => void; onCalculate: (item: PdfCase) => void }) {
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
          <div className="legal-basis"><strong>Uzasadnienie i podstawa prawna</strong><p>{result.decision.legal_basis}</p><a href="https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19990600636" target="_blank" rel="noopener noreferrer">Ustawa zasiłkowa · tekst obowiązujący w 2026 r. <Icon name="external" size={14} /></a></div>
          <div className="decision-actions"><Button icon="download" disabled={exporting} onClick={() => void downloadReport()}>{exporting ? "Przygotowuję PDF…" : "Pobierz raport"}</Button><Button variant="secondary" onClick={() => onCalculate(result)}>Przenieś dane do kalkulatora i policz</Button></div>
          {exportNote && <p className="export-note">{exportNote}</p>}
          <p className="disclaimer"><Icon name="info" size={14} /> To symulacja, nie decyzja administracyjna ZUS.</p>
        </section>
      </div>
      <section className="next-step">
        <div><span className="step-number">2</span><div><p className="eyebrow">NASTĘPNY KROK</p><h3>Policz świadczenie z tego dokumentu</h3><p>Odczytane imię, data, podstawa i wariant wejdą do kalkulatora. Puste pola zostaną puste.</p></div></div>
        <Button onClick={() => onCalculate(result)} icon="calculator">Przenieś dane do kalkulatora i policz</Button>
      </section>
    </>
  );
}

function downloadDeadline(dateIso: string, rateLabel = "81,5%", days = 21, benefitKind = "birth") {
  const fromPlacement = benefitKind === "adoption" || benefitKind === "foster";
  const when = fromPlacement ? "od daty przyjęcia dziecka" : "od daty porodu";
  const stamp = dateIso.replace(/-/g, "");
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//eZUS Rodzic+//PL\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${stamp}\nSUMMARY:Wniosek ZUS o wariant ${rateLabel}\nDESCRIPTION:Złóż wniosek w ciągu ${days} dni ${when}.\nEND:VEVENT\nEND:VCALENDAR`;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fromPlacement ? "termin-zam-od-przyjecia.ics" : "termin-zam-od-porodu.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function eventDocument(kind: string) {
  if (kind === "adoption") return { title: "Orzeczenie sądu o przysposobieniu / zaświadczenie o wszczęciu postępowania", text: "Dokument potwierdzający przysposobienie albo wszczęcie postępowania.", wizard: "birth" as const };
  if (kind === "foster") return { title: "Postanowienie sądu lub umowa o powierzeniu pieczy zastępczej", text: "Dokument potwierdzający powierzenie dziecka.", wizard: "birth" as const };
  if (kind === "pregnancy") return { title: "Zaświadczenie e-ZLA", text: "Zwolnienie lekarskie w ciąży, kod B.", wizard: "birth" as const };
  return { title: "Odpis skrócony aktu urodzenia", text: "ZUS może pozyskać dane elektronicznie z rejestru.", wizard: "birth" as const };
}

function certificateDocument(employment: string, forms: string[]) {
  const has = (name: string) => forms.some((item) => item.includes(name));
  if (employment === "jdg") return { title: "Zaświadczenie Z-3", text: "Przy działalności składasz ZAM bezpośrednio do ZUS. Zaświadczenie Z-3 nie jest wymagane. Formularz Z-3b został zniesiony 24.10.2026 r.", status: "Nie dotyczy — wniosek ZAM do ZUS", tone: "success" as const };
  if (employment === "ustanie") return { title: "Dokument potwierdzający ustanie zatrudnienia", text: "Do wniosku ZAM dołączasz dokument potwierdzający ustanie zatrudnienia.", status: "Wymagane do ZUS", tone: "warning" as const };
  if (employment === "zlecenie") {
    return has("Z-3a")
      ? { title: "Zaświadczenie płatnika Z-3a", text: "Zleceniodawca przekazuje do ZUS formularz Z-3a z podstawą składek.", status: "Wymagane do ZUS", tone: "warning" as const }
      : { title: "Zaświadczenie płatnika Z-3a", text: "Zleceniodawca zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek.", status: "Nie dotyczy — wypłaca zleceniodawca", tone: "success" as const };
  }
  return has("Z-3")
    ? { title: "Zaświadczenie płatnika Z-3", text: "Pracodawca przekazuje do ZUS zaświadczenie Z-3.", status: "Wymagane do ZUS", tone: "warning" as const }
    : { title: "Zaświadczenie płatnika Z-3", text: "Płatnik zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek.", status: "Nie dotyczy — wypłaca pracodawca", tone: "success" as const };
}

type ChecklistKind = "zam" | "leave" | "birth" | "attachment";
type ChecklistSent = { zam: boolean; leave: boolean; birth: boolean };
type ChecklistFiles = Partial<Record<ChecklistKind, string>>;

const EMPTY_CHECKLIST_SENT: ChecklistSent = { zam: false, leave: false, birth: false };

function dialablePhones(phone: string) {
  return phone.split("/").flatMap((part) => {
    const label = part.trim();
    const matched = label.match(/\+?\d(?:[\d\s-]*\d)?/);
    const tel = (matched?.[0] ?? "").replace(/[^\d+]/g, "");
    return tel.length >= 3 ? [{ label, tel }] : [];
  });
}

function ChecklistAttach({ fileName, onPick, onClear }: { fileName?: string; onPick: (name: string) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState(false);

  return (
    <div className="attach-control">
      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="file-picker"
        aria-label={fileName ? `Zmień załącznik ${fileName}` : "Załącz plik PDF, JPG, PNG lub DOCX"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!/\.(pdf|jpe?g|png|docx)$/i.test(file.name)) {
            setRejected(true);
            return;
          }
          setRejected(false);
          onPick(file.name);
        }}
      />
      {fileName ? (
        <span className="file-edit">
          <button type="button" onClick={() => input.current?.click()}>Zmień</button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => { setRejected(false); onClear(); }}>Usuń</button>
        </span>
      ) : (
        <Button variant="secondary" onClick={() => input.current?.click()}>Załącz plik</Button>
      )}
      {rejected && <p className="form-error">Dozwolone pliki: PDF, JPG, PNG i DOCX.</p>}
    </div>
  );
}

function DocumentsView({ scenario, legislation, filed, goTo, anonymous = false, onInquire, files, setFiles, sent, setSent }: { scenario: Scenario; legislation: LegislationParams; filed: FiledPlan | null; goTo: (view: View) => void; anonymous?: boolean; onInquire: () => void; files: ChecklistFiles; setFiles: Dispatch<SetStateAction<ChecklistFiles>>; sent: ChecklistSent; setSent: Dispatch<SetStateAction<ChecklistSent>> }) {
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const [wizard, setWizard] = useState<ChecklistKind | null>(null);
  const usingPlan = Boolean(filed?.due);
  const employment = usingPlan ? filed!.employment : scenario.id.includes("jdg") ? "jdg" : scenario.id.includes("zlecenie") ? "zlecenie" : "uop";
  const isJdg = employment === "jdg";
  const isContract = employment === "zlecenie";
  const isEnd = employment === "ustanie";
  const isZus = usingPlan ? filed!.isZus : scenario.benefit_payer.is_zus;
  const forms = usingPlan ? filed!.forms : isJdg ? ["ZAM do ZUS"] : isEnd ? ["ZAM", "Dokument potwierdzający ustanie zatrudnienia"] : isContract ? (isZus ? ["Z-3a"] : []) : isZus ? ["Z-3"] : [];
  const benefitKind = usingPlan ? filed!.benefitKind : "birth";
  const certificate = certificateDocument(employment, forms);
  const eventDoc = eventDocument(benefitKind);
  const noLabourLeave = isJdg || isContract || isEnd;
  const routeSmall = isEnd ? "Wypłata przez ZUS po ustaniu zatrudnienia" : isJdg ? "Wniosek ZAM bez Z-3" : isContract ? (isZus ? "Po otrzymaniu Z-3a" : "Wypłaca zleceniodawca") : isZus ? "Wypłata po Z-3" : "Weryfikuje i nalicza";
  const routeTitle = isEnd ? "Zasiłek wypłaci ZUS po ustaniu zatrudnienia" : isZus ? "Zasiłek wypłaci bezpośrednio ZUS" : isContract ? "Zasiłek wypłaci zleceniodawca" : "Zasiłek wypłaci Twój pracodawca";
  const midLabel = isZus ? "ZUS" : isContract ? "Zleceniodawca" : "Pracodawca";
  const due = usingPlan ? filed!.due : scenario.due_date;
  const deadlineIso = usingPlan && filed!.deadline ? filed!.deadline : addDaysIso(due, legislation.deadline_days_81_5);
  const applicant = (usingPlan ? filed!.applicantName : (anonymous ? "" : scenario.user_name)).trim();
  const payerTitle = usingPlan ? filed!.payerTitle : scenario.benefit_payer.title;
  const base = usingPlan ? filed!.base : scenario.base_salary_gross;
  const dueCaption = !usingPlan || filed!.benefitKind === "birth" ? "Data porodu" : filed!.benefitKind === "pregnancy" ? "Początek zwolnienia" : "Data przyjęcia dziecka";
  const personCaption = usingPlan && filed!.role === "ojciec" ? "Ubezpieczony" : "Ubezpieczona";
  const employmentText = usingPlan ? employmentCaption(filed!.employment) : scenario.insurance_type;
  const singleRate = formatRate(legislation.rate_single_variant);
  const variantText = usingPlan && filed!.option !== "81.5" ? `${formatRate(legislation.rate_maternity)} + ${formatRate(legislation.rate_parental)}` : `${singleRate} przez cały okres`;
  const leaveName = usingPlan && filed!.benefitKind !== "birth" && filed!.benefitKind !== "pregnancy" ? "Urlop na warunkach urlopu macierzyńskiego" : "Urlop macierzyński";
  const maternityWeeks = usingPlan ? filed!.maternityWeeks : legislation.maternity_weeks_single;
  const parentalWeeks = usingPlan ? filed!.parentalWeeks : legislation.parental_weeks_single;
  const documents: { title: string; text: string; status: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; wizard: "zam" | "leave" | "birth" | "attachment"; primary?: boolean }[] = [
    { title: "Wniosek ZAM", text: "Zasiłek macierzyński, rodzicielski lub ojcowski", status: sent.zam ? "WYSŁANO (UPO wygenerowane)" : "Gotowy do wypełnienia", tone: "success", wizard: "zam", primary: true },
    { title: certificate.title, text: certificate.text, status: certificate.status, tone: certificate.tone, wizard: "attachment" },
    { title: "Wniosek o urlop do pracodawcy", text: noLabourLeave ? "Przy tej formie zatrudnienia nie składa się wniosku o urlop z Kodeksu pracy." : "Oddzielny od wniosku o wypłatę zasiłku", status: noLabourLeave ? "Nie dotyczy (brak urlopu z KP — przysługuje zasiłek z ZUS)" : sent.leave ? "WYSŁANO (UPO wygenerowane)" : "Wymaga podpisu", tone: noLabourLeave ? "neutral" : sent.leave ? "success" : "warning", wizard: "leave" },
    { title: eventDoc.title, text: eventDoc.text, status: sent.birth ? "WNIOSEK ZŁOŻONY" : "Do potwierdzenia", tone: sent.birth ? "success" : "neutral", wizard: "birth" },
  ];
  return (
    <>
      <PageIntro step="KROK 3 Z 4 · DOKUMENTY I TERMINY" title="Właściwy dokument, we właściwym miejscu" description={usingPlan ? (applicant ? `Wniosek jest uzupełniony z kalkulatora: ${applicant}, ${dueCaption.toLowerCase()} ${formatPlDate(due)}, ${variantText}, płatnik ${payerTitle}.` : `Plan z kalkulatora jest gotowy: ${dueCaption.toLowerCase()} ${formatPlDate(due)}, ${variantText}, płatnik ${payerTitle}. Imię i nazwisko uzupełnisz w kalkulatorze albo wybierzesz preset.`) : (anonymous ? "Parametry wybranej formy zatrudnienia. Imię i nazwisko nie są podstawiane — wpisz je w kalkulatorze albo wybierz preset." : `Na razie widać scenariusz ze startu (${scenario.user_name}). Po policzeniu planu w kalkulatorze te pola podstawią się same.`)}>
        <div className="intro-actions">
          <Button icon="clipboard" disabled={exporting} onClick={() => void (async () => {
            setExporting(true);
            setExportNote("");
            const saved = await downloadPdf("/api/export/checklist-pdf", usingPlan ? { scenario_id: scenario.id, parent_name: applicant, due_date: due, variant: filed!.option, benefit_type: benefitKind === "pregnancy" ? "ciaza_l4" : benefitKind === "adoption" ? "adopcja" : benefitKind === "foster" ? "piecza" : "porod", employment_type: employment, payer_title: payerTitle, payer_is_zus: isZus, required_forms: forms, payer_note: filed!.payerNote } : { scenario_id: scenario.id }, "checklista-dokumentow.pdf");
            setExporting(false);
            if (!saved) {
              setExportNote("Brak połączenia z API — otwarto podgląd wydruku.");
              window.print();
            }
          })()}>{exporting ? "Przygotowuję PDF…" : "Utwórz checklistę PDF"}</Button>
          {exportNote && <p className="export-note">{exportNote}</p>}
          <Button variant="secondary" onClick={onInquire}>Wyślij zapytanie do PUE/eZUS</Button>
        </div>
      </PageIntro>
      <section className="routing-card card">
        <SectionHeader eyebrow={`TWOJA ŚCIEŻKA · PŁATNIK: ${payerTitle.toUpperCase()}`} title={routeTitle} />
        <div className="routing-flow">
          <div className="route-node active"><span><Icon name="user" /></span><strong>Ty</strong><small>Wniosek + dokumenty</small></div><div className="route-arrow"><Icon name="arrow" /></div>
          <div className="route-node active"><span><Icon name={isZus ? "shield" : "clipboard"} /></span><strong>{midLabel}</strong><small>{routeSmall}</small></div><div className="route-arrow"><Icon name="arrow" /></div>
          <div className="route-node success"><span><Icon name="check" /></span><strong>Wypłata</strong><small>{isZus ? "Bezpośrednio z ZUS" : "W terminie wypłaty wynagrodzeń"}</small></div>
        </div>
        <div className="alternate-route"><span>Ścieżka dla tego scenariusza:</span><strong>Ty</strong><Icon name="arrow" size={14} /><strong>{isEnd ? "ZUS · ZAM i dokument ustania" : isJdg ? "ZUS · ZAM bez Z-3" : isContract ? (isZus ? "Z-3a → ZUS" : "Zleceniodawca") : isZus ? "Z-3 → ZUS" : "Pracodawca"}</strong><Icon name="arrow" size={14} /><strong>Wypłata</strong></div>
      </section>
      <div className="legislative-callout"><div className="callout-icon"><Icon name="info" /></div><div><Badge tone="info">AKTUALIZACJA 2026</Badge><h3>Zmiana od 24.10.2026 r.</h3><p>Formularze ZUR, ZAO oraz Z-3b zostały zlikwidowane. Wnioski o zasiłek macierzyński, rodzicielski i ojcowski składasz na zunifikowanym formularzu <strong>ZAM</strong>.</p></div><a href="https://www.zus.pl/swiadczenia/zasilki/zasilek-macierzynski" target="_blank" rel="noopener noreferrer">Sprawdź komunikat ZUS <Icon name="external" size={14} /></a></div>
      <section className="checklist-section">
        <SectionHeader eyebrow="TWOJA CHECKLISTA" title="4 kroki do złożenia wniosku" description={`Lista dopasowana do płatnika: ${payerTitle}.`} />
        <div className="document-list">{documents.map((doc, index) => {
          const attached = files[doc.wizard];
          return (
            <article className="document-row card" key={doc.wizard}>
              <span className="doc-number">{index + 1}</span>
              <div className="doc-icon"><Icon name={doc.wizard === "birth" ? "external" : "file"} /></div>
              <div className="doc-copy">
                <h3>{doc.title}</h3>
                <p>{doc.text}</p>
                {attached && <p className="attached-name">{attached}</p>}
              </div>
              {attached ? <Badge tone="success" className="badge-file">{`ZAŁĄCZONO (${attached})`}</Badge> : <Badge tone={doc.tone}>{doc.status}</Badge>}
              <div className="doc-actions">
                <Button variant="secondary" onClick={() => setWizard(doc.wizard)}>{doc.wizard === "birth" && benefitKind === "birth" ? "Podgląd i wniosek" : "Podgląd"}</Button>
                {doc.primary && <Button onClick={() => setWizard("zam")}>Wypełnij online</Button>}
                <ChecklistAttach
                  fileName={attached}
                  onPick={(name) => setFiles((current) => ({ ...current, [doc.wizard]: name }))}
                  onClear={() => setFiles((current) => {
                    const next = { ...current };
                    delete next[doc.wizard];
                    return next;
                  })}
                />
              </div>
            </article>
          );
        })}</div>
      </section>
      <section className="deadline-card card"><div><span className="deadline-icon"><Icon name="calendar" /></span><div><p className="eyebrow">NAJWAŻNIEJSZY TERMIN</p><h3>Do {formatLongPl(deadlineIso)}</h3><p>{usingPlan && filed!.option !== "81.5" ? `Wybrany wariant to ${variantText}. Ostatni dzień na wybór ${singleRate} to ${formatLongPl(deadlineIso)} (${dueCaption.toLowerCase()}: ${formatPlDate(due)}).` : `Złóż wniosek o wariant ${variantText} do ${formatLongPl(deadlineIso)} (${dueCaption.toLowerCase()}: ${formatPlDate(due)}).`}</p></div></div><Button variant="secondary" onClick={() => downloadDeadline(deadlineIso, usingPlan && filed!.option !== "81.5" ? singleRate : variantText, legislation.deadline_days_81_5, benefitKind)}>Dodaj do kalendarza</Button></section>
      <div className="official-links"><span>Oficjalne źródła:</span><a href="https://www.zus.pl" target="_blank" rel="noopener noreferrer">zus.pl <Icon name="external" size={12} /></a><a href="https://www.gov.pl/web/rodzina/urlop-rodzicielski" target="_blank" rel="noopener noreferrer">urlop rodzicielski <Icon name="external" size={12} /></a><a href="https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo" target="_blank" rel="noopener noreferrer">PIP · rodzicielstwo <Icon name="external" size={12} /></a></div>
      <section className="next-step">
        <div><span className="step-number">4</span><div><p className="eyebrow">NASTĘPNY KROK</p><h3>Gdy sytuacja jest trudniejsza</h3><p>Organizacje i wyjątki, których nie widać w samym wniosku.</p></div></div>
        <Button onClick={() => goTo("support")} icon="arrow">Przejdź do strefy wsparcia</Button>
      </section>
      {wizard && <DocumentWizard kind={wizard} applicant={applicant} personCaption={personCaption} employmentText={employmentText} payerTitle={payerTitle} isZus={isZus} isJdg={isJdg} base={base} due={due} dueCaption={dueCaption} variantText={variantText} leaveName={leaveName} maternityWeeks={maternityWeeks} parentalWeeks={parentalWeeks} eventTitle={eventDoc.title} attachmentTitle={certificate.title} benefitKind={benefitKind} noLabourLeave={noLabourLeave} attachedName={files[wizard]} onClose={() => setWizard(null)} onSent={(kind) => setSent((current) => ({ ...current, [kind]: true }))} />}
    </>
  );
}

function newCaseNumber() {
  const stamp = String(Math.floor(100000 + Math.random() * 900000));
  return `ZUS/PUE/2026/${stamp}`;
}

function DocumentWizard({ kind, applicant, personCaption, employmentText, payerTitle, isZus, isJdg, base, due, dueCaption, variantText, leaveName, maternityWeeks, parentalWeeks, eventTitle, attachmentTitle, benefitKind, noLabourLeave, attachedName, onClose, onSent }: { kind: ChecklistKind; applicant: string; personCaption: string; employmentText: string; payerTitle: string; isZus: boolean; isJdg: boolean; base: number; due: string; dueCaption: string; variantText: string; leaveName: string; maternityWeeks: number; parentalWeeks: number; eventTitle: string; attachmentTitle: string; benefitKind: string; noLabourLeave: boolean; attachedName?: string; onClose: () => void; onSent: (kind: "zam" | "leave" | "birth") => void }) {
  const [sentNow, setSentNow] = useState("");
  const [copy, setCopy] = useState(kind === "birth" ? "skrocony" : "zupelny");

  function send(target: "zam" | "leave" | "birth") {
    const assigned = newCaseNumber();
    setSentNow(assigned);
    onSent(target);
  }

  const title = kind === "zam" ? "Wniosek ZAM" : kind === "leave" ? "Wniosek o urlop do pracodawcy" : kind === "birth" ? eventTitle : attachmentTitle;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">SYMULACJA WNIOSKU · {applicant.trim() || "do uzupełnienia"}</p>
            <h2 id="wizard-title">{title}</h2>
            <p>Dane są z kalkulatora albo, zanim go otworzysz, z ekranu startowego. To nie jest wysyłka do prawdziwego ZUS.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="wizard-body">
          {attachedName && <p className="form-ok">Załączony plik: {attachedName}.</p>}
          {kind === "attachment" && <p>{attachmentTitle}. {isJdg ? "Przy JDG formularz Z-3 nie jest wymagany." : isZus ? "Dokument idzie do ZUS razem z wnioskiem ZAM." : "Przy płatniku powyżej 20 ubezpieczonych zaświadczenie do ZUS nie jest wymagane."}</p>}
          {kind === "zam" && (
            <dl className="wizard-fields">
              <div><dt>{personCaption}</dt><dd>{applicant.trim() || "Do uzupełnienia"}</dd></div>
              <div><dt>Tytuł ubezpieczenia</dt><dd>{employmentText}</dd></div>
              <div><dt>Płatnik</dt><dd>{payerTitle}</dd></div>
              <div><dt>Podstawa brutto</dt><dd>{pln(base)}</dd></div>
              <div><dt>{dueCaption}</dt><dd>{formatPlDate(due)}</dd></div>
              <div><dt>Wariant</dt><dd>{variantText}</dd></div>
            </dl>
          )}
          {kind === "leave" && noLabourLeave && <p>Nie dotyczy (brak urlopu z KP — przysługuje zasiłek z ZUS).</p>}
          {kind === "leave" && !noLabourLeave && (
            <dl className="wizard-fields">
              <div><dt>{personCaption}</dt><dd>{applicant.trim() || "Do uzupełnienia"}</dd></div>
              <div><dt>Adresat</dt><dd>{isZus ? "Pracodawca (urlop) · zasiłek wypłaca ZUS" : "Pracodawca"}</dd></div>
              <div><dt>{dueCaption}</dt><dd>{formatPlDate(due)}</dd></div>
              <div><dt>{leaveName}</dt><dd>{maternityWeeks} tygodni</dd></div>
              <div><dt>Urlop rodzicielski</dt><dd>{parentalWeeks} tygodni w tym planie, w tym część tylko dla drugiego rodzica</dd></div>
            </dl>
          )}
          {kind === "birth" && benefitKind !== "birth" && <p>{eventTitle}. To podgląd dokumentu potwierdzającego zdarzenie, bez wysyłki do sądu albo ZUS.</p>}
          {kind === "birth" && benefitKind === "birth" && (
            <>
              <p>Symulacja wniosku o odpis skrócony aktu urodzenia w Rejestrze Stanu Cywilnego.</p>
              <div className="wizard-choice">
                <label><input type="radio" name="copy" checked={copy === "skrocony"} onChange={() => setCopy("skrocony")} /> Odpis skrócony</label>
                <label><input type="radio" name="copy" checked={copy === "zupelny"} onChange={() => setCopy("zupelny")} /> Odpis zupełny</label>
              </div>
              <a className="text-link" href="https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego" target="_blank" rel="noopener noreferrer">Otwórz informację gov.pl o Rejestrze Stanu Cywilnego <Icon name="external" size={14} /></a>
            </>
          )}
          {sentNow && kind !== "attachment" && <p className="form-ok">Nadano numer sprawy {sentNow}. Status kroku został zaktualizowany.</p>}
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>Zamknij</Button>
          {kind === "zam" && <Button onClick={() => send("zam")}>Symuluj podpis i wysyłkę do ZUS / Pracodawcy</Button>}
          {kind === "leave" && !noLabourLeave && <Button onClick={() => send("leave")}>Symuluj podpis i wysyłkę do pracodawcy</Button>}
          {kind === "birth" && benefitKind === "birth" && <Button onClick={() => send("birth")}>Złóż wniosek o odpis {copy === "skrocony" ? "skrócony" : "zupełny"}</Button>}
        </div>
      </div>
    </div>
  );
}

function SupportView({ goTo, legislation, onLegislation, onInquire }: { goTo: (view: View) => void; legislation: LegislationParams; onLegislation: (next: LegislationParams) => void; onInquire: () => void }) {
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
        <div className="intro-actions"><Button variant="secondary" onClick={onInquire}>Wyślij zapytanie do PUE/eZUS</Button><Button variant="secondary" icon="settings" onClick={() => setAdmin(!admin)}>Panel administracyjny</Button></div>
      </PageIntro>
      <section className="support-hero"><div className="support-heart"><Icon name="heart" size={25} /></div><div><h2>W sytuacji trudnej zacznij od tego, co najważniejsze</h2><p>Wybierz temat. Pokażemy świadczenia, dokumenty i kontakty bez prawniczego żargonu.</p></div></section>
      <div className="hardship-grid">
        <article className="hardship-card card"><span className="topic-icon rose"><Icon name="heart" /></span><Badge tone="neutral">STRATA DZIECKA</Badge><h3>Urodzenie martwego dziecka lub zgon dziecka</h3><p>Prawo do zasiłku za okres 8 tygodni po porodzie, nie krócej niż przez 7 dni od dnia zgonu dziecka — zależnie od sytuacji prawnej.</p><button type="button" className="text-link" onClick={() => goTo("documents")}>Zobacz przewodnik krok po kroku <Icon name="arrow" size={14} /></button></article>
        <article className="hardship-card card"><span className="topic-icon blue"><Icon name="clock" /></span><Badge tone="info">WCZEŚNIACTWO</Badge><h3>Przedwczesny poród i hospitalizacja</h3><p>Uzupełniający urlop macierzyński zależy m.in. od tygodnia ciąży, masy urodzeniowej i czasu pobytu dziecka w szpitalu.</p><button type="button" className="text-link" onClick={() => goTo("calculator")}>Oblicz dodatkowy okres <Icon name="arrow" size={14} /></button></article>
        <article className="hardship-card card"><span className="topic-icon green-bg"><Icon name="shield" /></span><Badge tone="success">ZA ŻYCIEM</Badge><h3>Ciężka choroba lub niepełnosprawność dziecka</h3><p>Zaświadczenie „Za życiem” wydłuża wymiar urlopu rodzicielskiego do 65 tygodni przy jednym dziecku lub 67 przy porodzie mnogim.</p><button type="button" className="text-link" onClick={() => goTo("calculator")}>Sprawdź należne świadczenia w kalkulatorze <Icon name="arrow" size={14} /></button></article>
      </div>
      <section className="charity-section">
        <SectionHeader eyebrow="ZWERYFIKOWANE ORGANIZACJE" title="Bezpłatna pomoc blisko Ciebie" description="Kontakty sprawdzone przez zespół redakcyjny. W sytuacji zagrożenia życia zadzwoń pod 112." action={<div className="search-box"><Icon name="search" size={17} /><input aria-label="Szukaj organizacji" placeholder="Szukaj organizacji..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>} />
        {orgs.length === 0 ? <p className="empty-note">Brak organizacji dla „{search}”.</p> : <div className="charity-grid">{orgs.map((item) => <article className="charity-card card" key={item.id}><div className="charity-mark">{item.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><div><Badge tone="neutral">{item.badge}</Badge><h3>{item.name}</h3><p>{item.description}</p><div className="charity-links">{dialablePhones(item.phone).map((phone) => <a key={phone.tel} href={`tel:${phone.tel}`}><Icon name="phone" size={15} /> {phone.label}</a>)}<a href={item.website} target="_blank" rel="noopener noreferrer">Strona organizacji <Icon name="external" size={13} /></a></div></div></article>)}</div>}
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
            <button type="button" className="gateway-primary" onClick={onLogin}>Symuluj logowanie przez login.gov.pl (mObywatel) <Icon name="arrow" size={18} /></button>
            <div className="secure-note"><Icon name="lock" size={14} /><span>Lokalna symulacja Węzła Krajowego (login.gov.pl) na potrzeby demonstracji konkursowej. Przycisk nie otwiera zewnętrznej domeny rządowej.</span></div>
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
        <div className="gov-security"><Icon name="shield" size={19} /><div><strong>Bezpieczne połączenie z Węzłem Krajowym</strong><p>To lokalna symulacja ekranu Węzła Krajowego (login.gov.pl) na potrzeby demonstracji konkursowej. Aplikacja nie przekierowuje na zewnętrzną domenę rządową i nie prosi o PIN.</p></div></div>
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

function PueInquiry({ scenario, onClose, anonymous = false }: { scenario: Scenario; onClose: () => void; anonymous?: boolean }) {
  const [topic, setTopic] = useState("podstawa");
  const [note, setNote] = useState("Proszę o potwierdzenie tytułu ubezpieczenia, podstawy wymiaru zasiłku i salda płatnika.");
  const [caseNo, setCaseNo] = useState("");
  const [copied, setCopied] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setCopied(false);
    setCaseNo(newCaseNumber());
  }

  function copyCase() {
    const field = document.createElement("textarea");
    field.value = caseNo;
    field.setAttribute("readonly", "");
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    if (ok) {
      setCopied(true);
      return;
    }
    void navigator.clipboard.writeText(caseNo).then(() => setCopied(true), () => setCopied(false));
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="pue-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{anonymous ? "TRYB BEZ LOGOWANIA" : "ZAPYTANIE PUE/eZUS"}</p>
            <h2 id="pue-title">Wyślij zapytanie do PUE/eZUS</h2>
            <p>{anonymous ? `${previewVariantTitle(scenario)}. Zapytanie jest symulacją, bez konta ubezpieczonego.` : `${scenario.user_name} · ${scenario.insurance_status}`}</p>
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
          <h3>Treść zapytania</h3>
          <p className="helper">Po wysłaniu powstanie numer potwierdzenia w formacie <strong>ZUS/PUE/2026/......</strong> Numer liczy się w tej przeglądarce i nie trafia do systemu ZUS.</p>
          <div className="admin-form-grid">
            <div className="span-2"><label htmlFor="pue-topic">Temat</label><select id="pue-topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="podstawa">Podstawa wymiaru zasiłku</option><option value="ciaglosc">Ciągłość ubezpieczenia</option><option value="zadluzenie">Saldo i zadłużenie płatnika</option></select></div>
            <div className="span-2"><label htmlFor="pue-note">Treść</label><textarea id="pue-note" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          </div>
          {caseNo && (
            <div className="case-number" role="status">
              <span>Numer sprawy</span>
              <strong>{caseNo}</strong>
              <button type="button" onClick={() => void copyCase()}>{copied ? "Skopiowano" : "Kopiuj numer"}</button>
            </div>
          )}
          <div className="admin-form-actions">
            <Button type="submit">Wyślij zapytanie do PUE/eZUS</Button>
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
  const [authStep, setAuthStep] = useState<AuthStep>("portal-entry");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [legislation, setLegislation] = useState<LegislationParams>(FALLBACK_LEGISLATION);
  const [pueOpen, setPueOpen] = useState(false);
  const [pdfCase, setPdfCase] = useState<PdfCase | null>(null);
  const [transfer, setTransfer] = useState<{ token: number; item: PdfCase } | null>(null);
  const [filedPlan, setFiledPlan] = useState<FiledPlan | null>(null);
  const [checklistFiles, setChecklistFiles] = useState<ChecklistFiles>({});
  const [checklistSent, setChecklistSent] = useState<ChecklistSent>(EMPTY_CHECKLIST_SENT);
  const [calcForm, setCalcForm] = useState<CalculatorFormState>(() => scenarioForm(FALLBACK_SCENARIOS[0], false));
  const checklistFormKey = useRef("");
  const [activePresetId, setActivePresetId] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const seenTransfer = useRef(0);
  const scenarioReset = useRef(FALLBACK_SCENARIOS[0].id);
  const [demoIdentity, setDemoIdentity] = useState<{ name: string; subtitle: string } | null>(null);
  const onDemoIdentity = useCallback((identity: { name: string; subtitle: string } | null) => {
    setDemoIdentity(identity);
  }, []);
  const clearChecklist = useCallback(() => {
    setChecklistFiles({});
    setChecklistSent(EMPTY_CHECKLIST_SENT);
  }, []);
  const onFiledCase = useCallback((plan: FiledPlan) => {
    setFiledPlan(plan);
  }, []);

  useEffect(() => {
    const key = JSON.stringify(calcForm);
    if (checklistFormKey.current && checklistFormKey.current !== key) clearChecklist();
    checklistFormKey.current = key;
  }, [calcForm, clearChecklist]);
  const usePdfInCalculator = useCallback((item: PdfCase) => {
    setPdfCase(item);
    setTransfer({ token: Date.now(), item });
    setView("calculator");
  }, []);
  const activeIndex = useMemo(() => navItems.findIndex((item) => item.id === view), [view]);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const resetCalculator = (next: Scenario, guest: boolean) => {
    scenarioReset.current = next.id;
    setCalcForm(scenarioForm(next, guest));
    setActivePresetId("");
    setShowSchedule(false);
    setFiledPlan(null);
    clearChecklist();
  };

  useEffect(() => {
    if (scenarioReset.current === scenario.id) return;
    resetCalculator(scenario, previewMode && !authUser);
  }, [scenario, previewMode, authUser]);

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

  if (authStep === "login-gov-mobywatel") {
    return <LoginGov onBack={() => setAuthStep("portal-entry")} onConfirm={(user) => { setAuthUser(user); setPreviewMode(false); setAuthStep("authenticating"); }} />;
  }
  if (authStep === "authenticating") {
    return <Authenticating onDone={() => setAuthStep("authenticated-dashboard")} />;
  }

  const authenticated = authStep === "authenticated-dashboard";
  const anonymous = previewMode && !authUser;
  const calculatorIdentity = view === "calculator" ? demoIdentity : null;
  const headerName = calculatorIdentity?.name ?? (authUser?.full_name ?? "Użytkownik");
  const headerStatus = calculatorIdentity?.subtitle ?? `Zweryfikowano: mObywatel${authUser ? ` · ${authUser.pesel_masked}` : ""}`;
  const simulationTitle = anonymousBarTitle(scenario, calculatorIdentity);
  const leaveToPortal = () => {
    setAuthStep("portal-entry");
    setView("status");
    setPreviewMode(false);
    setAuthUser(null);
    setTransfer(null);
    setDemoIdentity(null);
    resetCalculator(scenario, true);
  };
  const enterPreview = (selectedId: string) => {
    const next = scenarios.find((item) => item.id === selectedId) ?? scenario;
    setScenarioId(selectedId);
    setPreviewMode(true);
    setAuthUser(null);
    setTransfer(null);
    setDemoIdentity(null);
    resetCalculator(next, true);
    setView("status");
    setAuthStep("authenticated-dashboard");
  };

  return (
    <div className={`app official-app ${contrast ? "high-contrast" : ""}`} style={{ fontSize: `${fontScale}rem` }}>
      <header>
        <div className="utility-strip">
          <div className="shell utility-shell">
            <div className="utility-links"><a href="#main-content">Przejdź do treści</a><button type="button" className="mock-header-control" title="Element makiety nagłówka PUE/eZUS (niedostępny w wersji demonstracyjnej)">Deklaracja dostępności</button><button type="button" className="mock-header-control" title="Element makiety nagłówka PUE/eZUS (niedostępny w wersji demonstracyjnej)">BIP <span>(Biuletyn Informacji Publicznej)</span></button></div>
            <div className="accessibility-tools">
              <div className="official-font-controls" aria-label="Zmiana rozmiaru tekstu"><button onClick={() => setFontScale(.94)}>A−</button><button className={fontScale === 1 ? "active" : ""} onClick={() => setFontScale(1)}>A</button><button onClick={() => setFontScale(1.06)}>A+</button></div>
              <button className={`contrast-toggle ${contrast ? "active" : ""}`} onClick={() => setContrast(!contrast)}><span>◐</span> Wersja kontrastowa</button>
              <span className="language-lock" title="Interfejs jest po polsku. Tłumaczenia EN i UA nie są w tej wersji.">PL</span>
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
                  <button type="button" className="register-button mock-header-control" title="Element makiety nagłówka PUE/eZUS (niedostępny w wersji demonstracyjnej)">Zarejestruj w PUE/eZUS</button>
                  <button className="official-login-button" onClick={() => setAuthStep("login-gov-mobywatel")}><Icon name="user" size={17} /> Zaloguj do PUE/eZUS przez mObywatel <Icon name="arrow" size={16} /></button>
                </>
              ) : anonymous ? (
                <div className="guest-actions">
                  <div className="guest-status">Tryb bez logowania (podgląd)</div>
                  <button type="button" className="official-login-button guest-login" onClick={() => setAuthStep("login-gov-mobywatel")}><Icon name="user" size={17} /> Zaloguj przez mObywatel</button>
                  <button type="button" className="guest-back" onClick={leaveToPortal}>Zmień tryb / wróć na start</button>
                </div>
              ) : (
                <>
                  <div className="verified-user"><span className="avatar">{initials(headerName)}</span><div><strong>{headerName}</strong><small>{headerStatus} <Icon name="check" size={12} /></small></div></div>
                  <button type="button" className="logout-button" onClick={leaveToPortal}>Wyloguj <span>/ Testuj logowanie ponownie</span></button>
                </>
              )}
            </div>
          </div>
        </div>
        {authenticated && <div className="user-bar">
          <div className="shell user-shell">
            {anonymous ? (
              <div className="user-profile guest-profile"><div className="avatar guest-avatar" aria-hidden="true"><Icon name="calculator" size={18} /></div><div><strong>{simulationTitle}</strong><span>Przykładowe parametry zatrudnienia, bez konta PUE/eZUS</span></div></div>
            ) : (
              <div className="user-profile"><div className="avatar">{initials(calculatorIdentity?.name ?? scenario.user_name)}</div><div><strong>{calculatorIdentity?.name ?? scenario.user_name}</strong><span><i /> {calculatorIdentity ? calculatorIdentity.subtitle : <>Ubezpieczenie chorobowe: <b>{scenario.insurance_status}</b></>}</span></div></div>
            )}
            <button type="button" className={`connected-pill${anonymous ? " guest-pill" : " inquiry-pill"}`} onClick={() => setPueOpen(true)}><span><Icon name={anonymous ? "calculator" : "link"} size={14} /></span><div><small>{anonymous ? "TRYB" : "ZAPYTANIE"}</small><strong>{anonymous ? "Bez konta PUE" : "Wyślij zapytanie do PUE/eZUS"}</strong></div><Icon name="chevron" size={14} /></button>
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
            {view === "status" && <StatusView goTo={setView} scenario={scenario} legislation={legislation} anonymous={anonymous} onLogin={() => setAuthStep("login-gov-mobywatel")} onInquire={() => setPueOpen(true)} />}
            {view === "calculator" && <CalculatorView scenario={scenario} legislation={legislation} pdfCase={pdfCase} transfer={transfer} onDemoIdentity={onDemoIdentity} onFiledCase={onFiledCase} onResetChecklist={clearChecklist} goTo={setView} anonymous={anonymous} form={calcForm} setForm={setCalcForm} presetId={activePresetId} setPresetId={setActivePresetId} showSchedule={showSchedule} setShowSchedule={setShowSchedule} seenTransfer={seenTransfer} />}
            {view === "pdf" && <PdfView onParsed={setPdfCase} onCalculate={usePdfInCalculator} />}
            {view === "documents" && <DocumentsView scenario={scenario} legislation={legislation} filed={filedPlan} goTo={setView} anonymous={anonymous} onInquire={() => setPueOpen(true)} files={checklistFiles} setFiles={setChecklistFiles} sent={checklistSent} setSent={setChecklistSent} />}
            {view === "support" && <SupportView goTo={setView} legislation={legislation} onLegislation={setLegislation} onInquire={() => setPueOpen(true)} />}
            {pueOpen && <PueInquiry scenario={scenario} anonymous={anonymous} onClose={() => setPueOpen(false)} />}
          </div>
        </>
      ) : <PortalEntry scenarios={scenarios} onLogin={() => setAuthStep("login-gov-mobywatel")} onPreview={enterPreview} />}
      <footer className="official-footer"><div className="shell footer-shell"><div><ZusLogo /><span><strong>eZUS Rodzic+</strong><small>Asystent Świadczeń Rodzicielskich</small></span></div><p>Wyniki mają charakter informacyjny i nie stanowią decyzji ZUS ani porady prawnej.{apiOnline === false ? " Tryb lokalny: obliczenia z danych przykładowych." : ""}{apiOnline === true ? " Połączono z API eZUS Rodzic+." : ""}</p><div><a href="https://www.zus.pl" target="_blank" rel="noopener noreferrer">zus.pl</a><a href="https://www.gov.pl/web/rodzina/urlop-rodzicielski" target="_blank" rel="noopener noreferrer">urlop rodzicielski</a><a href="https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo" target="_blank" rel="noopener noreferrer">PIP · rodzicielstwo</a></div></div></footer>
    </div>
  );
}
