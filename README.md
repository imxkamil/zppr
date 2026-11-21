# eZUS Rodzic+

## Uruchomienie w Dockerze

Z katalogu projektu:

```bash
docker compose up --build
```

Frontend: [http://localhost:5173/](http://localhost:5173/)  
API: [http://localhost:8000/docs](http://localhost:8000/docs)

Obraz backendu to `python:3.12-slim` z czcionkami DejaVu i Liberation, żeby PDF miał polskie znaki. Frontend buduje się na `node:20-alpine` i jest serwowany przez nginx na porcie 5173.

Asystent świadczeń rodzicielskich na demonstrację. Aplikacja prowadzi przez symulowane logowanie mObywatel, pokazuje status ubezpieczenia, liczy zasiłek macierzyński i rodzicielski, sprawdza kompletność wniosku PDF oraz podpowiada dokumenty, terminy i zweryfikowane organizacje pomocowe.

Wyniki mają charakter informacyjny i nie są decyzją ZUS.

## Architektura

- **Frontend:** React 19 + TypeScript + Vite + Tailwind (`frontend/`). Jeden widok `src/App.tsx` i klient API `src/api.ts`.
- **Backend:** Python + FastAPI (`backend/main.py`), uruchamiany przez uvicorn na porcie 8000.
- **Silnik świadczeń:** `backend/engine.py` — stawki 2026, wariant 81,5% albo 100% + 70%, zaliczka PIT 12%, harmonogram 12 miesięcy, trzy scenariusze testowe.
- **Baza:** SQLite (`backend/ezus_rodzic.db`) — organizacje Strefy Wsparcia oraz edytowalne parametry ustawowe (`backend/database.py`). Silnik zasiłków czyta stawki i wymiary z tej tabeli.
- **PDF przychodzące:** PyMuPDF wyciąga tekst, a przy ustawionym `GEMINI_API_KEY` analizę robi Gemini. Bez klucza działa parser lokalny (`backend/pdf_verifier.py`).
- **PDF wychodzące:** ReportLab z czcionką Arial (polskie znaki) albo bezpieczną transliteracją, gdy czcionki systemowej nie ma (`backend/pdf_generator.py`).

## Uruchomienie

Potrzebne są Python 3.13 i Node.js. W dwóch terminalach:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
cd frontend
npm install
npm run dev
```

Frontend: [http://localhost:5173/](http://localhost:5173/)  
API: [http://127.0.0.1:8000](http://127.0.0.1:8000)  
Dokumentacja OpenAPI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Opcjonalnie, do analizy wgrywanych PDF przez Gemini:

```powershell
$env:GEMINI_API_KEY = "klucz"
```

Bez tej zmiennej weryfikator i tak zwraca wynik z lokalnego odczytu tekstu.

`backend/requirements.txt` używa `pymupdf==1.26.7` i `google-genai==1.21.1`, bo wskazane wcześniej wydania nie instalują się na Pythonie 3.13.

## Endpointy

| Metoda | Ścieżka | Do czego służy |
| --- | --- | --- |
| GET | `/api/health` | Sprawdzenie, czy API żyje |
| POST | `/api/auth/mobywatel/init` | Start sesji logowania mObywatel |
| POST | `/api/auth/mobywatel/confirm/{session_id}` | Symulacja skanu kodu QR |
| GET | `/api/scenarios` | Lista trzech scenariuszy testowych |
| GET | `/api/scenarios/{scenario_id}` | Status, płatnik, e-ZLA i ryzyka jednego scenariusza |
| POST | `/api/calculator/simulate` | Wyliczenie planu świadczeń |
| GET | `/api/pdf/test-cases` | Cztery gotowe sprawy do weryfikatora |
| POST | `/api/pdf/verify` | Analiza wgranego pliku PDF (`multipart/form-data`, pole `file`) |
| POST | `/api/export/calculator-pdf` | PDF planu świadczeń |
| POST | `/api/export/verification-pdf` | PDF raportu z weryfikatora |
| POST | `/api/export/checklist-pdf` | PDF checklisty dla `scenario_id` |
| GET | `/api/support/organizations?q=` | Lista organizacji, z wyszukiwaniem |
| POST | `/api/support/organizations` | Dodanie organizacji w panelu admina |
| DELETE | `/api/support/organizations/{org_id}` | Usunięcie organizacji |
| GET | `/api/admin/params` | Aktualne stawki i wymiary z SQLite |
| PUT | `/api/admin/params` | Zapis stawek z panelu administracyjnego |
| POST | `/api/admin/params/reset` | Przywrócenie wartości ustawowych 2026 |

Identyfikatory scenariuszy: `uop_over_20`, `jdg_active`, `zlecenie_no_waiting`.

## Tryb offline

Każde wywołanie API w przeglądarce ma limit czasu. Gdy `localhost:8000` nie odpowiada, interfejs zostaje na danych zaszytych w `frontend/src/api.ts`: te same trzy scenariusze, ten sam wzór kalkulatora, cztery sprawy PDF i trzy organizacje startowe. Przyciski PDF (`Pobierz PDF`, `Pobierz raport`, `Utwórz checklistę PDF`) próbują pobrać plik z backendu, a przy braku połączenia otwierają podgląd wydruku przeglądarki.

## Jak przejść demo

1. Otwórz frontend i wybierz **Zaloguj do PUE/eZUS przez mObywatel**, potem **zasymuluj skan**. Można też wejść od razu w podgląd scenariusza.
2. Na pasku **Scenariusz testowy** przełącz UoP, JDG i umowę zlecenie. Status oraz zakładka dokumentów zmieniają płatnika: pracodawca przy UoP powyżej 20 osób, ZUS przy JDG i zleceniu.
3. W kalkulatorze porównaj 81,5% z 100% + 70%, suwak etatu (0–50%) i liczbę dzieci. **Pobierz PDF** zapisuje `plan-swiadczen.pdf`.
4. W weryfikatorze kliknij jeden z czterech przypadków albo wgraj PDF. **Pobierz raport** zapisuje `raport-weryfikacji.pdf`.
5. W dokumentach **Utwórz checklistę PDF** zapisuje checklistę dopasowaną do bieżącego scenariusza.
6. W Strefie Wsparcia wyszukaj organizację. W panelu administracyjnym, na zakładce **Parametry ustawowe i stawki ZUS**, zmień stawkę wariantu stałego i sprawdź przeliczenie w kalkulatorze.
7. Kliknij **PUE/eZUS · aktywne**, wyślij zapytanie i odczytaj numer sprawy `ZUS/PUE/2026/...`.
8. W dokumentach wypełnij wniosek ZAM, podejrzyj wniosek o urlop i złóż symulację odpisu aktu urodzenia.

## Zakres wykorzystania AI (zgodnie z pkt 4 i 9 regulaminu)

### AI w procesie wytwórczym

Interfejs, silnik wyliczeń, integracja API i konteneryzacja powstały przy wsparciu asystenta w Cursorze. Gotowy kod jest w tym repozytorium. Aplikację da się zbudować i uruchomić bez żadnego modelu językowego: `docker compose up --build` albo dwa lokalne procesy opisane wyżej.

### AI w działaniu aplikacji

W samej aplikacji model jest opcjonalny i ograniczony do dwóch miejsc, opisanych też w modalach **Jak działa AI w tym module?**:

- **Weryfikator PDF.** PyMuPDF wyciąga tekst z pliku. Jeśli ustawiono `GEMINI_API_KEY`, model Gemini 2.5 Flash zwraca JSON z polami wniosku i oceną kompletności. Bez klucza działa deterministyczny parser regułowy (tytuł ubezpieczenia, obecność Z-3/Z-3a, JDG).
- **Radar ryzyk.** Karty nie są swobodną odpowiedzią czatu. Dla scenariusza dokładane są reguły: ciągłość ubezpieczenia do porodu, nagłe podwyższenie podstawy składek oraz zadłużenie JDG powyżej 1% minimalnego wynagrodzenia.

Kalkulator zasiłków, checklisty, parametry ustawowe i organizacje pomocowe liczą się wzorami oraz danymi z SQLite. Nie wywołują modelu.
