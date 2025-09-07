# goTogether

Aplikacja **goTogether** umożliwia współdzielenie podróży – użytkownicy mogą oferować miejsca w swoich samochodach lub szukać podróży, do których mogą się przyłączyć. Projekt składa się z **frontend-u w React** oraz **backend-u w Node.js/Express** z bazą danych PostgreSQL.

---

## Spis treści

1. [Funkcjonalności](#funkcjonalności)
2. [Technologie](#technologie)
3. [Instalacja i uruchomienie](#instalacja-i-uruchomienie)
4. [Konfiguracja środowiska](#konfiguracja-środowiska)
5. [Struktura projektu](#struktura-projektu)
6. [API](#api)
7. [Użytkowanie](#użytkowanie)
8. [Uwagi końcowe](#uwagi-końcowe)

---

## Funkcjonalności

* **Rejestracja i logowanie** za pomocą Google OAuth
* **Dodawanie własnych podróży i ofert**
* **Wyszukiwanie pasujących podróży lub kierowców**
* **Dołączanie do podróży i ofert innych użytkowników**
* **Wyświetlanie prognozy pogody** dla miejsca docelowego
* **Mapa trasy** pokazująca położenie startu i celu podróży
* **Powiadomienia** o zmianach i aktualizacjach podróży

---

## Technologie

**Frontend**:

* React 18
* React Router
* Material-UI
* Leaflet do wyświetlania map
* Axios do komunikacji z API

**Backend**:

* Node.js + Express
* PostgreSQL jako baza danych
* Passport.js z Google OAuth
* OpenRouteService API do obliczania tras
* Gemini API / prognozy pogody

---

## Instalacja i uruchomienie

### Backend

1. Wejdź do folderu backend:

```bash
cd backend
```

2. Zainstaluj zależności:

```bash
npm install
```

3. Utwórz plik `.env` z konfiguracją (przykład poniżej).

4. Uruchom serwer:

```bash
npm start
```

### Frontend

1. Wejdź do folderu frontend:

```bash
cd frontend
```

2. Zainstaluj zależności:

```bash
npm install
```

3. Utwórz plik `.env` z konfiguracją (przykład poniżej).

4. Uruchom aplikację:

```bash
npm start
```

---

## Konfiguracja środowiska

### Backend (`.env`)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=topsecret
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=goTogether
PG_PASSWORD=pass1
PG_PORT=5432
GEMINI_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=diary-467116-f6c08a34ae29.json
ORS_API_KEY=...
ORS_API_URL=https://api.openrouteservice.org
```

### Frontend (`.env`)

```env
REACT_APP_API_URL=http://localhost:3000
VITE_REACT_APP_API_URL=http://localhost:3000
REACT_APP_ORS_API_KEY=...
VITE_GEMINI_API_KEY=...
```

---

## Struktura projektu

```
goTogether/
│
├── backend/ # Serwer Node.js + Express
│ ├── index.js # Główny plik backendu
│ ├── package.json # Zależności backendu
│ ├── .env # Zmienne środowiskowe backendu
│ └── .env.example # Przykład konfiguracji env
│
├── frontend/ # Aplikacja React (Vite)
│ ├── src/
│ │ ├── assets/ # Zasoby (grafiki, ikony)
│ │ ├── components/ # Komponenty React
│ │ └── index.jsx # Punkt startowy React
│ ├── public/ # Pliki statyczne
│ ├── index.html # Główna strona HTML
│ ├── vite.config.js # Konfiguracja Vite
│ ├── package.json # Zależności frontendu
│ └── .env # Zmienne środowiskowe frontendu
│
├── .gitignore # Ignorowane pliki w Git
└── README.md # Dokumentacja projektu

---

## API

**Przykładowe endpointy backendu**:

* `GET /me` – pobranie danych zalogowanego użytkownika
* `POST /offers` – dodanie nowej oferty
* `POST /search-offers` – wyszukiwanie ofert dla pasażera
* `POST /search-trips` – wyszukiwanie podróży dla kierowcy
* `POST /join-offer/:offerId` – dołączenie do oferty
* `POST /join-trip/:tripId` – dołączenie do podróży
* `POST /api/generateAdvice` – pobranie prognozy pogody

---

## Użytkowanie

1. Zaloguj 
2. W menu głównym możesz:

   * zaplanować podróż jako pasażer (TripForm)
   * zaplanować podróż jako kierowca (OfferForm)
   * sprawdzić swoje podróże i oferty
3. Wyszukaj oferty/podróże i dołącz do nich
4. Sprawdź trasę na mapie oraz prognozę pogody
5. Powiadomienia informują o nowych aktualizacjach

---

## Uwagi końcowe

* Aplikacja jest przygotowana do pracy lokalnej (`localhost`)
* Wymaga poprawnego skonfigurowania kluczy API i Google OAuth
* Mapy korzystają z OpenStreetMap i OpenRouteService
* Pogoda jest generowana przez Gemini API

**Autor:** Ewelina Bęben
**Data:** 2025
