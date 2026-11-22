from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uuid

from database import (
    add_organization,
    delete_organization,
    get_legislation_params,
    init_db,
    list_organizations,
    reset_legislation_params,
    update_legislation_params,
)
from engine import SCENARIOS, calculate_benefit_plan, published_scenario, published_scenarios
from pdf_generator import render_calculator_pdf, render_checklist_pdf, render_verification_pdf
from pdf_verifier import TEST_CASES, analyze_uploaded_pdf

app = FastAPI(title="eZUS Rodzic+ API", version="1.0.0")

# allow_credentials nie może iść w parze z origin "*", bo przeglądarka odrzuca taką odpowiedź
# i część wersji Starlette przerywa start serwera.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ezus-rodzic"}


# --- 1. AUTORYZACJA WĘZEŁ KRAJOWY / mOBYWATEL (SYMULACJA) ---
@app.post("/api/auth/mobywatel/init")
def init_mobywatel_session():
    session_token = str(uuid.uuid4())
    return {
        "session_id": session_token,
        "qr_payload": f"mobywatel://login.gov.pl/ezus?session={session_token}",
        "expires_in_seconds": 300
    }


@app.post("/api/auth/mobywatel/confirm/{session_id}")
def confirm_mobywatel_session(session_id: str):
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="Brak identyfikatora sesji")
    return {
        "authenticated": True,
        "provider": "Węzeł Krajowy (mObywatel 2.0)",
        "user": {
            "full_name": "Anna Kowalska",
            "pesel_masked": "920514*****",
            "pue_connected": True
        }
    }


# --- 2. STATUS UBEZPIECZENIA I SCENARIUSZE ---
@app.get("/api/scenarios")
def get_scenarios():
    return published_scenarios()


@app.get("/api/scenarios/{scenario_id}")
def get_scenario_detail(scenario_id: str):
    scenario = published_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Nieznany scenariusz")
    return scenario


class LegislationInput(BaseModel):
    rate_single_variant: float
    rate_maternity: float
    rate_parental: float
    maternity_weeks_single: int
    parental_weeks_single: int
    paternity_weeks: int
    deadline_days_81_5: int


def _validated_legislation(data: LegislationInput) -> Dict[str, Any]:
    payload = data.model_dump()
    ranges = {
        "rate_single_variant": (1, 100),
        "rate_maternity": (1, 100),
        "rate_parental": (1, 100),
        "maternity_weeks_single": (1, 52),
        "parental_weeks_single": (1, 80),
        "paternity_weeks": (0, 12),
        "deadline_days_81_5": (1, 90),
    }
    for key, (low, high) in ranges.items():
        value = payload[key]
        if value < low or value > high:
            raise HTTPException(status_code=400, detail=f"Parametr {key} musi być w zakresie {low}–{high}.")
    return payload


@app.get("/api/admin/params")
def api_get_params():
    return get_legislation_params()


@app.put("/api/admin/params")
def api_put_params(data: LegislationInput):
    return update_legislation_params(_validated_legislation(data))


@app.post("/api/admin/params/reset")
def api_reset_params():
    return reset_legislation_params()


# --- 3. KALKULATOR ZASIŁKÓW ---
class CalculatorInput(BaseModel):
    benefit_type: str = "porod"
    employment_type: str = "uop"
    children_count: int = 1
    due_date: str = ""
    start_before_birth: bool = False
    za_zyciem: bool = False
    premature_extra_weeks: int = 0
    variant: str = "81.5"
    work_share: float = 0.0
    base_salary_gross: float = 0.0
    scenario_label: str = ""
    parent_name: str = ""
    second_parent_name: str = ""
    parent_role: str = "matka"
    tygodnie_przed_porodem: int = 0
    tydzien_ciazy_porodu: Optional[int] = None
    masa_urodzeniowa_g: Optional[int] = None
    dni_w_szpitalu: Optional[int] = None
    etat_pracy: Optional[float] = None
    tygodnie_laczenia: Optional[float] = None
    wymiar_etatu: Optional[float] = None
    hospitalizacja_od_dnia: Optional[int] = None
    hospitalizacja_do_dnia: Optional[int] = None
    wiek_dziecka_lata: Optional[float] = None
    wiek_dziecka_miesiace: Optional[float] = None
    odroczenie_obowiazku_szkolnego: bool = False
    liczba_ubezpieczonych: int = 21
    wiek_ubezpieczonego: Optional[int] = None
    dni_niezdolnosci: int = 0
    miesiace_rehabilitacji: int = 0
    rehabilitacja_w_ciazy: bool = True
    waiting_days: Optional[int] = None
    wyjatek_wyczekiwania: str = ""
    chorobowe_w_dniu_porodu: Optional[bool] = None
    przerwa_przed_kodem_b: Optional[int] = None
    wczesniejsze_dni_l4: int = 0
    zgon_dziecka: bool = False
    dzien_zycia_przy_zgonie: Optional[int] = None
    dzieci_przy_zyciu: Optional[int] = None
    miesiace_od_uprawomocnienia: Optional[float] = None
    miesiace_podstawy: Optional[List[Dict[str, Any]]] = None
    choroba_w_pierwszym_miesiacu: bool = False
    debt_amount: float = 0.0
    matka_nie_moze_opiekowac: bool = False
    include_paternity: bool = True


def pdf_attachment(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/calculator/simulate")
def simulate_benefits(data: CalculatorInput):
    try:
        return calculate_benefit_plan(data.model_dump())
    except Exception:
        raise HTTPException(status_code=400, detail="Nie udało się wyliczyć świadczenia. Sprawdź datę i podstawę.")


class VerificationExport(BaseModel):
    filename: str = "dokument.pdf"
    pages: int = 1
    confidence: int = 0
    extracted: Dict[str, Any] = {}
    completeness: Dict[str, Any] = {}
    decision: Dict[str, Any] = {}


class ChecklistExport(BaseModel):
    scenario_id: str
    parent_name: Optional[str] = None
    due_date: Optional[str] = None
    variant: Optional[str] = None
    benefit_type: Optional[str] = None
    employment_type: Optional[str] = None
    payer_title: Optional[str] = None
    payer_is_zus: Optional[bool] = None
    required_forms: Optional[List[str]] = None
    payer_note: Optional[str] = None


@app.post("/api/export/calculator-pdf")
def export_calculator_pdf(data: CalculatorInput):
    try:
        plan = calculate_benefit_plan(data.model_dump())
        content, filename = render_calculator_pdf(data.model_dump(), plan)
    except Exception:
        raise HTTPException(status_code=400, detail="Nie udało się przygotować PDF planu świadczeń.")
    return pdf_attachment(content, filename)


@app.post("/api/export/verification-pdf")
def export_verification_pdf(data: VerificationExport):
    try:
        content, filename = render_verification_pdf(data.model_dump())
    except Exception:
        raise HTTPException(status_code=400, detail="Nie udało się przygotować raportu PDF.")
    return pdf_attachment(content, filename)


@app.post("/api/export/checklist-pdf")
def export_checklist_pdf(data: ChecklistExport):
    scenario = SCENARIOS.get(data.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Nieznany scenariusz")
    try:
        overlay = data.model_dump(exclude={"scenario_id"}, exclude_none=True)
        content, filename = render_checklist_pdf(scenario, overlay or None)
    except Exception:
        raise HTTPException(status_code=400, detail="Nie udało się przygotować checklisty PDF.")
    return pdf_attachment(content, filename)


# --- 4. WERYFIKATOR SPRAW PDF ---
@app.get("/api/pdf/test-cases")
def get_pdf_test_cases():
    return list(TEST_CASES.values())


@app.post("/api/pdf/verify")
async def verify_pdf_upload(file: UploadFile = File(...)):
    filename = file.filename or "dokument.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Dozwolone są wyłącznie pliki PDF.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Plik PDF jest pusty.")
    try:
        return analyze_uploaded_pdf(content, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 5. STREFA WSPARCIA + PANEL ADMINISTRACYJNY ---
class OrgCreate(BaseModel):
    category: str
    badge: str
    name: str
    description: str
    phone: str
    website: str


@app.get("/api/support/organizations")
def api_list_orgs(q: Optional[str] = ""):
    return list_organizations(q or "")


@app.post("/api/support/organizations")
def api_create_org(org: OrgCreate):
    payload = org.model_dump()
    if not payload["name"].strip() or not payload["phone"].strip():
        raise HTTPException(status_code=400, detail="Nazwa i telefon są wymagane.")
    return add_organization(payload)


@app.delete("/api/support/organizations/{org_id}")
def api_delete_org(org_id: int):
    if not delete_organization(org_id):
        raise HTTPException(status_code=404, detail="Nie znaleziono organizacji")
    return {"deleted": True, "id": org_id}
