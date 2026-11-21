import copy
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

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


def _rate_label(rate: float) -> str:
    return f"{rate * 100:.1f}%".replace(".0%", "%").replace(".", ",")


def _finite(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number or number in (float("inf"), float("-inf")):
        return default
    return number


def calculate_benefit_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    gross_base = max(0.0, _finite(payload.get("base_salary_gross", 8200.0), 8200.0))
    variant = payload.get("variant", "81.5")  # "81.5" lub "100_70"
    children_count = int(round(_finite(payload.get("children_count", 1), 1)))
    children_count = min(5, max(1, children_count))
    work_share = min(50.0, max(0.0, _finite(payload.get("work_share", 0), 0.0))) / 100.0
    za_zyciem = bool(payload.get("za_zyciem", False))
    premature_weeks = int(round(_finite(payload.get("premature_extra_weeks", 0), 0)))
    premature_weeks = min(52, max(0, premature_weeks))
    due_date_str = str(payload.get("due_date") or "2026-09-18")
    try:
        due_dt = date.fromisoformat(due_date_str)
    except ValueError:
        due_dt = date(2026, 9, 18)

    law = get_legislation_params()
    maternity_base = int(law["maternity_weeks_single"])
    week_shift = maternity_base - 20
    maternity_weeks_map = {1: maternity_base, 2: 31 + week_shift, 3: 33 + week_shift, 4: 35 + week_shift, 5: 37 + week_shift}
    maternity_weeks = max(1, maternity_weeks_map.get(children_count, maternity_base))

    parental_base = int(law["parental_weeks_single"])
    parental_shift = parental_base - 41
    if za_zyciem:
        parental_weeks = (65 if children_count == 1 else 67) + parental_shift
    else:
        parental_weeks = parental_base if children_count == 1 else parental_base + 2
    parental_weeks = max(1, parental_weeks)

    paternity_weeks = max(0, int(law["paternity_weeks"]))
    total_weeks = maternity_weeks + parental_weeks + paternity_weeks + premature_weeks

    # Podstawa po odliczeniu 13.71% (jeśli UoP - standardowo baza w ZUS jest już po 13.71%,
    # ale dla spójności z UI 8200 * 0.815 = 6683 zł):
    effective_base = gross_base

    if variant == "81.5":
        rate_maternity = float(law["rate_single_variant"]) / 100.0
        rate_parental = rate_maternity
    else:
        rate_maternity = float(law["rate_maternity"]) / 100.0
        rate_parental = float(law["rate_parental"]) / 100.0

    # Proporcjonalna redukcja przy łączeniu rodzicielskiego z pracą (max 0.5 etatu)
    effective_parental_rate = rate_parental * (1.0 - work_share)

    monthly_gross_maternity = round(effective_base * rate_maternity, 2)
    monthly_gross_parental = round(effective_base * effective_parental_rate, 2)
    # Zaliczka na PIT 12%
    monthly_net_maternity = round(monthly_gross_maternity * 0.88, 2)

    # Harmonogram wypłat (pierwsze 12 miesięcy od daty porodu)
    schedule: List[Dict[str, Any]] = []
    months_pl = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
                 "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"]

    cur = due_dt.replace(day=1)
    maternity_months = round((maternity_weeks + premature_weeks) / 4.33)
    for idx in range(12):
        y = cur.year + (cur.month - 1 + idx) // 12
        m = (cur.month - 1 + idx) % 12 + 1
        is_first_partial = (idx == 0 and due_dt.day > 1)
        fraction = (30 - due_dt.day + 1) / 30.0 if is_first_partial else 1.0

        if idx < maternity_months:
            kind = "Macierzyński"
            rate_label = _rate_label(rate_maternity)
            amount = round(monthly_gross_maternity * fraction, 2)
        else:
            kind = "Rodzicielski"
            rate_label = _rate_label(effective_parental_rate)
            amount = round(monthly_gross_parental * fraction, 2)

        schedule.append({
            "month_label": f"{months_pl[m - 1]} {y}",
            "parent": "Anna",
            "benefit_type": kind,
            "rate": rate_label,
            "gross_amount": amount
        })

    deadline_days = max(1, int(law["deadline_days_81_5"]))
    deadline_21_days = due_dt + timedelta(days=deadline_days)
    exclusive_weeks = min(9, parental_weeks)
    mother_weeks = parental_weeks - exclusive_weeks

    return {
        "monthly_gross": monthly_gross_maternity,
        "monthly_net": monthly_net_maternity,
        "total_weeks": total_weeks,
        "total_months_approx": round(total_weeks / 4.33),
        "legislation": law,
        "breakdown": {
            "maternity_weeks": maternity_weeks,
            "parental_weeks_mother": mother_weeks,
            "parental_weeks_father_exclusive": exclusive_weeks,
            "paternity_weeks": paternity_weeks,
            "premature_weeks": premature_weeks,
        },
        "deadline_21_days": deadline_21_days.isoformat(),
        "schedule": schedule
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
