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
- **PDF przychodzące:** PyMuPDF wyciąga tekst, lokalny parser czyta pola wniosku, a przy ustawionym `GEMINI_API_KEY` Gemini uzupełnia tylko braki albo robi OCR skanu. Bez klucza skan nie dostaje sztucznych kwot (`backend/pdf_verifier.py`).
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
3. W kalkulatorze porównaj 81,5% z 100% + 70%, wybierz zdarzenie (poród, ciąża z rehabilitacją, adopcja, piecza), urlop przed porodem, hospitalizację i łączenie z pracą do połowy etatu. Kwota wejściowa to brutto przed odliczeniem 13,71%. **Pobierz PDF** zapisuje `plan-swiadczen.pdf`.
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

- **Weryfikator PDF, odczyt hybrydowy.** PyMuPDF wyciąga warstwę tekstową. Lokalny parser czyta z niej imię i rolę (matka, ojciec, opiekun), datę porodu, przewidywanego porodu albo przyjęcia na wychowanie, podstawę składek lub wynagrodzenie, tytuł ubezpieczenia (UoP, JDG, zlecenie) oraz liczbę ubezpieczonych. Brakujące pole zostaje puste. Jeśli ustawiono `GEMINI_API_KEY`, Gemini 2.5 Flash uzupełnia tylko puste pola, a przy skanie bez tekstu może zrobić OCR. Bez klucza skan zwraca komunikat o braku warstwy tekstowej i nie podstawia kwoty ani daty.
- **Radar ryzyk.** Karty nie są swobodną odpowiedzią czatu. Dla scenariusza dokładane są reguły: ciągłość ubezpieczenia do porodu, nagłe podwyższenie podstawy składek oraz zadłużenie JDG powyżej 1% minimalnego wynagrodzenia.

Kalkulator nie wywołuje modelu. Liczy stan prawny na 2026 rok: Kodeks pracy (Dz.U. 2026 poz. 1245) oraz ustawa zasiłkowa (Dz.U. 2026 poz. 854), z uwzględnieniem rozporządzeń MRPiPS z 11.03.2025 i 27.09.2026. Obejmuje poród, ciążę z okresem 270 dni i świadczeniem rehabilitacyjnym, adopcję do 14. roku życia, pieczę zastępczą do 7. albo 10. roku, urlop przed porodem, uzupełniający urlop macierzyński, łączenie rodzicielskiego z pracą do połowy etatu oraz podział między rodziców. Stawki bazowe i wymiary urlopu przy jednym dziecku są w SQLite i da się je zmienić w panelu parametrów. Odliczenie 13,71%, podłoga i sufit podstawy oraz próg 20 ubezpieczonych są w silniku.
