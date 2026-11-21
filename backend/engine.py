import copy
import math
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from database import get_legislation_params

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "uop_over_20": {
        "id": "uop_over_20",
        "label": "1. Pracownica UoP (>20 os.)",
        "user_name": "Anna Kowalska",
        "first_name": "Anna",
        "insurance_status": "AKTYWNE (UoP)",
        "insurance_type": "Obowiązkowe • umowa o pracę • ciągłość od 14.02.2022",
        "waiting_period": {"status": "Spełniony", "note": "minimum 30 dni", "ok": True},
        "benefit_payer": {"title": "Pracodawca", "note": "powyżej 20 ubezpieczonych", "is_zus": False},
        "due_date": "2026-09-18",
        "payer_account": {
            "has_debt": False,
            "debt_amount": 0.0,
            "note": "Brak zadłużenia • Saldo na dzień nabycia prawa: 0,00 zł"
        },
        "ezla": {
            "period": "03.06–30.08.2026",
            "days_used": 76,
            "days_limit": 270,
            "days_left": 194,
            "code": "KOD B • 100%"
        },
        "base_salary_gross": 8200.00,
        "risks": [
            {"level": "warning", "badge": "DO SPRAWDZENIA", "title": "Ciągłość ubezpieczenia do porodu",
             "desc": "Rozwiązanie umowy przed dniem porodu może zmienić prawo do świadczeń. Wyjątki dotyczą m.in. upadłości lub likwidacji pracodawcy."},
            {"level": "info", "badge": "WAŻNE DLA JDG", "title": "Podstawa wymiaru świadczenia",
             "desc": "ZUS lub płatnik uwzględni przeciętne wynagrodzenie z pełnych miesięcy ubezpieczenia poprzedzających niezdolność do pracy."},
            {"level": "ok", "badge": "OCHRONA AKTYWNA", "title": "Ochrona stosunku pracy",
             "desc": "W okresie ciąży i urlopu pracodawca co do zasady nie może wypowiedzieć ani rozwiązać umowy o pracę."}
        ]
    },
    "jdg_active": {
        "id": "jdg_active",
        "label": "2. JDG — dobrowolne chorobowe (>90 dni)",
        "user_name": "Anna Kowalska (JDG)",
        "first_name": "Anna",
        "insurance_status": "AKTYWNE (JDG)",
        "insurance_type": "Dobrowolne chorobowe • JDG • opłacane od 01.01.2024",
        "waiting_period": {"status": "Spełniony", "note": "minimum 90 dni dla JDG", "ok": True},
        "benefit_payer": {"title": "ZUS", "note": "płatnik samodzielny (JDG)", "is_zus": True},
        "due_date": "2026-09-18",
        "payer_account": {
            "has_debt": False,
            "debt_amount": 0.0,
            "note": "Brak zadłużenia > 1% minimalnego wynagrodzenia"
        },
        "ezla": {
            "period": "10.07–30.08.2026",
            "days_used": 52,
            "days_limit": 270,
            "days_left": 218,
            "code": "KOD B • 100%"
        },
        "base_salary_gross": 6500.00,
        "risks": [
            {"level": "warning", "badge": "KONTROLA ZUS", "title": "Podwyższenie podstawy składek",
             "desc": "Nagła deklaracja maksymalnej podstawy przed porodem często skutkuje kontrolą tytułu ubezpieczenia przez ZUS."},
            {"level": "warning", "badge": "PILNUJ TERMINÓW", "title": "Zadłużenie powyżej 1% płacy minimalnej",
             "desc": "Zaległość przekraczająca 1% minimalnego wynagrodzenia wstrzymuje wypłatę zasiłku do czasu pełnej spłaty."},
            {"level": "ok", "badge": "ZUS PŁATNIKIEM", "title": "Wniosek ZAM bezpośrednio do ZUS",
             "desc": "Przy JDG składasz wyłącznie wniosek ZAM przez eZUS bez zaświadczenia Z-3."}
        ]
    },
    "zlecenie_no_waiting": {
        "id": "zlecenie_no_waiting",
        "label": "3. Umowa zlecenie (<90 dni chorobowego)",
        "user_name": "Anna Kowalska (Zlecenie)",
        "first_name": "Anna",
        "insurance_status": "AKTYWNE (Zlecenie)",
        "insurance_type": "Dobrowolne chorobowe • zgłoszenie od 01.08.2026",
        "waiting_period": {"status": "Brak 90 dni (dla L4)", "note": "Macierzyński przysługuje od 1. dnia!", "ok": True},
        "benefit_payer": {"title": "ZUS", "note": "zleceniodawca < 20 ubezpieczonych", "is_zus": True},
        "due_date": "2026-09-18",
        "payer_account": {
            "has_debt": False,
            "debt_amount": 0.0,
            "note": "Składki rozliczane przez zleceniodawcę"
        },
        "ezla": {
            "period": "Brak e-ZLA",
            "days_used": 0,
            "days_limit": 270,
            "days_left": 270,
            "code": "BRAK L4"
        },
        "base_salary_gross": 5400.00,
        "risks": [
            {"level": "ok", "badge": "WAŻNY WYJĄTEK", "title": "Zasiłek macierzyński bez okresu wyczekiwania",
             "desc": "Do zasiłku macierzyńskiego NIE obowiązuje 90-dniowy okres wyczekiwania — wystarczy podleganie ubezpieczeniu w dniu porodu."},
            {"level": "warning", "badge": "UWAGA NA L4", "title": "Brak prawa do zasiłku chorobowego przed porodem",
             "desc": "Przed upływem 90 dni dobrowolnego ubezpieczenia zwolnienie lekarskie w ciąży będzie bezpłatne."},
            {"level": "info", "badge": "DOKUMENT Z-3a", "title": "Wymagane zaświadczenie zleceniodawcy Z-3a",
             "desc": "Zleceniodawca musi przekazać do ZUS formularz Z-3a z podstawą składek."}
        ]
    }
}


CONTRIBUTION_RATE = Decimal("0.1371")
MIN_WAGE_2026 = Decimal("4806.00")
MAX_DECLARED_GROSS_2026 = Decimal("23550.00")


def _money(value: Decimal | float | int) -> float:
    return float(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


BENEFIT_BASE_FLOOR = _money(MIN_WAGE_2026 * (1 - CONTRIBUTION_RATE))
MAX_BENEFIT_BASE_2026 = _money(MAX_DECLARED_GROSS_2026 * (1 - CONTRIBUTION_RATE))
PARENTAL_BENEFIT_FLOOR = 1000.00
PIT_ADVANCE = 0.12
DEBT_LIMIT = _money(MIN_WAGE_2026 * Decimal("0.01"))
MONTHS_PL = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"]

EVENT_ALIASES = {
    "porod": "porod",
    "birth": "porod",
    "ciaza": "ciaza_l4",
    "ciaza_l4": "ciaza_l4",
    "pregnancy": "ciaza_l4",
    "adopcja": "adopcja",
    "adoption": "adopcja",
    "piecza": "piecza",
    "piecza_zastepcza": "piecza",
    "foster": "piecza",
}


def _rate_label(rate: float) -> str:
    percent = (Decimal(str(rate)) * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    text = f"{percent:.2f}"
    if text.endswith("00"):
        text = text[:-3]
    elif text.endswith("0"):
        text = text[:-1]
    return text.replace(".", ",") + "%"


def _finite(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number or number in (float("inf"), float("-inf")):
        return default
    return number


def _optional_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    return _finite(value, 0.0)


def _parse_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _add_days(start: date, days: int) -> date:
    return start + timedelta(days=days)


def _month_label(day: date) -> str:
    return f"{MONTHS_PL[day.month - 1]} {day.year}"


def _next_month(day: date) -> date:
    if day.month == 12:
        return date(day.year + 1, 1, 1)
    return date(day.year, day.month + 1, 1)


def supplementary_weeks(
    preg_week: Optional[float],
    grams: Optional[float],
    hospital_days: Optional[float],
    stay_from: Optional[float] = None,
    stay_to: Optional[float] = None,
) -> int:
    """Art. 180² KP — uzupełniający urlop macierzyński za hospitalizację dziecka."""
    if preg_week is None:
        return 0
    week = int(preg_week)
    days = 0 if hospital_days is None else int(hospital_days)
    if week >= 37 and stay_from is not None and stay_to is not None:
        start = int(stay_from)
        end = int(stay_to)
        days = max(0, min(end, 28) - max(start, 5) + 1) if end >= start else 0
    if days <= 0:
        return 0
    counted = math.ceil(days / 7)
    if week < 28 or (grams is not None and grams <= 1000):
        return min(15, counted)
    if 28 <= week <= 36:
        return min(8, counted)
    if week >= 37 and days >= 2:
        return min(8, counted)
    return 0


def _standard_dimensions(law: Dict[str, Any], children: int, za_zyciem: bool) -> Tuple[int, int]:
    maternity_base = int(law["maternity_weeks_single"])
    shift = maternity_base - 20
    maternity_map = {1: maternity_base, 2: 31 + shift, 3: 33 + shift, 4: 35 + shift, 5: 37 + shift}
    maternity = max(1, maternity_map.get(children, maternity_base))
    parental_base = int(law["parental_weeks_single"])
    parental_shift = parental_base - 41
    if za_zyciem:
        parental = (65 if children == 1 else 67) + parental_shift
    else:
        parental = parental_base if children == 1 else parental_base + 2
    return maternity, max(1, parental)


def _parental_cap(children: int, za_zyciem: bool) -> int:
    if za_zyciem:
        return 130 if children == 1 else 134
    return 82 if children == 1 else 86


def _minimum_care(za_zyciem: bool) -> Tuple[int, int]:
    return 9, (62 if za_zyciem else 38)


def _apply_age_cap(event: str, maternity: int, parental: int, za_zyciem: bool, age_years: Optional[float], school_deferral: bool, notes: List[str]) -> Tuple[int, int]:
    if event not in ("adopcja", "piecza"):
        return maternity, parental
    limit = 14 if event == "adopcja" else (10 if school_deferral else 7)
    label = "14 lat" if event == "adopcja" else ("10 lat (odroczenie obowiązku szkolnego)" if school_deferral else "7 lat")
    if age_years is None:
        notes.append(f"Podaj wiek dziecka. Dla tego zdarzenia wymiar ucina data ukończenia {label} (art. 183 KP).")
        return maternity, parental
    if age_years >= limit:
        notes.append(f"Dziecko ukończyło już {label}. Urlop na warunkach macierzyńskiego i rodzicielski nie przysługują.")
        return 0, 0
    left_weeks = ((limit - age_years) * 365) / 7
    standard_total = maternity + parental
    min_mat, min_par = _minimum_care(za_zyciem)
    minimum_total = min_mat + min_par
    if left_weeks >= standard_total:
        return maternity, parental
    if left_weeks < minimum_total:
        notes.append(f"Do ukończenia {label} zostało mniej niż wymiar standardowy. Przyznano gwarantowane minimum: {min_mat} tyg. na warunkach macierzyńskiego i {min_par} tyg. rodzicielskiego.")
        return min_mat, min_par
    granted = int(math.floor(left_weeks))
    notes.append(f"Wymiar ucięty do {granted} tyg., bo dziecko kończy {label} przed końcem pełnego urlopu.")
    maternity_part = min(maternity, granted)
    return maternity_part, granted - maternity_part


def _benefit_basis(employment: str, gross: float, notes: List[str], contract_fte: float = 1.0) -> Tuple[float, float]:
    fte = Decimal(str(min(1.0, max(0.01, contract_fte or 1.0))))
    declared = Decimal(str(max(0.0, gross)))
    if declared <= 0:
        return 0.0, 0.0
    if employment == "uop":
        floor_gross = (MIN_WAGE_2026 * fte).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if declared < floor_gross:
            notes.append(f"Podstawa UoP podniesiona do podłogi {fte} etatu: {floor_gross:.2f} zł brutto.")
            declared = floor_gross
    if employment in ("jdg", "zlecenie") and declared > MAX_DECLARED_GROSS_2026:
        notes.append(f"Podstawa ścięta do 250% prognozowanego wynagrodzenia na 2026 r.: {MAX_DECLARED_GROSS_2026:.2f} zł.")
        declared = MAX_DECLARED_GROSS_2026
    basis = _money(declared * (1 - CONTRIBUTION_RATE))
    if employment in ("jdg", "zlecenie"):
        basis = min(basis, MAX_BENEFIT_BASE_2026)
    return _money(declared), basis


def _monthly_amount(basis: float, rate: float) -> Tuple[float, float, bool]:
    gross = round(basis * rate, 2)
    net = round(gross * (1 - PIT_ADVANCE), 2)
    if 0 < net < PARENTAL_BENEFIT_FLOOR:
        return PARENTAL_BENEFIT_FLOOR, PARENTAL_BENEFIT_FLOOR, True
    return gross, net, False


def _payer(employment: str, insured_count: int) -> Dict[str, Any]:
    count = max(0, insured_count)
    zus = employment in ("jdg", "ustanie") or count <= 20
    if employment == "jdg":
        forms = ["ZAM do ZUS"]
        note = "Przy działalności zasiłek wypłaca ZUS. Zaświadczenie Z-3 nie jest wymagane. Formularz Z-3b został zlikwidowany 24.10.2026 r."
        title = "ZUS"
    elif employment == "ustanie":
        forms = ["ZAM", "dokument ustania zatrudnienia"]
        note = "Po ustaniu ubezpieczenia z powodu upadłości lub likwidacji zasiłek wypłaca ZUS."
        title = "ZUS"
    elif employment == "zlecenie":
        forms = ["Z-3a"] if zus else []
        title = "ZUS" if zus else "Zleceniodawca"
        note = "Zleceniodawca zgłasza nie więcej niż 20 ubezpieczonych, więc zasiłek wypłaca ZUS po Z-3a." if zus else "Zleceniodawca zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek."
    else:
        forms = ["Z-3"] if zus else []
        title = "ZUS" if zus else "Pracodawca"
        note = "Płatnik zgłasza nie więcej niż 20 ubezpieczonych, więc zasiłek wypłaca ZUS po zaświadczeniu Z-3." if zus else "Płatnik zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek."
    return {"title": title, "is_zus": zus, "required_forms": forms, "insured_count": count, "note": note}


def _names(payload: Dict[str, Any]) -> Tuple[str, str, str]:
    role = str(payload.get("parent_role") or "matka").strip().lower()
    if role not in ("matka", "ojciec", "opiekun"):
        role = "matka"
    applicant = str(payload.get("parent_name") or "").strip()
    second = str(payload.get("second_parent_name") or "").strip()
    if role == "ojciec":
        father = applicant or "Ojciec"
        mother = second or "Matka"
    elif role == "opiekun":
        mother = applicant or "Opiekun"
        father = second or "Drugi rodzic"
    else:
        mother = applicant or "Matka"
        father = second or "Ojciec"
    return role, mother, father


def _schedule(segments: List[Dict[str, Any]], anchor: date) -> List[Dict[str, Any]]:
    if not segments:
        return []
    start = min(item["start"] for item in segments)
    end = max(item["end"] for item in segments)
    rows: List[Dict[str, Any]] = []
    cursor = date(start.year, start.month, 1)
    guard = 0
    while cursor <= end and guard < 48:
        month_end = _next_month(cursor) - timedelta(days=1)
        for item in segments:
            days = (min(item["end"], month_end) - max(item["start"], cursor)).days + 1
            if days <= 0:
                continue
            amount = round(item["monthly"] * days / 30, 2)
            rows.append({
                "month_label": _month_label(cursor),
                "parent": item["parent"],
                "benefit_type": item["kind"],
                "rate": _rate_label(item["rate"]),
                "gross_amount": amount,
                "days": days,
            })
        cursor = _next_month(cursor)
        guard += 1
    if not rows and anchor:
        return rows
    return rows


def _segment(start: date, days: int, parent: str, kind: str, rate: float, basis: float) -> Optional[Dict[str, Any]]:
    if days <= 0 or basis <= 0:
        return None
    monthly, _, uplift = _monthly_amount(basis, rate)
    return {
        "start": start,
        "end": _add_days(start, days - 1),
        "parent": parent,
        "kind": kind,
        "rate": rate,
        "monthly": monthly,
        "uplift": uplift,
    }


def calculate_benefit_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    law = get_legislation_params()
    notes: List[str] = []
    event = EVENT_ALIASES.get(str(payload.get("benefit_type") or "porod").strip().lower(), "porod")
    employment = str(payload.get("employment_type") or "uop").strip().lower()
    if employment not in ("uop", "zlecenie", "jdg", "ustanie"):
        employment = "uop"
    children = min(5, max(1, int(round(_finite(payload.get("children_count", 1), 1)))))
    za_zyciem = bool(payload.get("za_zyciem", False))
    variant = "81.5" if str(payload.get("variant") or "81.5") == "81.5" else "100_70"
    anchor = _parse_date(payload.get("due_date"))
    role, mother, father = _names(payload)
    special = bool(payload.get("matka_nie_moze_opiekowac", False))
    insured_count = int(round(_finite(payload.get("liczba_ubezpieczonych", 21), 21)))
    payer = _payer(employment, insured_count)
    contract_fte = _optional_number(payload.get("wymiar_etatu"))
    declared, basis = _benefit_basis(employment, _finite(payload.get("base_salary_gross", 0), 0), notes, 1.0 if contract_fte is None else contract_fte)
    debt = _finite(payload.get("debt_amount", 0), 0)
    waiting = _optional_number(payload.get("waiting_days"))
    entitled = True
    denial = ""

    date_missing = anchor is None
    if anchor is None:
        entitled = False
        denial = "Podaj datę porodu, przyjęcia dziecka albo początku zwolnienia."
        anchor = date.today()
    if employment in ("jdg", "zlecenie") and debt > DEBT_LIMIT:
        entitled = False
        denial = f"Zadłużenie {debt:.2f} zł przekracza 1% minimalnego wynagrodzenia ({DEBT_LIMIT:.2f} zł). Art. 2a ustawy zasiłkowej wstrzymuje prawo do zasiłku do czasu spłaty."
    if event == "ciaza_l4" and employment in ("jdg", "zlecenie") and waiting is not None and waiting < 90:
        entitled = False
        denial = "Do zasiłku chorobowego przy dobrowolnym ubezpieczeniu potrzeba 90 dni podlegania. Zasiłek macierzyński tego wyczekiwania nie wymaga."

    rate_full = 1.0
    rate_maternity = float(law["rate_single_variant"]) / 100.0 if variant == "81.5" else float(law["rate_maternity"]) / 100.0
    rate_parental_own = rate_maternity if variant == "81.5" else float(law["rate_parental"]) / 100.0
    rate_parental_other = float(law["rate_parental"]) / 100.0

    if not entitled:
        basis_for_pay = 0.0
    else:
        basis_for_pay = basis

    segments: List[Dict[str, Any]] = []
    pre_weeks = 0
    post_weeks = 0
    extra_weeks = 0
    mother_parental = 0
    father_exclusive = 0
    extension_weeks = 0
    extension_days = 0
    paternity_weeks = 0
    parental_cap = _parental_cap(children, za_zyciem)
    pregnancy: Dict[str, Any] = {}

    if event == "ciaza_l4":
        sick_days = max(0, int(round(_finite(payload.get("dni_niezdolnosci", 0), 0))))
        age = _optional_number(payload.get("wiek_ubezpieczonego"))
        employer_cap = 0
        if employment == "uop":
            employer_cap = 14 if age is not None and age >= 50 else 33
            if age is None:
                notes.append("Nie podano wieku. Dla umowy o pracę przyjęto 33 dni wynagrodzenia chorobowego w roku (próg 14 dni dotyczy osób, które ukończyły 50 lat).")
        paid_sick = min(sick_days, 270)
        employer_days = min(employer_cap, paid_sick)
        zus_days = paid_sick - employer_days
        rehab_requested = int(round(_finite(payload.get("miesiace_rehabilitacji", 0), 0)))
        if paid_sick >= 270:
            overflow = max(0, sick_days - 270)
            requested = rehab_requested * 30 if rehab_requested else overflow
            rehab_days = min(365, requested)
        else:
            rehab_days = 0
        still_pregnant = bool(payload.get("rehabilitacja_w_ciazy", True))
        cursor = anchor
        employer_part = _segment(cursor, employer_days, mother, "Wynagrodzenie chorobowe (kod B)", rate_full, basis_for_pay)
        if employer_part:
            segments.append(employer_part)
            cursor = _add_days(employer_part["end"], 1)
        zus_part = _segment(cursor, zus_days, mother, "Zasiłek chorobowy 100%", rate_full, basis_for_pay)
        if zus_part:
            segments.append(zus_part)
            cursor = _add_days(zus_part["end"], 1)
        if rehab_days and still_pregnant:
            rehab = _segment(cursor, rehab_days, mother, "Świadczenie rehabilitacyjne w ciąży", rate_full, basis_for_pay)
            if rehab:
                segments.append(rehab)
        elif rehab_days:
            first = min(90, rehab_days)
            rest = rehab_days - first
            high = _segment(cursor, first, mother, "Świadczenie rehabilitacyjne 90%", 0.90, basis_for_pay)
            if high:
                segments.append(high)
                cursor = _add_days(high["end"], 1)
            low = _segment(cursor, rest, mother, "Świadczenie rehabilitacyjne 75%", 0.75, basis_for_pay)
            if low:
                segments.append(low)
        pregnancy = {
            "sick_days_paid": paid_sick,
            "employer_days": employer_days,
            "zus_sick_days": zus_days,
            "rehab_days": rehab_days,
            "limit_days": 270,
            "rehab_in_pregnancy": still_pregnant,
        }
        display_rate = rate_full
        monthly_gross, monthly_net, uplift = _monthly_amount(basis_for_pay, rate_full)
        total_days = paid_sick + rehab_days
        total_weeks = total_days // 7
        extra_day_count = total_days % 7
    else:
        maternity, parental = _standard_dimensions(law, children, za_zyciem)
        age_years = _optional_number(payload.get("wiek_dziecka_lata"))
        maternity, parental = _apply_age_cap(event, maternity, parental, za_zyciem, age_years, bool(payload.get("odroczenie_obowiazku_szkolnego")), notes)
        if event == "porod":
            pre_weeks = min(6, max(0, int(round(_finite(payload.get("tygodnie_przed_porodem", 0), 0)))))
            pre_weeks = min(pre_weeks, maternity)
        post_weeks = max(0, maternity - pre_weeks)
        extra_weeks = 0 if event != "porod" else supplementary_weeks(
            _optional_number(payload.get("tydzien_ciazy_porodu")),
            _optional_number(payload.get("masa_urodzeniowa_g")),
            _optional_number(payload.get("dni_w_szpitalu")),
            _optional_number(payload.get("hospitalizacja_od_dnia")),
            _optional_number(payload.get("hospitalizacja_do_dnia")),
        )
        father_exclusive = min(9, parental)
        mother_parental = max(0, parental - father_exclusive)
        etat = _optional_number(payload.get("etat_pracy"))
        if etat is None:
            legacy = _finite(payload.get("work_share", 0), 0)
            etat = legacy / 100 if legacy > 1 else legacy
        etat = min(0.5, max(0.0, etat))
        combine_input = _optional_number(payload.get("tygodnie_laczenia"))
        if employment != "uop":
            if etat > 0:
                notes.append("Łączenie urlopu rodzicielskiego z pracą u tego pracodawcy dotyczy pracownika (art. 182¹e KP). Przy innym tytule etat pominięto.")
            etat = 0.0
        owner_pool = mother_parental if role != "ojciec" else father_exclusive
        combine = 0.0
        if etat > 0:
            combine = owner_pool if combine_input is None else min(owner_pool, max(0.0, combine_input))
        raw_extra = combine * etat
        room = max(0.0, parental_cap - parental)
        raw_extra = min(raw_extra, room)
        extension_total_days = int(math.floor(raw_extra * 7))
        extension_weeks = extension_total_days // 7
        extension_days = extension_total_days % 7
        full_parental_rate = rate_parental_own if role != "ojciec" else rate_parental_other
        reduced_rate = full_parental_rate * (1 - etat)
        owner_days = int(round(owner_pool * 7))
        reduced_total_days = int(round(combine * 7))
        full_owner_days = max(0, owner_days - reduced_total_days)

        age_months = _optional_number(payload.get("wiek_dziecka_miesiace"))
        paternity_weeks = int(law["paternity_weeks"]) if payload.get("include_paternity", True) else 0
        if event == "piecza" or event == "ciaza_l4":
            paternity_weeks = 0
        if event == "porod" and age_months is not None and age_months >= 12:
            paternity_weeks = 0
            notes.append("Urlop ojcowski wygasa z ukończeniem przez dziecko 12 miesięcy.")
        if event == "adopcja" and age_years is not None and age_years >= 14:
            paternity_weeks = 0
        if maternity == 0 and parental == 0:
            paternity_weeks = 0

        care_parent = father if special else mother
        cursor = anchor
        pieces: List[Tuple[int, str, str, float]] = []
        if pre_weeks:
            pre_start = _add_days(anchor, -pre_weeks * 7)
            pre_seg = _segment(pre_start, pre_weeks * 7, care_parent, "Urlop przed porodem", rate_full, basis_for_pay)
            if pre_seg:
                segments.append(pre_seg)
        if post_weeks:
            pieces.append((post_weeks * 7, care_parent, "Zasiłek macierzyński", rate_maternity))
        if extra_weeks:
            pieces.append((extra_weeks * 7, care_parent, "Uzupełniający urlop macierzyński", rate_full))
        if role == "ojciec":
            if full_owner_days:
                pieces.append((full_owner_days, father, "Urlop rodzicielski ojca", rate_parental_other))
            if reduced_total_days:
                pieces.append((reduced_total_days, father, "Rodzicielski łączony z pracą", reduced_rate))
            if extension_total_days:
                pieces.append((extension_total_days, father, "Wydłużenie za pracę", full_parental_rate))
            if mother_parental:
                pieces.append((mother_parental * 7, mother, "Urlop rodzicielski matki", rate_parental_own))
        else:
            if full_owner_days:
                pieces.append((full_owner_days, mother, "Urlop rodzicielski", rate_parental_own))
            if reduced_total_days:
                pieces.append((reduced_total_days, mother, "Rodzicielski łączony z pracą", reduced_rate))
            if extension_total_days:
                pieces.append((extension_total_days, mother, "Wydłużenie za pracę", full_parental_rate))
            if father_exclusive:
                pieces.append((father_exclusive * 7, father, "9 tyg. wyłącznie dla drugiego rodzica", rate_parental_other))
        for days, parent, kind, rate in pieces:
            part = _segment(cursor, days, parent, kind, rate, basis_for_pay)
            if part:
                segments.append(part)
                cursor = _add_days(part["end"], 1)
        if paternity_weeks and basis_for_pay:
            pat = _segment(anchor, paternity_weeks * 7, father, "Urlop ojcowski", rate_full, basis_for_pay)
            if pat:
                segments.append(pat)
        notes.append("Pierwsze 14 tygodni macierzyńskiego po porodzie wykorzystuje matka, chyba że nie może sprawować opieki. 9 tygodni rodzicielskiego drugiego rodzica jest liczone po 70% i nie wchodzi w uśrednienie 81,5%.")
        display_rate = rate_maternity
        monthly_gross, monthly_net, uplift = _monthly_amount(basis_for_pay, rate_maternity if post_weeks or pre_weeks else rate_parental_own)
        total_days = (pre_weeks + post_weeks + extra_weeks + parental) * 7 + extension_weeks * 7 + extension_days + paternity_weeks * 7
        total_weeks = total_days // 7
        extra_day_count = total_days % 7

    schedule = _schedule(segments, anchor) if entitled else []
    deadline_days = max(1, int(law["deadline_days_81_5"]))
    deadline = "" if date_missing else (anchor + timedelta(days=deadline_days)).isoformat()
    uplift = any(item.get("uplift") for item in segments) or (entitled and monthly_net == PARENTAL_BENEFIT_FLOOR and monthly_gross == PARENTAL_BENEFIT_FLOOR and basis_for_pay > 0)
    if uplift and entitled:
        notes.append("Miesięczna kwota netto byłaby niższa niż świadczenie rodzicielskie, więc wypłatę podwyższono do 1000,00 zł (art. 31 ust. 3a ustawy zasiłkowej).")

    return {
        "monthly_gross": monthly_gross if entitled else 0.0,
        "monthly_net": monthly_net if entitled else 0.0,
        "uplift_applied": bool(uplift and entitled),
        "benefit_base": basis,
        "declared_gross": declared,
        "entitled": entitled,
        "denial_reason": denial,
        "event": event,
        "total_weeks": total_weeks if entitled else 0,
        "total_extra_days": extra_day_count if entitled else 0,
        "total_months_approx": round((total_weeks if entitled else 0) / 4.33),
        "legislation": law,
        "payer": payer,
        "parents": {"mother": mother, "father": father, "role": role},
        "notes": notes,
        "pregnancy": pregnancy,
        "breakdown": {
            "maternity_weeks": post_weeks,
            "pre_birth_weeks": pre_weeks,
            "parental_weeks_mother": mother_parental,
            "parental_weeks_father_exclusive": father_exclusive,
            "paternity_weeks": paternity_weeks,
            "premature_weeks": extra_weeks,
            "extension_weeks": extension_weeks,
            "extension_days": extension_days,
            "parental_cap": parental_cap,
        },
        "deadline_21_days": deadline,
        "display_rate": display_rate,
        "schedule": schedule,
    }


def published_scenarios() -> List[Dict[str, Any]]:
    return [_with_legislation(item) for item in SCENARIOS.values()]


def published_scenario(scenario_id: str) -> Optional[Dict[str, Any]]:
    raw = SCENARIOS.get(scenario_id)
    if raw is None:
        return None
    return _with_legislation(raw)


def _with_legislation(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Dokleja stawki i wymiary z SQLite, żeby karty scenariusza nie trzymały stałych z 2026."""
    item = copy.deepcopy(raw)
    law = get_legislation_params()
    item["legislation"] = law
    item["benefit_rules"] = {
        "single_variant": f"{_rate_label(float(law['rate_single_variant']) / 100.0)} przez cały okres",
        "split_variant": f"{_rate_label(float(law['rate_maternity']) / 100.0)} + {_rate_label(float(law['rate_parental']) / 100.0)}",
        "maternity_weeks_single": int(law["maternity_weeks_single"]),
        "parental_weeks_single": int(law["parental_weeks_single"]),
        "paternity_weeks": int(law["paternity_weeks"]),
        "deadline_days_81_5": int(law["deadline_days_81_5"]),
    }
    return item
