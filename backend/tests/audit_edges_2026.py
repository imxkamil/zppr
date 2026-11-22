"""Testy brzegowe stanu prawnego 2026 i kontraktu API. Uruchom: python tests/audit_edges_2026.py"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("NVIDIA_API_KEY", None)

import fitz
from fastapi.testclient import TestClient

import pdf_verifier
from engine import (
    DEBT_LIMIT,
    FUNERAL_BENEFIT_2026,
    calculate_benefit_plan,
    death_leave_days,
    declared_from_months,
    supplementary_weeks,
)
from main import app

FAILURES = []
ROOT = Path(__file__).resolve().parents[2]


def check(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def plan(**overrides):
    payload = {
        "benefit_type": "porod",
        "employment_type": "uop",
        "children_count": 1,
        "due_date": "2026-09-18",
        "variant": "81.5",
        "base_salary_gross": 8200,
        "liczba_ubezpieczonych": 25,
        "parent_name": "Ewa Malinowska",
        "second_parent_name": "Piotr Malinowski",
        "parent_role": "matka",
        "include_paternity": True,
        "wymiar_etatu": 1,
    }
    payload.update(overrides)
    return calculate_benefit_plan(payload)


def days_for(result, parent, kind):
    return sum(row["days"] for row in result["schedule"] if row["parent"] == parent and row["benefit_type"] == kind)


def test_rates_and_basis():
    check("płaca minimalna daje limit długu 48,06", DEBT_LIMIT == 48.06, str(DEBT_LIMIT))
    check("zasiłek pogrzebowy 7000", FUNERAL_BENEFIT_2026 == 7000)
    standard = plan()
    check("złota podstawa bez zmian", standard["benefit_base"] == 7075.78 and standard["monthly_gross"] == 5766.76 and standard["monthly_net"] == 5074.75)
    check("wariant 100/70", plan(variant="100_70")["monthly_gross"] == 7075.78)
    months = [
        {"brutto": 8200, "dni_przepracowane": 20, "dni_do_przepracowania": 20},
        {"brutto": 3280, "dni_przepracowane": 8, "dni_do_przepracowania": 20},
        {"brutto": 4920, "dni_przepracowane": 12, "dni_do_przepracowania": 20},
    ]
    check("miesiąc poniżej 50% wypada, a 60% jest uzupełniany", round(declared_from_months(months), 2) == 8200.0, str(declared_from_months(months)))
    averaged = plan(miesiace_podstawy=months, base_salary_gross=1000)
    check("średnia miesięcy daje tę samą podstawę 7075,78", averaged["benefit_base"] == 7075.78 and averaged["declared_gross"] == 8200.0, str(averaged["declared_gross"]))
    first = plan(choroba_w_pierwszym_miesiacu=True, base_salary_gross=8200)
    check("choroba w pierwszym miesiącu bierze wynagrodzenie z umowy", first["benefit_base"] == 7075.78 and any("pierwszym miesiącu" in note for note in first["notes"]))
    check("JDG 23550 daje sufit 20321,30", plan(employment_type="jdg", base_salary_gross=23550, liczba_ubezpieczonych=1)["benefit_base"] == 20321.30)
    check("dług 48,07 zł odcina JDG", plan(employment_type="jdg", debt_amount=48.07, liczba_ubezpieczonych=1)["entitled"] is False)
    check("dług równy 1% nie odcina", plan(employment_type="jdg", debt_amount=48.06, liczba_ubezpieczonych=1)["entitled"] is True)


def test_leave_dimensions():
    check("okno po 37. tyg. liczone do 56. dnia", supplementary_weeks(38, 3200, 10, 6, 50) == 7, str(supplementary_weeks(38, 3200, 10, 6, 50)))
    check("start przed 5. dniem nie daje uzupełniającego", supplementary_weeks(38, 3200, 40, 1, 40) == 0)
    check("wcześniak poniżej 28. tyg. ma sufit 15", supplementary_weeks(26, 900, 200) == 15)
    twins = plan(children_count=2)
    check("bliźnięta 31 + 43", twins["breakdown"]["maternity_weeks"] == 31 and twins["breakdown"]["parental_weeks_mother"] + twins["breakdown"]["parental_weeks_father_exclusive"] == 43)
    life = plan(za_zyciem=True)
    check("Za życiem 65 tygodni rodzicielskiego", life["breakdown"]["parental_weeks_mother"] + life["breakdown"]["parental_weeks_father_exclusive"] == 65)
    adopted = plan(benefit_type="adopcja", za_zyciem=True, wiek_dziecka_lata=1)
    check("adopcja Za życiem to 62, nie 65", adopted["breakdown"]["parental_weeks_mother"] + adopted["breakdown"]["parental_weeks_father_exclusive"] == 62, str(adopted["breakdown"]))
    special = plan(matka_nie_moze_opiekowac=True)
    check("matka bez możliwości opieki zostawia sobie 8 tygodni", days_for(special, "Ewa Malinowska", "Zasiłek macierzyński") == 56, str(days_for(special, "Ewa Malinowska", "Zasiłek macierzyński")))
    check("ojciec przejmuje resztę macierzyńskiego", days_for(special, "Piotr Malinowski", "Zasiłek macierzyński") == 84)
    still = plan(zgon_dziecka=True, dzien_zycia_przy_zgonie=0, dzieci_przy_zyciu=0, include_paternity=True)
    check("urodzenie martwe: 8 tygodni i 7000 zł", still["breakdown"]["maternity_weeks"] == 8 and still["breakdown"]["paternity_weeks"] == 0 and still["funeral_benefit"] == 7000 and still["total_extra_days"] == 0, str(still["breakdown"]))
    check("zgon 54. dnia wydłuża 8 tygodni do 7 dni od zgonu", death_leave_days(54) == 61 and plan(zgon_dziecka=True, dzien_zycia_przy_zgonie=54)["total_weeks"] == 8)
    check("zgon po 8. tygodniu to 7 dni od zgonu", death_leave_days(70) == 77)
    survived = plan(children_count=2, zgon_dziecka=True, dzieci_przy_zyciu=1)
    check("z ciążą mnogą zostaje wymiar jednego dziecka", survived["breakdown"]["maternity_weeks"] == 20 and survived["breakdown"]["parental_weeks_mother"] == 32)
    half = plan(etat_pracy=0.5, tygodnie_laczenia=10)
    check("pół etatu nadal wydłuża o 5 tygodni", half["breakdown"]["extension_weeks"] == 5)
    late_father = plan(benefit_type="adopcja", wiek_dziecka_lata=2, miesiace_od_uprawomocnienia=12)
    check("ojcowski wygasa 12 miesięcy od uprawomocnienia", late_father["breakdown"]["paternity_weeks"] == 0)


def test_sickness():
    young = plan(benefit_type="ciaza_l4", employment_type="uop", dni_niezdolnosci=10, wczesniejsze_dni_l4=200, przerwa_przed_kodem_b=20, wiek_ubezpieczonego=30)
    check("kod B po przerwie poniżej 61 dni zeruje licznik", young["pregnancy"]["sick_days_paid"] == 10 and young["pregnancy"]["okres_wyzerowany"] is True, str(young["pregnancy"]))
    continued = plan(benefit_type="ciaza_l4", dni_niezdolnosci=20, wczesniejsze_dni_l4=40, wiek_ubezpieczonego=30)
    check("bez przerwy wcześniejsze dni się sumują", continued["pregnancy"]["sick_days_paid"] == 60, str(continued["pregnancy"]))
    short_uop = plan(benefit_type="ciaza_l4", employment_type="uop", waiting_days=10, dni_niezdolnosci=5, wiek_ubezpieczonego=30)
    check("UoP poniżej 30 dni wyczekiwania", short_uop["entitled"] is False and "30 dni" in short_uop["denial_reason"])
    graduate = plan(benefit_type="ciaza_l4", employment_type="uop", waiting_days=10, wyjatek_wyczekiwania="absolwent", dni_niezdolnosci=5, wiek_ubezpieczonego=30)
    check("absolwent nie traci chorobowego", graduate["entitled"] is True and graduate["monthly_gross"] == 7075.78)
    short_jdg = plan(benefit_type="ciaza_l4", employment_type="jdg", waiting_days=40, dni_niezdolnosci=5, liczba_ubezpieczonych=1)
    check("JDG poniżej 90 dni", short_jdg["entitled"] is False)
    no_cover = plan(employment_type="jdg", chorobowe_w_dniu_porodu=False, liczba_ubezpieczonych=1)
    check("brak chorobowego w dniu porodu", no_cover["entitled"] is False and "dniu porodu" in no_cover["denial_reason"])
    ended = plan(employment_type="ustanie", benefit_type="ciaza_l4", dni_niezdolnosci=10, wiek_ubezpieczonego=30)
    check("ustanie wskazuje art. 177 i zasiłek do porodu", any("177" in note for note in ended["notes"]) and ended["monthly_gross"] == 7075.78)


def test_api_contract():
    client = TestClient(app)
    health = client.get("/api/health")
    check("health 200", health.status_code == 200 and health.json()["status"] == "ok")
    missing = client.get("/api/scenarios/nie-ma")
    check("nieznany scenariusz bez stack trace", missing.status_code == 404 and "Traceback" not in missing.text)
    broken = client.post("/api/calculator/simulate", json={"children_count": "dwa"})
    check("zły payload to 422 bez stack trace", broken.status_code == 422 and "Traceback" not in broken.text and "File \"" not in broken.text)
    golden = client.post("/api/calculator/simulate", json={
        "benefit_type": "porod",
        "employment_type": "uop",
        "children_count": 1,
        "due_date": "2026-09-18",
        "variant": "81.5",
        "base_salary_gross": 8200,
        "liczba_ubezpieczonych": 25,
        "wymiar_etatu": 1,
    })
    body = golden.json()
    check("API złote kwoty", golden.status_code == 200 and body["monthly_gross"] == 5766.76 and body["monthly_net"] == 5074.75, str(body.get("monthly_gross")))
    still = client.post("/api/calculator/simulate", json={
        "benefit_type": "porod",
        "due_date": "2026-09-18",
        "base_salary_gross": 8200,
        "zgon_dziecka": True,
        "dzien_zycia_przy_zgonie": 0,
        "dzieci_przy_zyciu": 0,
    })
    check("API urodzenie martwe", still.status_code == 200 and still.json()["funeral_benefit"] == 7000 and still.json()["breakdown"]["maternity_weeks"] == 8)


def test_pdf_fallback(monkey_raise=True):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Wniosek\nImie i nazwisko: Ewa Malinowska\n", fontsize=12)
    data = doc.tobytes()
    doc.close()
    os.environ["NVIDIA_API_KEY"] = "sandbox-test"
    def explode(*_args, **_kwargs):
        raise RuntimeError("model niedostępny")
    original = pdf_verifier.httpx.post if hasattr(pdf_verifier, "httpx") else None
    import httpx
    pdf_verifier.httpx = httpx
    previous = httpx.post
    httpx.post = explode
    try:
        parsed = pdf_verifier.analyze_uploaded_pdf(data, "brak-pol.pdf")
    finally:
        httpx.post = previous
        os.environ.pop("NVIDIA_API_KEY", None)
        if original is not None:
            pdf_verifier.httpx = original
    dumped = json.dumps(parsed, ensure_ascii=False)
    check("błąd modelu nie wymyśla kwoty", parsed["extracted"]["base_amount_value"] is None and "8200" not in dumped and "Traceback" not in dumped)
    merged = pdf_verifier._merge_nvidia(
        {"extracted": {"applicant_name": "Ewa Malinowska", "base_amount_value": 8200}},
        {"applicant_name": "Inna Osoba", "base_salary_gross": 100},
    )
    check("model nie nadpisuje pola z parsera", merged["extracted"]["applicant_name"] == "Ewa Malinowska" and merged["extracted"]["base_amount_value"] == 8200)


def test_repo_hygiene():
    banned = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in {".git", ".venv", "node_modules", "dist", "__pycache__"} for part in path.parts):
            continue
        if path.suffix.lower() not in {".py", ".ts", ".tsx", ".yml", ".md", ".json", ".conf"}:
            continue
        if path.name == "audit_edges_2026.py":
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "C:\\Users\\" in text or "/Users/" in text:
            banned.append(str(path.relative_to(ROOT)))
    check("brak zahardkodowanych ścieżek domowych", not banned, ", ".join(banned))
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    check(".env jest ignorowany", ".env" in ignore.splitlines())
    example = (ROOT / ".env.example").read_text(encoding="utf-8")
    check(".env.example opisuje klucz sandboxowy", "NVIDIA_API_KEY=" in example and "sandbox" in example.lower())


if __name__ == "__main__":
    test_rates_and_basis()
    test_leave_dimensions()
    test_sickness()
    test_api_contract()
    test_pdf_fallback()
    test_repo_hygiene()
    print(f"\n{len(FAILURES)} FAIL")
    if FAILURES:
        sys.exit(1)
