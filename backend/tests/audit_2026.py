"""Audyt silnika 2026 i parsera PDF. Uruchom: python tests/audit_2026.py"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.pop("GEMINI_API_KEY", None)

import fitz

from engine import calculate_benefit_plan, supplementary_weeks
from pdf_verifier import analyze_uploaded_pdf


FAILURES = []


def check(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail and not ok else ""))
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


def rates(result, kind):
    return sorted({row["rate"] for row in result["schedule"] if row["benefit_type"] == kind})


def test_engine():
    standard = plan()
    check("UoP 8200 podstawa", standard["benefit_base"] == 7075.78, str(standard["benefit_base"]))
    check("UoP 8200 brutto 81,5%", standard["monthly_gross"] == 5766.76, str(standard["monthly_gross"]))
    check("UoP 8200 netto", standard["monthly_net"] == 5074.75, str(standard["monthly_net"]))
    check("brak imienia Anna", all(row["parent"] != "Anna" and "Anna" not in row["parent"] for row in standard["schedule"]))
    check("imiona z formularza", standard["parents"]["mother"] == "Ewa Malinowska" and standard["parents"]["father"] == "Piotr Malinowski")
    check("9 tyg. drugiego rodzica po 70%", rates(standard, "9 tyg. wyłącznie dla drugiego rodzica") == ["70%"], str(rates(standard, "9 tyg. wyłącznie dla drugiego rodzica")))
    check("urlop ojcowski 100%", rates(standard, "Urlop ojcowski") == ["100%"])

    floor = plan(base_salary_gross=4806)
    check("podłoga pełnego etatu", floor["benefit_base"] == 4147.10, str(floor["benefit_base"]))
    low_declared = plan(base_salary_gross=4000, wymiar_etatu=1)
    check("pełny etat poniżej minimum podniesiony", low_declared["declared_gross"] == 4806.0, str(low_declared["declared_gross"]))

    capped = plan(employment_type="jdg", base_salary_gross=30000, liczba_ubezpieczonych=1)
    check("sufit JDG 20321,30", capped["benefit_base"] == 20321.30, str(capped["benefit_base"]))
    capped_contract = plan(employment_type="zlecenie", base_salary_gross=30000, liczba_ubezpieczonych=30)
    check("sufit zlecenia 20321,30", capped_contract["benefit_base"] == 20321.30, str(capped_contract["benefit_base"]))

    part = plan(base_salary_gross=1201.50, wymiar_etatu=0.25, liczba_ubezpieczonych=25)
    check("1/4 etatu daje netto poniżej 1000 przed podwyższeniem", part["benefit_base"] < 2000, str(part["benefit_base"]))
    check("podwyższenie do 1000 zł", part["uplift_applied"] is True and part["monthly_net"] == 1000 and part["monthly_gross"] == 1000, f"{part['monthly_gross']} / {part['monthly_net']} uplift={part['uplift_applied']}")

    combined = plan(etat_pracy=0.5, tygodnie_laczenia=10)
    check("łączenie wydłuża 63 do 68 tyg.", combined["total_weeks"] == 68 and combined["breakdown"]["extension_weeks"] == 5, str(combined["breakdown"]))
    check("10 tyg. pracy po 40,75%", rates(combined, "Rodzicielski łączony z pracą") == ["40,75%"], str(rates(combined, "Rodzicielski łączony z pracą")))
    check("5 tyg. wydłużenia wraca do 81,5%", rates(combined, "Wydłużenie za pracę") == ["81,5%"], str(rates(combined, "Wydłużenie za pracę")))
    for title in ("jdg", "zlecenie"):
        blocked = plan(employment_type=title, etat_pracy=0.5, tygodnie_laczenia=10, liczba_ubezpieczonych=1)
        check(f"łączenie zablokowane dla {title}", blocked["breakdown"]["extension_weeks"] == 0, str(blocked["breakdown"]))

    check("hospitalizacja <28 tyg. max 15", supplementary_weeks(26, 900, 200) == 15)
    check("hospitalizacja 30 tyg. / 1400 g / 20 dni = 3", supplementary_weeks(30, 1400, 20) == 3)
    early = plan(tydzien_ciazy_porodu=30, masa_urodzeniowa_g=1400, dni_w_szpitalu=20)
    check("uzupełniający urlop 3 tyg. w planie", early["breakdown"]["premature_weeks"] == 3)
    check("uzupełniający urlop płatny 100%", rates(early, "Uzupełniający urlop macierzyński") == ["100%"], str(rates(early, "Uzupełniający urlop macierzyński")))
    check("81,5% macierzyńskiego bez zmian", early["monthly_gross"] == 5766.76)
    check("poród od 37 tyg. i 1 dzień = 0", supplementary_weeks(38, 3200, 1) == 0)
    check("poród od 37 tyg. i 2 dni = 1", supplementary_weeks(38, 3200, 2) == 1)
    check("okno poza 5.–28. dniem = 0", supplementary_weeks(38, 3200, 10, 1, 4) == 0)
    check("okno 5.–6. dnia = 1 tydzień", supplementary_weeks(38, 3200, 10, 5, 6) == 1)

    before = plan(tygodnie_przed_porodem=6)
    check("6 tyg. przed porodem schodzi z macierzyńskiego", before["breakdown"]["pre_birth_weeks"] == 6 and before["breakdown"]["maternity_weeks"] == 14, str(before["breakdown"]))
    check("urlop przed porodem płatny 100%", rates(before, "Urlop przed porodem") == ["100%"])
    check("tygodnie przed porodem obcięte do 6", plan(tygodnie_przed_porodem=9)["breakdown"]["pre_birth_weeks"] == 6)

    adopted = plan(benefit_type="adopcja", wiek_dziecka_lata=13.95)
    check("adopcja 13,95 roku: 9 + 38", adopted["breakdown"]["maternity_weeks"] == 9 and adopted["breakdown"]["parental_weeks_mother"] + adopted["breakdown"]["parental_weeks_father_exclusive"] == 38, str(adopted["breakdown"]))
    adopted_life = plan(benefit_type="adopcja", wiek_dziecka_lata=13.95, za_zyciem=True)
    check("adopcja Za życiem: 9 + 62", adopted_life["breakdown"]["maternity_weeks"] == 9 and adopted_life["breakdown"]["parental_weeks_mother"] + adopted_life["breakdown"]["parental_weeks_father_exclusive"] == 62, str(adopted_life["breakdown"]))
    foster = plan(benefit_type="piecza", wiek_dziecka_lata=6.95)
    check("piecza tuż przed 7. rokiem: 9 + 38", foster["breakdown"]["maternity_weeks"] == 9 and foster["breakdown"]["parental_weeks_mother"] + foster["breakdown"]["parental_weeks_father_exclusive"] == 38 and foster["breakdown"]["paternity_weeks"] == 0, str(foster["breakdown"]))
    foster_late = plan(benefit_type="piecza", wiek_dziecka_lata=9.2, odroczenie_obowiazku_szkolnego=True)
    check("piecza z odroczeniem tuż przed 10. rokiem: 9 + 38", foster_late["breakdown"]["maternity_weeks"] == 9 and foster_late["breakdown"]["parental_weeks_mother"] + foster_late["breakdown"]["parental_weeks_father_exclusive"] == 38, str(foster_late["breakdown"]))
    foster_over = plan(benefit_type="piecza", wiek_dziecka_lata=9.2, odroczenie_obowiazku_szkolnego=False)
    check("piecza po 7. roku bez odroczenia: 0", foster_over["breakdown"]["maternity_weeks"] == 0 and foster_over["breakdown"]["parental_weeks_mother"] == 0)

    young = plan(benefit_type="ciaza_l4", dni_niezdolnosci=100, wiek_ubezpieczonego=30)
    check("UoP poniżej 50 lat: 33 dni pracodawcy", young["pregnancy"]["employer_days"] == 33 and young["pregnancy"]["zus_sick_days"] == 67, str(young["pregnancy"]))
    older = plan(benefit_type="ciaza_l4", dni_niezdolnosci=100, wiek_ubezpieczonego=52)
    check("UoP od 50 lat: 14 dni pracodawcy", older["pregnancy"]["employer_days"] == 14 and older["pregnancy"]["zus_sick_days"] == 86, str(older["pregnancy"]))
    check("zasiłek chorobowy w ciąży 100% podstawy", young["monthly_gross"] == 7075.78, str(young["monthly_gross"]))
    rehab = plan(benefit_type="ciaza_l4", dni_niezdolnosci=270, wiek_ubezpieczonego=40, miesiace_rehabilitacji=6, rehabilitacja_w_ciazy=False)
    rehab_rates = {row["rate"] for row in rehab["schedule"]}
    check("rehabilitacja poza ciążą 90% i 75%", "90%" in rehab_rates and "75%" in rehab_rates, str(sorted(rehab_rates)))
    pregnant_rehab = plan(benefit_type="ciaza_l4", dni_niezdolnosci=270, wiek_ubezpieczonego=40, miesiace_rehabilitacji=2, rehabilitacja_w_ciazy=True)
    check("rehabilitacja w ciąży 100%", "Świadczenie rehabilitacyjne w ciąży" in {row["benefit_type"] for row in pregnant_rehab["schedule"]} and rates(pregnant_rehab, "Świadczenie rehabilitacyjne w ciąży") == ["100%"])

    employer = plan(liczba_ubezpieczonych=25)
    small = plan(liczba_ubezpieczonych=8)
    contract = plan(employment_type="zlecenie", liczba_ubezpieczonych=8)
    company = plan(employment_type="jdg", liczba_ubezpieczonych=1)
    check("UoP >20 płatnik pracodawca", employer["payer"]["title"] == "Pracodawca" and employer["payer"]["required_forms"] == [])
    check("UoP <=20 płatnik ZUS i Z-3", small["payer"]["title"] == "ZUS" and "Z-3" in small["payer"]["required_forms"])
    check("zlecenie <=20 płatnik ZUS i Z-3a", contract["payer"]["title"] == "ZUS" and "Z-3a" in contract["payer"]["required_forms"])
    check("JDG płatnik ZUS", company["payer"]["title"] == "ZUS" and company["payer"]["is_zus"] is True)
    check("JDG wskazuje druk Z-3b albo jego następcę", "Z-3b" in company["payer"]["note"] or any("Z-3b" in item or "ZAM" in item for item in company["payer"]["required_forms"]))


def test_pdf():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 80), "Wniosek ZAM\nImie i nazwisko: Janina Nowak\nMatka\nDzialalnosc gospodarcza JDG\nLiczba ubezpieczonych: 1\nPodstawa wymiaru skladek: 6 500,00 zl\nData porodu: 18.09.2026\nWariant 81,5%", fontsize=12)
    data = doc.tobytes()
    doc.close()
    parsed = analyze_uploaded_pdf(data, "jdg-test.pdf")
    extracted = parsed["extracted"]
    check("PDF A nazwisko", extracted["applicant_name"] == "Janina Nowak", str(extracted.get("applicant_name")))
    check("PDF A podstawa 6500", extracted["base_amount_value"] == 6500, str(extracted.get("base_amount_value")))
    check("PDF A data", extracted["due_or_birth_date"] == "2026-09-18", str(extracted.get("due_or_birth_date")))
    check("PDF A tytuł JDG", extracted["employment_type"] == "jdg", str(extracted.get("employment_type")))
    check("PDF A bez Gemini", parsed.get("model") != "gemini-2.5-flash")

    blank = fitz.open()
    blank.new_page()
    raw = blank.tobytes()
    blank.close()
    empty = analyze_uploaded_pdf(raw, "skan.pdf")
    dumped = str(empty)
    check("PDF B komunikat o warstwie", "warstw" in (empty.get("error") or "").lower(), str(empty.get("error")))
    check("PDF B bez fałszywej podstawy", empty["extracted"]["base_amount_value"] is None and "8200" not in dumped and "6683" not in dumped and "6 683" not in dumped)


def test_source_fallbacks():
    root = Path(__file__).resolve().parents[2]
    banned = []
    files = list((root / "backend").glob("*.py")) + list((root / "frontend" / "src").rglob("*.ts")) + list((root / "frontend" / "src").rglob("*.tsx"))
    for path in files:
        text = path.read_text(encoding="utf-8")
        if "6683" in text or "6 683" in text:
            banned.append(str(path))
    check("brak kwoty 6683 w kodzie", not banned, ", ".join(banned))


def test_live_api():
    import json
    import urllib.request

    port = os.environ.get("API_PORT")
    if not port:
        print("[SKIP] API na żywym porcie — brak API_PORT")
        return
    base = f"http://127.0.0.1:{port}"
    spec = urllib.request.urlopen(base + "/openapi.json", timeout=5)
    check("openapi.json", spec.status == 200)
    request = urllib.request.Request(
        base + "/api/calculator/simulate",
        data=json.dumps({
            "benefit_type": "porod",
            "employment_type": "uop",
            "children_count": 1,
            "due_date": "2026-09-18",
            "variant": "81.5",
            "base_salary_gross": 8200,
            "liczba_ubezpieczonych": 25,
            "parent_name": "Ewa Malinowska",
            "second_parent_name": "Piotr Malinowski",
            "wymiar_etatu": 1,
            "etat_pracy": 0.5,
            "tygodnie_laczenia": 10,
        }).encode(),
        headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:5174"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        cors = response.headers.get("Access-Control-Allow-Origin")
        body = json.loads(response.read().decode())
    check("CORS z frontendu", cors in ("*", "http://127.0.0.1:5174"), str(cors))
    check("API 8200 → 5766,76", body["monthly_gross"] == 5766.76, str(body["monthly_gross"]))
    check("API wydłużenie 5 tyg.", body["breakdown"]["extension_weeks"] == 5)
    options = urllib.request.Request(base + "/api/calculator/simulate", method="OPTIONS", headers={
        "Origin": "http://127.0.0.1:5174",
        "Access-Control-Request-Method": "POST",
    })
    with urllib.request.urlopen(options, timeout=5) as response:
        allow = response.headers.get("Access-Control-Allow-Origin")
    check("preflight CORS", allow in ("*", "http://127.0.0.1:5174"), str(allow))


if __name__ == "__main__":
    test_engine()
    test_pdf()
    test_source_fallbacks()
    test_live_api()
    print(f"\n{len(FAILURES)} FAIL")
    if FAILURES:
        for item in FAILURES:
            print(" -", item)
        sys.exit(1)
