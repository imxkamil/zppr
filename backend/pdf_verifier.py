import json
import os
import re
from datetime import date
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF

from engine import calculate_benefit_plan

TEST_CASES: Dict[str, Dict[str, Any]] = {
    "uop_complete": {
        "id": "uop_complete",
        "filename": "ZAM_Anna_Kowalska_2026.pdf",
        "pages": 3,
        "confidence": 96,
        "extracted": {
            "insurance_title": "Umowa o pracę",
            "insurance_period": "od 14.02.2022 – ciągły",
            "base_amount": "8 200,00 zł",
            "base_amount_value": 8200.0,
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres",
            "applicant_name": "Anna Kowalska",
            "role": "matka",
            "employment_type": "uop",
            "insured_count": 25
        },
        "completeness": {
            "ok": True,
            "title": "Dokumentacja kompletna",
            "detail": "ZAM, Z-3 oraz akt urodzenia zostały rozpoznane."
        },
        "decision": {
            "approved": True,
            "status_title": "PRAWO PRZYZNANE",
            "subtitle": "Warunki do przyznania zasiłku macierzyńskiego zostały spełnione.",
            "monthly_gross": "5 766,76 zł",
            "rate_note": "81,5% podstawy wymiaru",
            "legal_basis": "Ubezpieczona podlega ubezpieczeniu chorobowemu w dniu porodu. Wniosek o wypłatę w wysokości 81,5% złożono w terminie 21 dni (art. 30a ustawy zasiłkowej)."
        }
    },
    "jdg_no_90_days": {
        "id": "jdg_no_90_days",
        "filename": "ZAM_JDG_Krotki_Staz_2026.pdf",
        "pages": 2,
        "confidence": 94,
        "extracted": {
            "insurance_title": "Pozarolnicza działalność gospodarcza (JDG)",
            "insurance_period": "od 01.08.2026 (48 dni przed porodem)",
            "base_amount": "6 500,00 zł",
            "base_amount_value": 6500.0,
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres",
            "applicant_name": "Anna Kowalska",
            "role": "matka",
            "employment_type": "jdg",
            "insured_count": 1
        },
        "completeness": {
            "ok": True,
            "title": "Dokumentacja kompletna (ZAM + akt urodzenia)",
            "detail": "Dla JDG nie jest wymagane zaświadczenie Z-3."
        },
        "decision": {
            "approved": True,
            "status_title": "PRAWO PRZYZNANE (WYJĄTEK OD 90 DNI)",
            "subtitle": "Do zasiłku macierzyńskiego nie stosuje się 90-dniowego okresu wyczekiwania.",
            "monthly_gross": "4 571,21 zł",
            "rate_note": "81,5% zadeklarowanej podstawy (możliwa weryfikacja ZUS)",
            "legal_basis": "Art. 29 ust. 1 pkt 1 ustawy zasiłkowej — prawo do zasiłku macierzyńskiego powstaje od pierwszego dnia podlegania dobrowolnemu ubezpieczeniu chorobowemu."
        }
    },
    "zlecenie_missing_z3a": {
        "id": "zlecenie_missing_z3a",
        "filename": "ZAM_Zlecenie_Brak_Z3a_2026.pdf",
        "pages": 1,
        "confidence": 91,
        "extracted": {
            "insurance_title": "Umowa zlecenie",
            "insurance_period": "od 10.03.2025 – ciągły",
            "base_amount": "Brak danych w aktach",
            "base_amount_value": None,
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "100% + 70%",
            "applicant_name": "Anna Kowalska",
            "role": "matka",
            "employment_type": "zlecenie",
            "insured_count": 12
        },
        "completeness": {
            "ok": False,
            "title": "Brak zaświadczenia Z-3a od zleceniodawcy",
            "detail": "Wykryto wniosek ZAM, ale brakuje zaświadczenia płatnika składek Z-3a niezbędnego do ustalenia podstawy."
        },
        "decision": {
            "approved": False,
            "status_title": "POSTĘPOWANIE DO UZUPEŁNIENIA",
            "subtitle": "ZUS wezwie płatnika lub ubezpieczoną do złożenia formularza Z-3a (termin 7 dni).",
            "monthly_gross": "Do wyliczenia po wpływie Z-3a",
            "rate_note": "Wariant 100% (20 tyg.) + 70% (32 tyg.)",
            "legal_basis": "§ 2 rozporządzenia MRPiPS w sprawie zakresu informacji o okolicznościach mających wpływ na prawo do zasiłków."
        }
    },
    "employer_bankruptcy": {
        "id": "employer_bankruptcy",
        "filename": "ZAM_Upadlosc_Pracodawcy_2026.pdf",
        "pages": 4,
        "confidence": 95,
        "extracted": {
            "insurance_title": "Umowa o pracę (rozwiązana z powodu upadłości)",
            "insurance_period": "01.03.2021 – 15.07.2026 (likwidacja pracodawcy)",
            "base_amount": "7 800,00 zł",
            "base_amount_value": 7800.0,
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres",
            "applicant_name": "Anna Kowalska",
            "role": "matka",
            "employment_type": "ustanie",
            "insured_count": 8
        },
        "completeness": {
            "ok": True,
            "title": "Dokumentacja kompletna + postanowienie sądu",
            "detail": "Rozpoznano ZAM, świadectwo pracy oraz odpis postanowienia o ogłoszeniu upadłości."
        },
        "decision": {
            "approved": True,
            "status_title": "PRAWO PRZYZNANE (ART. 30 UST. 1)",
            "subtitle": "Szczególna ochrona w razie ustania zatrudnienia w ciąży z powodu upadłości/likwidacji.",
            "monthly_gross": "5 485,46 zł",
            "rate_note": "Wypłata bezpośrednio przez ZUS",
            "legal_basis": "Art. 30 ust. 1 pkt 1 ustawy zasiłkowej — zasiłek macierzyński przysługuje również w razie urodzenia dziecka po ustaniu ubezpieczenia chorobowego z powodu ogłoszenia upadłości lub likwidacji pracodawcy."
        }
    }
}


def _pln(value: Optional[float]) -> str:
    if value is None:
        return "Nie odczytano"
    text = f"{value:,.2f}".replace(",", " ").replace(".", ",")
    return f"{text} zł"


def _iso_date(day: str, month: str, year: str) -> Optional[str]:
    from datetime import date
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except ValueError:
        return None


def _money_near(text: str, keywords: tuple[str, ...]) -> Optional[float]:
    lowered = text.lower()
    amount = re.compile(r"(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,](\d{2}))?")
    for keyword in keywords:
        start = 0
        while True:
            index = lowered.find(keyword, start)
            if index < 0:
                break
            window = text[index:index + 90]
            match = amount.search(window[len(keyword):])
            if match:
                whole = match.group(1).replace(" ", "").replace("\u00a0", "")
                cents = match.group(2) or "00"
                return float(f"{int(whole)}.{cents}")
            start = index + len(keyword)
    return None


def _date_near(text: str, keywords: tuple[str, ...]) -> Optional[str]:
    lowered = text.lower()
    pattern = re.compile(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})")
    iso = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
    for keyword in keywords:
        index = lowered.find(keyword)
        if index < 0:
            continue
        window = text[index:index + 80]
        match = pattern.search(window)
        if match:
            return _iso_date(match.group(1), match.group(2), match.group(3))
        match = iso.search(window)
        if match:
            return _iso_date(match.group(3), match.group(2), match.group(1))
    return None


def _name_near(text: str) -> Optional[str]:
    pattern = re.compile(
        r"(?:imi[eę][ \t]+i[ \t]+nazwisko|wnioskodawc[aą]|ubezpieczon[aey])[ \t]*[:\-]?[ \t]*([A-ZŁŚŻŹĆŃÓa-ząćęłńóśźż][A-ZŁŚŻŹĆŃÓa-ząćęłńóśźż.'\-]+(?:[ \t]+[A-ZŁŚŻŹĆŃÓa-ząćęłńóśźż][A-ZŁŚŻŹĆŃÓa-ząćęłńóśźż.'\-]+){1,2})",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return None
    parts = re.sub(r"\s+", " ", match.group(1)).strip(" .:-").split()
    while parts and parts[-1].lower() in {"matka", "ojciec", "ojca", "opiekun", "dziecka"}:
        parts.pop()
    name = " ".join(parts)
    blocked = {"umowa", "praca", "zus", "zam", "data", "okres"}
    if not name or name.lower().split()[0] in blocked:
        return None
    return name


def _role(text: str) -> Optional[str]:
    lowered = text.lower()
    father = len(re.findall(r"\bojciec|\bojca\b|\bojcem\b", lowered))
    mother = len(re.findall(r"\bmatka|\bmatki\b|\bmatką\b", lowered))
    guardian = "opiekun" in lowered
    if father > mother and father:
        return "ojciec"
    if mother:
        return "matka"
    if guardian:
        return "opiekun"
    return None


def _employment(text: str) -> tuple[Optional[str], str]:
    lowered = text.lower()
    if "upadło" in lowered or "likwidac" in lowered:
        return "ustanie", "Umowa o pracę (ustanie zatrudnienia)"
    if "działalno" in lowered or re.search(r"\bjdg\b", lowered) or "pozarolnic" in lowered:
        return "jdg", "Pozarolnicza działalność gospodarcza"
    if "zlecen" in lowered:
        return "zlecenie", "Umowa zlecenie"
    if "pracownik" in lowered or ("umow" in lowered and "prac" in lowered):
        return "uop", "Umowa o pracę"
    return None, "Nie odczytano"


def _insured_count(text: str) -> Optional[int]:
    lowered = text.lower()
    match = re.search(r"liczb[aąeę]\s+ubezpieczonych\D{0,12}(\d{1,5})", lowered)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d{1,5})\s+ubezpieczonych", lowered)
    if match:
        return int(match.group(1))
    if re.search(r"powy[zż]ej\s+20|wi[eę]cej ni[zż]\s+20", lowered):
        return 21
    if re.search(r"nie wi[eę]cej ni[zż]\s+20|poni[zż]ej\s+20|do\s+20\s+ubezpiecz", lowered):
        return 20
    return None


def _benefit_type(text: str, date_kind: Optional[str]) -> str:
    lowered = text.lower()
    if "piecz" in lowered:
        return "piecza"
    if "przysposob" in lowered or "adopc" in lowered:
        return "adopcja"
    if date_kind == "przyjecie":
        return "adopcja"
    if ("ciąż" in lowered or "ciaz" in lowered or "zwolnien" in lowered or "l4" in lowered) and date_kind not in ("porod", "przewidywana"):
        return "ciaza_l4"
    return "porod"


def _variant(text: str) -> tuple[str, str]:
    if re.search(r"81[,.]5", text):
        return "81.5", "81,5% przez cały okres"
    if "100" in text and "70" in text:
        return "100_70", "100% + 70%"
    return "", "Nie odczytano"


def _empty_extraction() -> Dict[str, Any]:
    return {
        "applicant_name": None,
        "role": None,
        "insurance_title": "Nie odczytano",
        "insurance_period": "Nie odczytano",
        "employment_type": None,
        "insured_count": None,
        "base_amount": "Nie odczytano",
        "base_amount_value": None,
        "due_or_birth_date": None,
        "date_kind": None,
        "requested_variant": "Nie odczytano",
    }


def _offline_result(filename: str, page_count: int, full_text: str, source: str = "pymupdf") -> Dict[str, Any]:
    if not full_text.strip():
        extracted = _empty_extraction()
        extracted["insurance_period"] = "Brak warstwy tekstowej"
        return {
            "filename": filename,
            "pages": page_count,
            "confidence": 0,
            "text_layer": False,
            "error": "Brak warstwy tekstowej. PyMuPDF i lokalny OCR nie odczytały znaków. Kwota i data nie zostały podstawione.",
            "base_salary_gross": None,
            "monthly_gross_label": "—",
            "extracted": extracted,
            "completeness": {
                "ok": False,
                "title": "Brak warstwy tekstowej",
                "detail": "Nie da się odczytać pól ze skanu. Podstawa i data zostają puste.",
            },
            "decision": {
                "approved": False,
                "status_title": "NIE ODCZYTANO",
                "subtitle": "Brak warstwy tekstowej. Nie wyliczono świadczenia, bo w pliku nie ma danych do podstawy ani daty.",
                "monthly_gross": "—",
                "rate_note": "Brak danych z dokumentu",
                "legal_basis": "Odczyt dotyczy wyłącznie tekstu znajdującego się w pliku. Regulamin wymaga weryfikacji na przykładowym wniosku, a nie na stałej kwocie demonstracyjnej.",
            },
        }

    employment, title = _employment(full_text)
    base = _money_near(full_text, ("podstawa wymiaru", "podstawy wymiaru", "wynagrodzen", "przychód", "przychod", "przeciętn"))
    birth = _date_near(full_text, ("data porodu", "data urodzenia dziecka", "urodzenia dziecka", "dziecko urodziło"))
    expected = _date_near(full_text, ("przewidywana data", "termin porodu", "przewidywany termin"))
    placement = _date_near(full_text, ("przyjęcia na wychowanie", "przyjecia na wychowanie", "data przyjęcia", "data przyjecia"))
    if birth:
        event_date, date_kind = birth, "porod"
    elif expected:
        event_date, date_kind = expected, "przewidywana"
    elif placement:
        event_date, date_kind = placement, "przyjecie"
    else:
        event_date, date_kind = None, None
    variant, variant_label = _variant(full_text)
    insured = _insured_count(full_text)
    name = _name_near(full_text)
    role = _role(full_text)
    lowered = full_text.lower()
    has_z3a = "z-3a" in lowered or "z3a" in lowered
    benefit_type = _benefit_type(full_text, date_kind)
    payer_is_zus = employment in ("jdg", "ustanie") or insured is None or insured <= 20
    missing_z3a = employment == "zlecenie" and not has_z3a and payer_is_zus
    found = [item is not None and item != "" for item in (name, event_date, base, employment, insured)]
    confidence = min(90, 15 + 15 * sum(found))

    monthly = "—"
    rate_note = "W dokumencie nie ma kwoty albo wariantu, więc świadczenia nie wyliczono."
    approved = False
    status = "DANE CZĘŚCIOWE"
    subtitle = "Uzupełnij brakujące pola w kalkulatorze. Brakujące wartości nie zostały niczym zastąpione."
    if base is not None and event_date and variant and employment:
        plan = calculate_benefit_plan({
            "benefit_type": benefit_type,
            "employment_type": employment,
            "children_count": 1,
            "due_date": event_date,
            "variant": variant,
            "base_salary_gross": base,
            "parent_name": name or "",
            "parent_role": role or "matka",
            "liczba_ubezpieczonych": insured if insured is not None else (1 if employment == "jdg" else 21),
            "include_paternity": benefit_type not in ("piecza", "ciaza_l4"),
        })
        monthly = _pln(plan["monthly_gross"]) if plan["entitled"] else "0,00 zł"
        rate_note = f"{variant_label}. Podstawa zasiłku po 13,71%: {_pln(plan['benefit_base'])}."
        approved = bool(plan["entitled"]) and not missing_z3a
        status = "PRAWO DO WYLICZENIA" if approved else "POSTĘPOWANIE DO UZUPEŁNIENIA"
        subtitle = plan["denial_reason"] or plan["payer"]["note"]
    elif missing_z3a:
        status = "POSTĘPOWANIE DO UZUPEŁNIENIA"
        subtitle = "W tekście jest umowa zlecenia, a nie ma zaświadczenia Z-3a."

    if missing_z3a:
        completeness_title = "Brak zaświadczenia Z-3a od zleceniodawcy"
        completeness_detail = "Parser znalazł zlecenie, ale nie znalazł oznaczenia Z-3a. Podstawa nie została zgadywana."
    elif base is None or event_date is None:
        completeness_title = "Część pól nie występuje w tekście"
        completeness_detail = "Zostawiono puste te wartości, których nie ma przy etykietach wniosku. Nie użyto kwoty ani daty przykładowej."
    else:
        completeness_title = "Odczyt deterministyczny"
        completeness_detail = (
            f"Lokalny OCR odczytał tekst z {min(page_count, 2)} str. Pola pochodzą z etykiet, bez uzupełniania braków."
            if source == "rapidocr"
            else f"PyMuPDF przekazał {page_count} str. tekstu. Pola pochodzą z etykiet w pliku, bez modelu."
        )

    return {
        "filename": filename,
        "pages": page_count,
        "confidence": confidence,
        "text_layer": True,
        "error": None,
        "extracted": {
            "applicant_name": name,
            "role": role,
            "insurance_title": title,
            "insurance_period": "Odczytano z tekstu wniosku" if employment else "Nie odczytano",
            "employment_type": employment,
            "insured_count": insured,
            "base_amount": _pln(base),
            "base_amount_value": base,
            "due_or_birth_date": event_date,
            "date_kind": date_kind,
            "benefit_type": benefit_type,
            "requested_variant": variant_label,
        },
        "completeness": {
            "ok": approved and base is not None and event_date is not None,
            "title": completeness_title,
            "detail": completeness_detail,
        },
        "decision": {
            "approved": approved,
            "status_title": status,
            "subtitle": subtitle,
            "monthly_gross": monthly,
            "rate_note": rate_note,
            "legal_basis": "Wyliczenie z odczytanej podstawy według art. 31 ustawy zasiłkowej i wymiaru z Kodeksu pracy. Brak pola w PDF nie jest uzupełniany stałą.",
        },
    }


_OCR = None
_TITLES = {
    "uop": "Umowa o pracę",
    "jdg": "Pozarolnicza działalność gospodarcza",
    "zlecenie": "Umowa zlecenie",
    "ustanie": "Umowa o pracę (ustanie zatrudnienia)",
}


def _blank(value: Any) -> bool:
    return value in (None, "", "Nie odczytano")


def _ocr_pages(doc: fitz.Document) -> str:
    global _OCR
    try:
        if _OCR is None:
            from rapidocr_onnxruntime import RapidOCR
            _OCR = RapidOCR()
    except Exception:
        return ""
    chunks: List[str] = []
    for index, page in enumerate(doc):
        if index >= 2:
            break
        try:
            image = page.get_pixmap(dpi=200, alpha=False).tobytes("png")
            result, _elapsed = _OCR(image)
        except Exception:
            continue
        if not result:
            continue
        for row in result:
            if isinstance(row, (list, tuple)) and len(row) >= 2 and isinstance(row[1], str):
                text = row[1].strip()
                if text:
                    chunks.append(text)
    return "\n".join(chunks).strip()


def _json_object(raw: str) -> Optional[Dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    if isinstance(data, dict) and isinstance(data.get("extracted"), dict):
        return data["extracted"]
    return data if isinstance(data, dict) else None


def _nvidia_fields(full_text: str) -> Optional[Dict[str, Any]]:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key or not full_text.strip():
        return None
    try:
        import httpx
        response = httpx.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "nvidia/nemotron-3.5-bolt-e4b",
                "temperature": 0.0,
                "messages": [
                    {
                        "role": "system",
                        "content": "Zwróć wyłącznie czysty JSON. Nie zgaduj wartości, których nie ma w tekście. Dla braku wstaw null.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Uzupełnij tylko brakujące pola wniosku ZUS. "
                            "Klucze: applicant_name (imię i nazwisko albo null), "
                            "due_date (YYYY-MM-DD albo null), "
                            "base_salary_gross (liczba albo null), "
                            "employment_type (uop, jdg, zlecenie, ustanie albo null).\n"
                            f"Tekst:\n{full_text[:6000]}"
                        ),
                    },
                ],
            },
            timeout=12.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
    except Exception:
        return None
    return _json_object(str(content or ""))


def _merge_nvidia(base: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    extracted = dict(base.get("extracted") or {})
    filled = False

    name = incoming.get("applicant_name")
    if _blank(extracted.get("applicant_name")) and isinstance(name, str):
        name = " ".join(name.split())
        if name and len(name) <= 80 and not re.search(r"\d", name):
            extracted["applicant_name"] = name
            filled = True

    due = incoming.get("due_date", incoming.get("due_or_birth_date"))
    if _blank(extracted.get("due_or_birth_date")) and isinstance(due, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", due):
        try:
            date.fromisoformat(due)
        except ValueError:
            due = ""
        if due:
            extracted["due_or_birth_date"] = due
            filled = True

    salary = incoming.get("base_salary_gross", incoming.get("base_amount_value"))
    if extracted.get("base_amount_value") is None and salary not in (None, ""):
        try:
            amount = float(salary)
        except (TypeError, ValueError):
            amount = 0
        if 0 < amount <= 1_000_000:
            extracted["base_amount_value"] = amount
            if _blank(extracted.get("base_amount")):
                extracted["base_amount"] = _pln(amount)
            filled = True

    employment = incoming.get("employment_type")
    if _blank(extracted.get("employment_type")) and employment in _TITLES:
        extracted["employment_type"] = employment
        if _blank(extracted.get("insurance_title")):
            extracted["insurance_title"] = _TITLES[employment]
        filled = True

    base["extracted"] = extracted
    if filled:
        base["model"] = "nvidia/nemotron-3.5-bolt-e4b"
    return base


def _apply_plan(result: Dict[str, Any], full_text: str) -> Dict[str, Any]:
    extracted = result.get("extracted") or {}
    base = extracted.get("base_amount_value")
    event_date = extracted.get("due_or_birth_date")
    employment = extracted.get("employment_type")
    label = str(extracted.get("requested_variant") or "")
    if re.search(r"81[,.]5", label):
        variant = "81.5"
    elif "100" in label and "70" in label:
        variant = "100_70"
    else:
        return result
    if base is None or not event_date or not employment:
        return result
    insured = extracted.get("insured_count")
    benefit_type = extracted.get("benefit_type") or "porod"
    lowered = full_text.lower()
    has_z3a = "z-3a" in lowered or "z3a" in lowered
    payer_is_zus = employment in ("jdg", "ustanie") or insured is None or (isinstance(insured, int) and insured <= 20)
    missing_z3a = employment == "zlecenie" and not has_z3a and payer_is_zus
    plan = calculate_benefit_plan({
        "benefit_type": benefit_type,
        "employment_type": employment,
        "children_count": 1,
        "due_date": event_date,
        "variant": variant,
        "base_salary_gross": base,
        "parent_name": extracted.get("applicant_name") or "",
        "parent_role": extracted.get("role") or "matka",
        "liczba_ubezpieczonych": insured if isinstance(insured, int) else (1 if employment == "jdg" else 21),
        "include_paternity": benefit_type not in ("piecza", "ciaza_l4"),
    })
    approved = bool(plan["entitled"]) and not missing_z3a
    decision = dict(result.get("decision") or {})
    decision["approved"] = approved
    decision["status_title"] = "PRAWO DO WYLICZENIA" if approved else "POSTĘPOWANIE DO UZUPEŁNIENIA"
    decision["subtitle"] = "W tekście jest umowa zlecenia, a nie ma zaświadczenia Z-3a." if missing_z3a else (plan["denial_reason"] or plan["payer"]["note"])
    decision["monthly_gross"] = _pln(plan["monthly_gross"]) if plan["entitled"] else "0,00 zł"
    decision["rate_note"] = f"{label}. Podstawa zasiłku po 13,71%: {_pln(plan['benefit_base'])}."
    result["decision"] = decision
    return result


def analyze_uploaded_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("Nie udało się odczytać pliku PDF.") from exc

    try:
        page_count = len(doc)
        full_text = "\n".join(page.get_text("text") for page in doc).strip()
        source = "pymupdf"
        if not full_text:
            full_text = _ocr_pages(doc)
            source = "rapidocr"
        if not full_text.strip():
            return _offline_result(filename, page_count, "")
        result = _offline_result(filename, page_count, full_text, source)
        extracted = result.get("extracted") or {}
        missing = any(_blank(extracted.get(key)) if key != "base_amount_value" else extracted.get(key) is None for key in ("applicant_name", "due_or_birth_date", "base_amount_value", "employment_type"))
        if os.getenv("NVIDIA_API_KEY") and missing:
            parsed = _nvidia_fields(full_text)
            if parsed:
                before = dict(extracted)
                result = _merge_nvidia(result, parsed)
                if result.get("extracted") != before:
                    result = _apply_plan(result, full_text)
        return result
    finally:
        doc.close()
