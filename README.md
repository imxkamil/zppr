# eZUS Rodzic+ — Asystent Świadczeń Rodzicielskich (2026)

**Zasiłkowy Przewodnik Przyszłego Rodzica**

eZUS Rodzic+ prowadzi przyszłego rodzica od sprawdzenia prawa do świadczenia aż po wniosek i termin. Obejmuje umowę o pracę, działalność gospodarczą, umowę zlecenie, ustanie zatrudnienia, adopcję i pieczę zastępczą. Po drodze jest weryfikacja dokumentów PDF, deterministyczny kalkulator stanu prawnego 2026 oraz przygotowanie wniosku ZAM, właściwego zaświadczenia płatnika (Z-3 albo Z-3a) i terminarza `.ics`.

Narzędzie ma charakter informacyjno-edukacyjny. Nie stanowi decyzji administracyjnej ZUS ani porady prawnej.

## Mapa zgodności z kryteriami oceny jury ZUS

Wagi poniżej sumują się do 100% oficjalnej oceny. Każdy wiersz wskazuje, gdzie w tym repozytorium dane kryterium jest zrealizowane.

| Kryterium | Waga | Pokrycie w repozytorium |
| --- | --- | --- |
| Związek z wyzwaniem | 25% | Silnik w [`backend/engine.py`](backend/engine.py) liczy ciążę z L4 i świadczeniem rehabilitacyjnym, urlop macierzyński oraz uzupełniający przy wcześniactwie i hospitalizacji noworodka, wariant 81,5% wobec 100% + 70% z 9 tygodniami tylko dla drugiego rodzica, łączenie rodzicielskiego z pracą do 0,5 etatu, adopcję i pieczę z gwarancją 9+38 albo 9+62 tygodni oraz próg płatnika 20 ubezpieczonych. Od 24.10.2026 r. zniesiono wyłącznie Z-3b (rozporządzenie MRPiPS z 27.09.2026 r., Dz.U. poz. 1316). Zasiłek macierzyński idzie na ZAM. Przy działalności, zleceniu i po ustaniu zatrudnienia urlop rodzicielski składa się na ZUR, a ojcowski na ZAO. Sytuacje trudne są w Strefie Wsparcia. |
| Kompletność projektu i UX | 25% | Pięć zakładek w [`frontend/src/App.tsx`](frontend/src/App.tsx), w kolejności przepływu: Mój Status, Kalkulator, Wnioski i Dokumenty, Weryfikator PDF, Strefa Wsparcia. Wejście bez logowania pokazuje sam wariant zatrudnienia. Profil Anny Kowalskiej, PESEL i wylogowanie pojawiają się dopiero po symulacji mObywatel / login.gov.pl. Formularz chowa pola, które przy danym zdarzeniu nie mają skutku prawnego. Kalkulator ma 9 presetów 2026. Układ działa na desktopie, tablecie i telefonie do 520 px ([`frontend/src/index.css`](frontend/src/index.css)): wysoki kontrast, skala A− / A / A+ i link „Przejdź do treści”. |
| Pomysł | 20% | Przeglądarka maluje plan od razu lustrem z [`frontend/src/api.ts`](frontend/src/api.ts), a wynik z serwera go zastępuje. Serwer liczy podstawę przez `Decimal` i `ROUND_HALF_UP`. Oś „Matka + Ojciec” pokazuje podział opieki. Ten sam plan zasila kreator ZAM i plik `.ics` z terminem wariantu 81,5%. |
| Oryginalność | 15% | Architektura **Zero-Hallucination Legal Engine + Selective AI**: stawki, tygodnie i kwoty są w kodzie i w SQLite, a [`backend/tests/audit_2026.py`](backend/tests/audit_2026.py) sprawdza je regresyjnie. Skan bez warstwy tekstowej czyta lokalny RapidOCR (najwyżej dwie pierwsze strony). Gdy ustawiono `NVIDIA_API_KEY`, model `nvidia/nemotron-3.5-bolt-e4b` uzupełnia tylko puste pola i nie nadpisuje parsera. Pusty odczyt nie dostaje wymyślonej kwoty ani daty. |
| Potencjał wdrożeniowy | 15% | Wygląd i wejście są oparte na wzorcu PUE/eZUS oraz Węzła Krajowego (login.gov.pl). Stawki i wymiary urlopu zmienia [`PUT /api/admin/params`](backend/main.py) w SQLite, bez edycji wzoru. [`docker-compose.yml`](docker-compose.yml) stawia całość jedną komendą. Ten sam audyt `audit_2026.py` pilnuje silnika, parsera PDF i żywego API. |

## Architektura i rola AI

```text
Przeglądarka
  React 19 + TypeScript + Vite + Tailwind
  frontend/src/App.tsx · frontend/src/api.ts
        │  fetch, bez obcinania prefiksu /api
        ▼
FastAPI (Python 3.12 w Dockerze)
  backend/main.py
        ├── backend/engine.py          silnik 2026, Decimal
        ├── backend/database.py        SQLite: stawki i organizacje
        ├── backend/pdf_verifier.py    PyMuPDF, RapidOCR, parser, opcjonalny NVIDIA NIM
        └── backend/pdf_generator.py   ReportLab: plan, raport, checklista
```

Obraz backendu to `python:3.12-slim` ([`backend/Dockerfile`](backend/Dockerfile)). Lokalnie ten sam `requirements.txt` wstaje też na Pythonie 3.13. Frontend w kontenerze buduje Node 20 i serwuje nginx ([`frontend/Dockerfile`](frontend/Dockerfile), [`frontend/nginx.conf`](frontend/nginx.conf)).

### Gdzie użyto AI, a gdzie działa logika deterministyczna

Wymóg formalny: pkt 4 i 9 regulaminu. Model nie liczy świadczenia.

| Miejsce | Deterministyczne | AI |
| --- | --- | --- |
| Wytworzenie repozytorium | Kod, testy i kontenery są w gicie. `docker compose up --build` wstaje z kluczem sandboxowym zaszytym w Compose; po jego usunięciu zostaje lokalny OCR. | Interfejs, silnik, API i konteneryzacja powstały przy asystencie w Cursorze. |
| Kalkulator i płatnik | [`backend/engine.py`](backend/engine.py) oraz lustro `calculateLocally` w [`frontend/src/api.ts`](frontend/src/api.ts). Kwota, tygodnie, próg 20 osób i termin 21 dni nie wołają modelu. | Nie. |
| Oś czasu, wniosek ZAM, plik `.ics` | Składane w przeglądarce z planu kalkulatora. „Wysłanie” wniosku jest symulacją i nie zapisuje się w ZUS. | Nie. |
| Radar ryzyk | Reguły scenariusza: ciągłość do porodu, skok podstawy, zadłużenie JDG powyżej 1% płacy minimalnej. | Nie. Modal „Jak działa AI w tym module?” tylko to opisuje. |
| PDF z warstwą tekstu | PyMuPDF i lokalny parser w [`backend/pdf_verifier.py`](backend/pdf_verifier.py). Puste pole zostaje puste. | Nie. |
| Skan bez tekstu | RapidOCR czyta offline najwyżej dwie pierwsze strony. Pusty wynik zostawia podstawę i datę puste. | Z `NVIDIA_API_KEY` model `nvidia/nemotron-3.5-bolt-e4b` uzupełnia tylko brakujące pola tekstu. Nie liczy świadczenia. |
| Stawki 2026 | SQLite i panel w Strefie Wsparcia. Reset wraca do wartości ustawowych. | Nie. |

## AI i open source

**Architektura Zero-Hallucination.** Wszystkie obliczenia zasiłków, podstaw, terminów i progów ustawowych wykonuje w 100% deterministyczny silnik w Pythonie ([`backend/engine.py`](backend/engine.py)). Model językowy nigdy nie liczy kwot.

**Lokalny OCR (open source, offline-first).** Odczyt skanów PDF realizuje lokalnie **RapidOCR (ONNX Runtime)** (licencja **Apache 2.0**, open source) oraz **PyMuPDF**. Dokument nie jest wysyłany do chmury po to, żeby go odczytać. RapidOCR bierze najwyżej dwie pierwsze strony. Pusty odczyt zostawia kwotę i datę puste.

**Opcjonalny fallback LLM.** Gdy ze skanu brakuje kluczowego pola, system wykorzystuje model **NVIDIA Nemotron** (`nvidia/nemotron-3.5-bolt-e4b`). To rodzina otwartych modeli **NVIDIA Nemotron** o otwartych wagach, udostępniana przez API NVIDIA NIM. Model służy wyłącznie do ekstrakcji brakujących pól z tekstu OCR i nie nadpisuje tego, co parser już odczytał. Świadczenie dalej liczy `engine.py`.

**Gotowość po `docker compose up --build`.** W [`docker-compose.yml`](docker-compose.yml) zaszyty jest dedykowany klucz sandboxowy na potrzeby ewaluacji jury. Klon bez pliku `.env` od razu ma aktywny fallback AI. Zmienna środowiskowa `NVIDIA_API_KEY` nadpisuje ten klucz. Po usunięciu klucza aplikacja nadal działa w pełni offline dzięki lokalnemu RapidOCR.

> **Uwaga dla Jury / Security:**
>
> - Udostępniony w repozytorium ([`docker-compose.yml`](docker-compose.yml) oraz [`.env.example`](.env.example)) klucz `NVIDIA_API_KEY` to **dedykowany, limitowany klucz sandboxowy**, wystawiony **celowo publicznie** wyłącznie po to, aby komisja oceniająca mogła uruchomić pełny przepływ (`docker compose up --build`) od ręki, bez konieczności zakładania konta i generowania własnych tokenów. Po zakończeniu oceny klucz zostanie zrotowany i wyłączony.
> - Wykorzystywany model **NVIDIA Nemotron** (`nvidia/nemotron-3.5-bolt-e4b`) jest modelem **open-weights (otwarte wagi)**. W środowisku produkcyjnym ZUS nie trzeba korzystać z zewnętrznego API chmurowego: wagi modelu można pobrać (np. z Hugging Face) i uruchomić **w 100% lokalnie / on-premise** w infrastrukturze ZUS (np. przez **vLLM**, **NVIDIA NIM self-hosted** lub **Ollama**), zachowując pełną suwerenność danych obywateli.
> - Kluczowe obliczenia prawno-finansowe wykonuje deterministyczny silnik [`engine.py`](backend/engine.py), a OCR skanów działa lokalnie na open-source'owym **RapidOCR (Apache 2.0)**, więc aplikacja zachowuje pełną funkcjonalność także całkowicie offline.

## Szybkie uruchomienie

### Docker Compose

Z katalogu głównego repozytorium:

```bash
docker compose up --build
```

| Co otworzyć | Adres |
| --- | --- |
| Aplikacja | [http://localhost:5173/](http://localhost:5173/) |
| API | [http://localhost:8000/](http://localhost:8000/) |
| Swagger | [http://localhost:8000/docs](http://localhost:8000/docs) |

Port 5173 na hoście wskazuje nginx w kontenerze (port 80). Obraz frontendu buduje się bez `VITE_API_URL`, więc przeglądarka woła API pod `http://localhost:8000`. To działa na tej samej maszynie co kontenery.

W `docker-compose.yml` fallbackiem `NVIDIA_API_KEY` jest dedykowany klucz sandboxowy na ocenę jury, ten sam co w [`.env.example`](.env.example). Dzięki temu `docker compose up --build` na klonie bez `.env` od razu uzupełnia puste pola skanu. Własna zmienna `NVIDIA_API_KEY` nadpisuje tę wartość. Po usunięciu klucza z Compose aplikacja nadal wstaje, a skan czyta lokalny RapidOCR.

> **Uwaga dla Jury / Security:**
>
> - Klucz `NVIDIA_API_KEY` w [`docker-compose.yml`](docker-compose.yml) i [`.env.example`](.env.example) to **dedykowany, limitowany klucz sandboxowy**, wystawiony **celowo publicznie** wyłącznie na czas oceny. Komisja uruchamia pełny przepływ bez zakładania konta i bez własnych tokenów. Po zakończeniu oceny klucz zostanie zrotowany i wyłączony.
> - **NVIDIA Nemotron** (`nvidia/nemotron-3.5-bolt-e4b`) ma **otwarte wagi**. W produkcji ZUS nie musi wołać chmurowego API: wagi można pobrać (np. z Hugging Face) i uruchomić **w 100% lokalnie / on-premise** (np. **vLLM**, **NVIDIA NIM self-hosted**, **Ollama**), z pełną suwerennością danych obywateli.
> - Kwoty, podstawy i terminy liczy deterministyczny [`engine.py`](backend/engine.py), a skan czyta lokalny **RapidOCR (Apache 2.0)**. Bez klucza i bez sieci aplikacja zostaje w pełni używalna.

### Lokalnie (Windows)

Dwa terminale. Katalog roboczy backendu musi być `backend`, bo importy są płaskie.

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm install
npm run dev
```

Opcjonalne uzupełnianie pustych pól PDF przy lokalnym uvicorn. W Dockerze ten sam klucz sandboxowy jest już w `docker-compose.yml`. Plik `.env` zostaje tylko na maszynie dewelopera i jest w `.gitignore`. Sam OCR skanu działa offline, gdy klucza nie ma.

```powershell
$env:NVIDIA_API_KEY = "klucz"
```

### Lokalnie (Linux)

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

```bash
export NVIDIA_API_KEY="klucz"
```

Frontend: [http://127.0.0.1:5173/](http://127.0.0.1:5173/). API: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Gdy 5173 jest zajęty, Vite bierze następny port. Wtedy przed `npm run dev` ustaw `VITE_API_URL=http://127.0.0.1:8000`.

Bez działającego API interfejs zostaje na danych z [`frontend/src/api.ts`](frontend/src/api.ts): te same scenariusze, lustro kalkulatora, sprawy PDF i organizacje. Przyciski PDF otwierają wtedy podgląd wydruku przeglądarki.

### Test regresyjny

Najpierw uvicorn z aktualnego kodu, potem w drugim terminalu:

```powershell
cd backend
$env:API_PORT = "8000"
.\.venv\Scripts\python.exe tests\audit_2026.py
```

```bash
cd backend
API_PORT=8000 .venv/bin/python tests/audit_2026.py
```

Skrypt sam zdejmuje `GEMINI_API_KEY` i `NVIDIA_API_KEY`, żeby parser szedł offline. Sprawdza silnik, oba tory PDF i — gdy `API_PORT` jest ustawiony — żywe `/openapi.json`, symulację i CORS. Oczekiwany wynik pełnego przebiegu: **0 FAIL**. Bez `API_PORT` część o żywym API jest pominięta, a reszta i tak się liczy. Opis przypadków jest w [`DOKUMENTACJA.md`](DOKUMENTACJA.md), sekcja 16.

### Ścieżka demo dla jury

1. Na starcie wejdź w **Tryb szybkiego podglądu** (UoP, JDG albo zlecenie) albo zaloguj się symulacją skanu mObywatel. Podgląd nie pokazuje danych osoby. Po skanie widać profil Anny Kowalskiej.
2. **Mój Status** pokazuje ubezpieczenie, wyczekiwanie, płatnika, przykładowe e-ZLA i radar ryzyk tego wariantu.
3. **Kalkulator** ma 9 presetów po lewej. Porównaj 81,5% z 100% + 70%, ciążę, adopcję, pieczę, szpital i łączenie z pracą. **Pobierz PDF** zapisuje `plan-swiadczen.pdf`.
4. **Wnioski i Dokumenty** biorą imię, datę, wariant i płatnika z kalkulatora. Kreator otwiera ZAM. Przy działalności, zleceniu i po ustaniu zatrudnienia checklista wskazuje też ZUR i ZAO. **Dodaj do kalendarza** zapisuje termin `.ics`.
5. **Weryfikator PDF** otwiera cztery sprawy testowe albo przyjmuje własny plik. **Przenieś dane do kalkulatora i policz** jest na dolnym pasku i wypełnia formularz odczytanymi polami.
6. **Strefa Wsparcia** ma organizacje i panel stawek. Zmiana stawki w `PUT /api/admin/params` przelicza kalkulator bez zmiany kodu.

### Endpointy

| Metoda | Ścieżka | Rola |
| --- | --- | --- |
| GET | `/api/health` | Czy API żyje |
| POST | `/api/auth/mobywatel/init` | Start sesji mObywatel |
| POST | `/api/auth/mobywatel/confirm/{session_id}` | Symulacja skanu QR |
| GET | `/api/scenarios` | Trzy warianty wejścia: `uop_over_20`, `jdg_active`, `zlecenie_no_waiting` |
| GET | `/api/scenarios/{scenario_id}` | Status, płatnik, e-ZLA i ryzyka |
| POST | `/api/calculator/simulate` | Plan świadczeń |
| GET | `/api/pdf/test-cases` | Cztery sprawy weryfikatora |
| POST | `/api/pdf/verify` | Upload PDF (`multipart/form-data`, pole `file`) |
| POST | `/api/export/calculator-pdf` | PDF planu |
| POST | `/api/export/verification-pdf` | PDF raportu z weryfikatora |
| POST | `/api/export/checklist-pdf` | PDF checklisty dla `scenario_id` |
| GET | `/api/support/organizations?q=` | Organizacje, z wyszukiwaniem |
| POST | `/api/support/organizations` | Nowa organizacja |
| DELETE | `/api/support/organizations/{org_id}` | Usunięcie organizacji |
| GET | `/api/admin/params` | Stawki i wymiary z SQLite |
| PUT | `/api/admin/params` | Zapis stawek z panelu |
| POST | `/api/admin/params/reset` | Powrót do wartości 2026 |

Pełny opis algorytmu, macierzy etykiet, przepływu między zakładkami i list kontrolnych GUI jest w [`DOKUMENTACJA.md`](DOKUMENTACJA.md).
