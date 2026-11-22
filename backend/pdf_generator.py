"""Generowanie dokumentów PDF (ReportLab) dla kalkulatora, weryfikatora i checklisty."""

from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0b2545")
GREEN = colors.HexColor("#007a33")
AMBER = colors.HexColor("#9a6700")
RED = colors.HexColor("#9f1239")
MUTED = colors.HexColor("#5b6b7c")
LINE = colors.HexColor("#d7dee7")
ZEBRA = colors.HexColor("#f4f7fb")
PAPER = colors.HexColor("#f7faf8")

DISCLAIMER = (
    "Dokument ma charakter informacyjny i nie stanowi decyzji ZUS, "
    "interpretacji indywidualnej ani porady prawnej."
)

_FONT = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_TTF = False

_PL = str.maketrans({
    "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
    "–": "-", "—": "-", "„": '"', "”": '"', "•": "-", "…": "...",
})

_MONTHS = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "wrzesnia", "pazdziernika", "listopada", "grudnia",
]
_MONTHS_UTF = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
]


def _register_fonts() -> None:
    global _FONT, _FONT_BOLD, _TTF
    pairs = [
        (Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
        (Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"), Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf")),
        (Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"), Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")),
        (Path("/Library/Fonts/Arial.ttf"), Path("/Library/Fonts/Arial Bold.ttf")),
    ]
    for regular, bold in pairs:
        if not regular.is_file() or not bold.is_file():
            continue
        pdfmetrics.registerFont(TTFont("EzSans", str(regular)))
        pdfmetrics.registerFont(TTFont("EzSans-Bold", str(bold)))
        _FONT = "EzSans"
        _FONT_BOLD = "EzSans-Bold"
        _TTF = True
        return


_register_fonts()


def _esc(value: Any) -> str:
    text = "" if value is None else str(value)
    if not _TTF:
        text = text.translate(_PL)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _money(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 0.0
    if number != number or number in (float("inf"), float("-inf")):
        number = 0.0
    formatted = f"{number:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} zł"


def _long_date(iso: str) -> str:
    try:
        year, month, day = [int(part) for part in iso.split("-")]
        names = _MONTHS_UTF if _TTF else _MONTHS
        return f"{day} {names[month - 1]} {year}"
    except (TypeError, ValueError, IndexError):
        return iso or "—"


def _styles() -> Dict[str, ParagraphStyle]:
    return {
        "kicker": ParagraphStyle("kicker", fontName=_FONT_BOLD, fontSize=8, textColor=GREEN, tracking=0.6, spaceAfter=2),
        "h1": ParagraphStyle("h1", fontName=_FONT_BOLD, fontSize=16, leading=20, textColor=NAVY, spaceAfter=4),
        "lead": ParagraphStyle("lead", fontName=_FONT, fontSize=9.5, leading=13, textColor=MUTED, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName=_FONT_BOLD, fontSize=11, leading=14, textColor=NAVY, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("body", fontName=_FONT, fontSize=9, leading=12.5, textColor=colors.HexColor("#1f2937")),
        "small": ParagraphStyle("small", fontName=_FONT, fontSize=8, leading=11, textColor=MUTED),
        "label": ParagraphStyle("label", fontName=_FONT, fontSize=7.5, leading=9, textColor=MUTED),
        "value": ParagraphStyle("value", fontName=_FONT_BOLD, fontSize=11, leading=14, textColor=NAVY),
        "th": ParagraphStyle("th", fontName=_FONT_BOLD, fontSize=8, leading=10, textColor=colors.white),
        "td": ParagraphStyle("td", fontName=_FONT, fontSize=8, leading=10.5, textColor=colors.HexColor("#1f2937")),
        "tdRight": ParagraphStyle("tdRight", fontName=_FONT_BOLD, fontSize=8, leading=10.5, textColor=NAVY, alignment=TA_RIGHT),
        "warn": ParagraphStyle("warn", fontName=_FONT, fontSize=8, leading=11, textColor=colors.HexColor("#3f3f46")),
    }


def _doc(buffer: BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="eZUS Rodzic+",
        author="eZUS Rodzic+",
    )


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(_FONT_BOLD, 8)
    canvas.drawString(16 * mm, A4[1] - 5.2 * mm, "eZUS Rodzic+")
    canvas.setFont(_FONT, 8)
    canvas.drawRightString(A4[0] - 16 * mm, A4[1] - 5.2 * mm, "Asystent świadczeń rodzicielskich")
    canvas.setFillColor(MUTED)
    canvas.setFont(_FONT, 7.5)
    canvas.drawString(16 * mm, 8 * mm, "Symulacja na dzień 12.06.2026  ·  nie jest decyzją ZUS")
    canvas.drawRightString(A4[0] - 16 * mm, 8 * mm, f"Strona {doc.page}")
    canvas.restoreState()


def _build(story: List[Any]) -> bytes:
    buffer = BytesIO()
    document = _doc(buffer)
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def _heading(styles: Dict[str, ParagraphStyle], kicker: str, title: str, lead: str) -> List[Any]:
    return [
        Paragraph(_esc(kicker), styles["kicker"]),
        Paragraph(_esc(title), styles["h1"]),
        Paragraph(_esc(lead), styles["lead"]),
        HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=8),
    ]


def _kpi_table(styles: Dict[str, ParagraphStyle], cells: List[Tuple[str, str]]) -> Table:
    row = []
    for label, value in cells:
        row.append([
            Paragraph(_esc(label), styles["label"]),
            Spacer(1, 2),
            Paragraph(_esc(value), styles["value"]),
        ])
    table = Table([row], colWidths=[58 * mm] * len(cells))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def _data_table(styles: Dict[str, ParagraphStyle], headers: List[str], rows: List[List[str]], right_cols: Tuple[int, ...] = ()) -> Table:
    head = [Paragraph(_esc(header), styles["th"]) for header in headers]
    body = []
    for row in rows:
        rendered = []
        for index, cell in enumerate(row):
            style = styles["tdRight"] if index in right_cols else styles["td"]
            rendered.append(Paragraph(_esc(cell), style))
        body.append(rendered)
    table = Table([head, *body], repeatRows=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for index in range(1, len(body) + 1):
        if index % 2 == 0:
            commands.append(("BACKGROUND", (0, index), (-1, index), ZEBRA))
    table.setStyle(TableStyle(commands))
    return table


def _note(styles: Dict[str, ParagraphStyle], text: str) -> Table:
    table = Table([[Paragraph(_esc(text), styles["warn"])]], colWidths=[178 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#f5d48a")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def _percent(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 0.0
    text = f"{number:.1f}".replace(".", ",")
    if text.endswith(",0"):
        text = text[:-2]
    return f"{text}%"


def variant_label(variant: str, law: Dict[str, Any] | None = None) -> str:
    rates = law or {}
    if variant == "81.5":
        return f"{_percent(rates.get('rate_single_variant', 81.5))} przez cały okres"
    return (
        f"{_percent(rates.get('rate_maternity', 100))} (macierzyński) + "
        f"{_percent(rates.get('rate_parental', 70))} (rodzicielski)"
    )


def render_calculator_pdf(payload: Dict[str, Any], plan: Dict[str, Any]) -> Tuple[bytes, str]:
    styles = _styles()
    variant = str(payload.get("variant") or "81.5")
    children = int(payload.get("children_count") or 1)
    work = payload.get("work_share") or 0
    story: List[Any] = _heading(
        styles,
        "KALKULATOR ZASIŁKÓW",
        "Podsumowanie planu świadczeń",
        payload.get("scenario_label") or "Symulacja na podstawie danych wprowadzonych w kalkulatorze.",
    )
    story.append(_kpi_table(styles, [
        ("Macierzyński brutto / mies.", _money(plan.get("monthly_gross"))),
        ("Szacunkowo netto / mies.", _money(plan.get("monthly_net"))),
        ("Łączny czas opieki", f"{plan.get('total_weeks', 0)} tyg."),
    ]))
    story.append(Spacer(1, 8))
    facts = [
        ["Wariant wypłaty", variant_label(variant, (plan.get("legislation") or {}))],
        ["Wynagrodzenie brutto przed 13,71%", _money(payload.get("base_salary_gross"))],
        ["Podstawa zasiłku po 13,71%", _money(plan.get("benefit_base"))],
        ["Liczba dzieci", str(children)],
        ["Łączenie z pracą", f"{payload.get('etat_pracy') if payload.get('etat_pracy') is not None else work} etatu przez {payload.get('tygodnie_laczenia') or 0} tyg."],
        ["Za życiem", "Tak — wydłużony urlop rodzicielski" if payload.get("za_zyciem") else "Nie"],
        ["Uzupełniający urlop macierzyński", f"{(plan.get('breakdown') or {}).get('premature_weeks', 0)} tyg. · 100%"],
        ["Płatnik", str((plan.get("payer") or {}).get("title") or "")],
        ["Wniosek o wariant stały do", _long_date(str(plan.get("deadline_21_days") or ""))],
    ]
    story.append(Paragraph("Parametry wyliczenia", styles["h2"]))
    story.append(_data_table(styles, ["Parametr", "Wartość"], facts))
    breakdown = plan.get("breakdown") or {}
    story.append(Paragraph("Wymiar opieki", styles["h2"]))
    story.append(_data_table(styles, ["Część", "Tygodnie"], [
        ["Urlop macierzyński", str(breakdown.get("maternity_weeks", 0))],
        ["Uzupełniający (wcześniactwo)", str(breakdown.get("premature_weeks", 0))],
        ["Rodzicielski — pierwszy rodzic", str(breakdown.get("parental_weeks_mother", 0))],
        ["Rodzicielski — 9 tyg. tylko dla drugiego rodzica", str(breakdown.get("parental_weeks_father_exclusive", 0))],
        ["Urlop ojcowski", str(breakdown.get("paternity_weeks", 0))],
    ]))
    story.append(Paragraph("Harmonogram wypłat — pierwsze 12 miesięcy", styles["h2"]))
    schedule = plan.get("schedule") or []
    if schedule:
        story.append(_data_table(
            styles,
            ["Miesiąc", "Rodzic", "Świadczenie", "Stawka", "Kwota brutto"],
            [[
                row.get("month_label", ""),
                row.get("parent", ""),
                row.get("benefit_type", ""),
                row.get("rate", ""),
                _money(row.get("gross_amount")),
            ] for row in schedule],
            right_cols=(4,),
        ))
    else:
        story.append(Paragraph("Brak pozycji harmonogramu.", styles["body"]))
    story.append(Spacer(1, 10))
    story.append(_note(styles, DISCLAIMER + " Kwota netto jest szacunkiem po zaliczce na PIT 12% i nie uwzględnia indywidualnych ulg."))
    return _build(story), "plan-swiadczen.pdf"


def render_verification_pdf(data: Dict[str, Any]) -> Tuple[bytes, str]:
    styles = _styles()
    extracted = data.get("extracted") or {}
    completeness = data.get("completeness") or {}
    decision = data.get("decision") or {}
    approved = bool(decision.get("approved"))
    status = str(decision.get("status_title") or "DO ANALIZY")
    story: List[Any] = _heading(
        styles,
        "WERYFIKATOR SPRAW PDF",
        "Raport odczytu i symulacji rozstrzygnięcia",
        data.get("filename") or "dokument.pdf",
    )
    story.append(_kpi_table(styles, [
        ("Status", status),
        ("Pewność odczytu", f"{data.get('confidence', 0)}%"),
        ("Strony", str(data.get("pages") or 1)),
    ]))
    story.append(Spacer(1, 8))
    tone = GREEN if approved else RED
    banner = Table([[Paragraph(_esc(decision.get("subtitle") or ""), styles["body"])]], colWidths=[178 * mm])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ecfdf3") if approved else colors.HexColor("#fff1f2")),
        ("BOX", (0, 0), (-1, -1), 1.2, tone),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(banner)
    story.append(Paragraph("Odczytane dane", styles["h2"]))
    story.append(_data_table(styles, ["Pole", "Wartość"], [
        ["Tytuł ubezpieczenia", str(extracted.get("insurance_title") or "—")],
        ["Okres ubezpieczenia", str(extracted.get("insurance_period") or "—")],
        ["Podstawa wymiaru", str(extracted.get("base_amount") or "—")],
        ["Data porodu", str(extracted.get("due_or_birth_date") or "—")],
        ["Wnioskowany wariant", str(extracted.get("requested_variant") or "—")],
    ]))
    story.append(Paragraph("Kompletność dokumentacji", styles["h2"]))
    story.append(Paragraph(_esc(completeness.get("title") or "—"), styles["body"]))
    story.append(Paragraph(_esc(completeness.get("detail") or ""), styles["small"]))
    story.append(Paragraph("Symulacja rozstrzygnięcia", styles["h2"]))
    story.append(_data_table(styles, ["Element", "Wartość"], [
        ["Rozstrzygnięcie", status],
        ["Prognozowana kwota brutto", str(decision.get("monthly_gross") or "—")],
        ["Stawka", str(decision.get("rate_note") or "—")],
    ]))
    story.append(Paragraph("Podstawa prawna", styles["h2"]))
    story.append(Paragraph(_esc(decision.get("legal_basis") or "—"), styles["body"]))
    story.append(Spacer(1, 10))
    story.append(_note(styles, DISCLAIMER + " Decyzję wydaje płatnik zasiłku albo Zakład Ubezpieczeń Społecznych."))
    return _build(story), "raport-weryfikacji.pdf"


def checklist_context(scenario: Dict[str, Any]) -> Dict[str, Any]:
    payer = scenario.get("benefit_payer") or {}
    is_zus = bool(payer.get("is_zus"))
    scenario_id = str(scenario.get("id") or "")
    is_jdg = "jdg" in scenario_id
    is_contract = "zlecenie" in scenario_id
    due = str(scenario.get("due_date") or "2026-09-18")
    try:
        from database import get_legislation_params
        deadline_days = int(get_legislation_params().get("deadline_days_81_5") or 21)
        single_rate = _percent(get_legislation_params().get("rate_single_variant"))
    except Exception:
        deadline_days = 21
        single_rate = "81,5%"
    try:
        deadline = (date.fromisoformat(due) + timedelta(days=deadline_days)).isoformat()
    except ValueError:
        deadline = due
    if is_jdg:
        certificate = ("Zaświadczenie płatnika Z-3", "Przy działalności gospodarczej zaświadczenie Z-3 nie jest wymagane.", "Nie jest wymagane")
    elif is_contract:
        certificate = ("Zaświadczenie płatnika Z-3a", "Zleceniodawca przekazuje do ZUS formularz Z-3a z podstawą składek.", "Wymagane do ZUS")
    elif is_zus:
        certificate = ("Zaświadczenie płatnika Z-3", "Przekazuje pracodawca do ZUS, gdy ZUS jest płatnikiem świadczenia.", "Wymagane do ZUS")
    else:
        certificate = ("Zaświadczenie płatnika Z-3", "Przekazuje pracodawca do ZUS, gdy ZUS jest płatnikiem świadczenia.", "Po stronie pracodawcy")
    payer_title = str(payer.get("title") or ("ZUS" if is_zus else "Pracodawca"))
    return {
        "is_zus": is_zus,
        "payer_title": payer_title,
        "route": "Ty → ZUS → wypłata" if is_zus else "Ty → pracodawca → wypłata w terminie wynagrodzenia",
        "route_note": (
            "Wniosek ZAM składasz bezpośrednio do ZUS."
            if is_jdg else
            "ZUS wypłaci zasiłek po otrzymaniu Z-3a od zleceniodawcy."
            if is_contract else
            "ZUS wypłaca zasiłek po zaświadczeniu Z-3."
            if is_zus else
            "Przy więcej niż 20 ubezpieczonych zasiłek macierzyński wypłaca pracodawca."
        ),
        "deadline": deadline,
        "deadline_days": deadline_days,
        "single_rate": single_rate,
        "due": due,
        "steps": [
            ("Wniosek ZAM", "Zasiłek macierzyński, rodzicielski lub ojcowski.", "Gotowy do wypełnienia"),
            certificate,
            ("Wniosek o urlop do pracodawcy", "Oddzielny od wniosku o wypłatę zasiłku.", "Wymaga podpisu"),
            ("Odpis aktu urodzenia", "ZUS może pozyskać dane elektronicznie z rejestru.", "Do potwierdzenia"),
        ],
    }


def _checklist_from_plan(scenario: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    base = checklist_context(scenario)
    employment = str(overlay.get("employment_type") or "")
    if not employment:
        scenario_id = str(scenario.get("id") or "")
        employment = "jdg" if "jdg" in scenario_id else "zlecenie" if "zlecenie" in scenario_id else "uop"
    forms = list(overlay.get("required_forms") or [])
    is_zus = bool(overlay["payer_is_zus"]) if overlay.get("payer_is_zus") is not None else bool((scenario.get("benefit_payer") or {}).get("is_zus"))
    benefit = str(overlay.get("benefit_type") or "porod")
    if employment == "jdg":
        certificate = ("Zaświadczenie Z-3", "Przy działalności składasz ZAM bezpośrednio do ZUS. Zaświadczenie Z-3 nie jest wymagane. Formularz Z-3b został zniesiony 24.10.2026 r.", "Nie dotyczy — wniosek ZAM do ZUS")
        route_note = "Wniosek ZAM składasz bezpośrednio do ZUS, bez Z-3."
    elif employment == "ustanie":
        certificate = ("Dokument potwierdzający ustanie zatrudnienia", "Do wniosku ZAM dołączasz dokument potwierdzający ustanie zatrudnienia.", "Wymagane do ZUS")
        route_note = "Wypłata przez ZUS po ustaniu zatrudnienia."
    elif employment == "zlecenie" and any("Z-3a" in item for item in forms):
        certificate = ("Zaświadczenie płatnika Z-3a", "Zleceniodawca przekazuje do ZUS formularz Z-3a z podstawą składek.", "Wymagane do ZUS")
        route_note = "ZUS wypłaci zasiłek po otrzymaniu Z-3a od zleceniodawcy."
    elif employment == "zlecenie":
        certificate = ("Zaświadczenie płatnika Z-3a", "Zleceniodawca zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek.", "Nie dotyczy — wypłaca zleceniodawca")
        route_note = "Zasiłek wypłaca zleceniodawca. Z-3a nie jest wymagane."
    elif any(item == "Z-3" or item.startswith("Z-3") and "Z-3a" not in item for item in forms):
        certificate = ("Zaświadczenie płatnika Z-3", "Pracodawca przekazuje do ZUS zaświadczenie Z-3.", "Wymagane do ZUS")
        route_note = "ZUS wypłaca zasiłek po zaświadczeniu Z-3."
    else:
        certificate = ("Zaświadczenie płatnika Z-3", "Płatnik zgłasza powyżej 20 ubezpieczonych i sam wypłaca zasiłek.", "Nie dotyczy — wypłaca pracodawca")
        route_note = "Przy więcej niż 20 ubezpieczonych zasiłek wypłaca pracodawca. Z-3 nie jest wymagane."
    if benefit in ("adopcja", "adoption"):
        event_step = ("Orzeczenie sądu o przysposobieniu / zaświadczenie o wszczęciu postępowania", "Dokument potwierdzający przysposobienie albo wszczęcie postępowania.", "Do potwierdzenia")
    elif benefit in ("piecza", "foster"):
        event_step = ("Postanowienie sądu lub umowa o powierzeniu pieczy zastępczej", "Dokument potwierdzający powierzenie dziecka.", "Do potwierdzenia")
    elif benefit in ("ciaza_l4", "pregnancy"):
        event_step = ("Zaświadczenie e-ZLA", "Zwolnienie lekarskie w ciąży, kod B.", "Do potwierdzenia")
    else:
        event_step = ("Odpis skrócony aktu urodzenia", "ZUS może pozyskać dane elektronicznie z rejestru.", "Do potwierdzenia")
    leave_step = (
        ("Wniosek o urlop do pracodawcy", "Przy tej formie zatrudnienia nie składa się wniosku o urlop z Kodeksu pracy.", "Nie dotyczy (brak urlopu z KP — przysługuje zasiłek z ZUS)")
        if employment in ("jdg", "zlecenie", "ustanie")
        else ("Wniosek o urlop do pracodawcy", "Oddzielny od wniosku o wypłatę zasiłku.", "Wymaga podpisu")
    )
    due = str(overlay.get("due_date") or base["due"])
    try:
        deadline = (date.fromisoformat(due) + timedelta(days=int(base["deadline_days"]))).isoformat()
    except ValueError:
        deadline = base["deadline"]
    payer_title = str(overlay.get("payer_title") or base["payer_title"])
    return {
        **base,
        "is_zus": is_zus,
        "payer_title": payer_title,
        "route": "Ty → ZUS → wypłata" if is_zus else "Ty → płatnik → wypłata",
        "route_note": route_note,
        "due": due,
        "deadline": deadline,
        "steps": [
            ("Wniosek ZAM", "Zasiłek macierzyński, rodzicielski lub ojcowski.", "Gotowy do wypełnienia"),
            certificate,
            leave_step,
            event_step,
        ],
    }


def render_checklist_pdf(scenario: Dict[str, Any], overlay: Optional[Dict[str, Any]] = None) -> Tuple[bytes, str]:
    styles = _styles()
    context = _checklist_from_plan(scenario, overlay) if overlay else checklist_context(scenario)
    story: List[Any] = _heading(
        styles,
        "WNIOSKI, DOKUMENTY I TERMINY",
        "Checklista dopasowana do scenariusza",
        scenario.get("label") or scenario.get("user_name") or "Scenariusz testowy",
    )
    person = str(overlay.get("parent_name") or "Do uzupełnienia") if overlay and "parent_name" in overlay else str(scenario.get("user_name") or "—")
    benefit = str((overlay or {}).get("benefit_type") or "porod")
    when = "przyjęcia dziecka" if benefit in ("adopcja", "piecza", "adoption", "foster") else "porodu"
    rate_label = "100% + 70%" if (overlay or {}).get("variant") == "100_70" else context["single_rate"]
    story.append(_kpi_table(styles, [
        ("Ubezpieczona", person),
        ("Płatnik zasiłku", context["payer_title"]),
        (f"Termin {rate_label}", _long_date(context["deadline"])),
    ]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Ścieżka obiegu", styles["h2"]))
    story.append(Paragraph(_esc(context["route"]), styles["body"]))
    story.append(Paragraph(_esc(context["route_note"]), styles["small"]))
    story.append(Paragraph(
        _esc(f"Wniosek o wariant {rate_label} złóż do {_long_date(context['deadline'])} ({context['deadline_days']} dni od {when} {_long_date(context['due'])})."),
        styles["body"],
    ))
    story.append(Paragraph("Cztery kroki", styles["h2"]))
    story.append(_data_table(
        styles,
        ["Krok", "Dokument", "Co zrobić", "Status"],
        [[str(index), title, text, status] for index, (title, text, status) in enumerate(context["steps"], start=1)],
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Od 24.10.2026 r. formularze ZUR, ZAO oraz Z-3b nie są już używane. Wniosek składasz na zunifikowanym formularzu ZAM.",
        styles["small"],
    ))
    story.append(Spacer(1, 8))
    story.append(_note(styles, DISCLAIMER))
    employment = str((overlay or {}).get("employment_type") or "")
    scenario_id = str(scenario.get("id") or "")
    if employment == "jdg" or (not employment and "jdg" in scenario_id):
        filename = "checklista-jdg.pdf"
    elif employment == "zlecenie" or (not employment and "zlecenie" in scenario_id):
        filename = "checklista-zlecenie.pdf"
    else:
        filename = "checklista-uop.pdf"
    return _build(story), filename
