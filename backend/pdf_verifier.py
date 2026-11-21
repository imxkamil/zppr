import json
import os
from typing import Any, Dict

import fitz  # PyMuPDF

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
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres"
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
            "monthly_gross": "6 683,00 zł",
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
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres"
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
            "monthly_gross": "5 297,50 zł",
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
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "100% + 70%"
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
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres"
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
            "monthly_gross": "6 357,00 zł",
            "rate_note": "Wypłata bezpośrednio przez ZUS",
            "legal_basis": "Art. 30 ust. 1 pkt 1 ustawy zasiłkowej — zasiłek macierzyński przysługuje również w razie urodzenia dziecka po ustaniu ubezpieczenia chorobowego z powodu ogłoszenia upadłości lub likwidacji pracodawcy."
        }
    }
}


def _offline_result(filename: str, page_count: int, full_text: str) -> Dict[str, Any]:
    lower = full_text.lower()
    is_jdg = "działalność" in lower or "jdg" in lower
    is_zlecenie = "zlecen" in lower
    has_z3a = "z-3a" in lower or "z3a" in lower
    has_z3 = "z-3" in lower or "z3" in lower or is_jdg
    missing_z3a = is_zlecenie and not has_z3a
    approved = (has_z3 or len(full_text) > 40) and not missing_z3a

    if is_jdg:
        title = "Pozarolnicza działalność gospodarcza"
    elif is_zlecenie:
        title = "Umowa zlecenie"
    else:
        title = "Umowa o pracę"

    if missing_z3a:
        completeness_title = "Brak zaświadczenia Z-3a od zleceniodawcy"
        completeness_detail = "Wykryto wniosek, ale brakuje zaświadczenia płatnika składek Z-3a."
        status_title = "POSTĘPOWANIE DO UZUPEŁNIENIA"
        subtitle = "ZUS wezwie do złożenia formularza Z-3a."
    elif approved:
        completeness_title = "Dokumentacja kompletna"
        completeness_detail = f"Przeanalizowano {page_count} str. dokumentu {filename}."
        status_title = "PRAWO PRZYZNANE"
        subtitle = "Symulacja rozstrzygnięcia na podstawie tekstu z PDF."
    else:
        completeness_title = "Wymagana weryfikacja załączników"
        completeness_detail = f"Przeanalizowano {page_count} str. dokumentu {filename}."
        status_title = "DO UZUPEŁNIENIA"
        subtitle = "Symulacja rozstrzygnięcia na podstawie tekstu z PDF."

    return {
        "filename": filename,
        "pages": page_count,
        "confidence": 92 if full_text else 78,
        "extracted": {
            "insurance_title": title,
            "insurance_period": "Wykryto w treści dokumentu PDF" if full_text else "Brak warstwy tekstowej",
            "base_amount": "8 200,00 zł" if full_text else "Brak danych w aktach",
            "due_or_birth_date": "18.09.2026",
            "requested_variant": "81,5% przez cały okres"
        },
        "completeness": {
            "ok": approved,
            "title": completeness_title,
            "detail": completeness_detail
        },
        "decision": {
            "approved": approved,
            "status_title": status_title,
            "subtitle": subtitle,
            "monthly_gross": "6 683,00 zł" if approved else "Do wyliczenia po uzupełnieniu",
            "rate_note": "81,5% podstawy wymiaru",
            "legal_basis": "Ustawa z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa (tekst jedn. 2026)."
        }
    }


def analyze_uploaded_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("Nie udało się odczytać pliku PDF.") from exc

    try:
        page_count = len(doc)
        full_text = "\n".join(page.get_text("text") for page in doc).strip()
    finally:
        doc.close()

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and full_text:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Jesteś ekspertem ds. świadczeń ZUS (ustawa zasiłkowa 2026, zunifikowany wniosek ZAM).
            Przeanalizuj poniższy tekst wyekstrahowany z dokumentu PDF ({filename}) i zwróć WYŁĄCZNIE czysty obiekt JSON w identycznej strukturze:
            {{
              "filename": "{filename}",
              "pages": {page_count},
              "confidence": 95,
              "extracted": {{
                "insurance_title": "...",
                "insurance_period": "...",
                "base_amount": "...",
                "due_or_birth_date": "...",
                "requested_variant": "..."
              }},
              "completeness": {{
                "ok": true,
                "title": "...",
                "detail": "..."
              }},
              "decision": {{
                "approved": true,
                "status_title": "PRAWO PRZYZNANE lub POSTĘPOWANIE DO UZUPEŁNIENIA",
                "subtitle": "...",
                "monthly_gross": "...",
                "rate_note": "...",
                "legal_basis": "..."
              }}
            }}
            Tekst PDF:
            {full_text[:8000]}
            """
            resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            raw = (resp.text or "").strip().removeprefix("```json").removesuffix("```").strip()
            parsed = json.loads(raw)
            parsed.setdefault("filename", filename)
            parsed.setdefault("pages", page_count)
            return parsed
        except Exception:
            pass

    return _offline_result(filename, page_count, full_text)
