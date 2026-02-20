# 🧳 Delegacje SaaS

System zarządzania delegacjami i rozliczania kosztów podróży służbowych dla freelancerów i firm.

## Funkcje

- Tworzenie i zarządzanie projektami delegacji
- Rejestracja wydatków z kategoryzacją
- Import wyciągów CSV z auto-klasyfikacją
- Skanowanie paragonów (OCR)
- Automatyczne obliczenia diet dziennych (przepisy polskie)
- Snapshot podatkowy przy zamknięciu delegacji (ZUS, PIT, NFZ)
- Obsługa walut zagranicznych

## Technologie

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + TailwindCSS
- **Deploy**: Docker Compose lub YunoHost

---

## Instalacja

### Opcja A: YunoHost (zalecana)

1. Sklonuj repo i wgraj na swój GitHub:
   ```bash
   git clone https://github.com/TWOJ_USERNAME/delegacje
   cd delegacje
   # ... edytuj, commituj
   git push
   ```

2. Na serwerze YunoHost zainstaluj przez panel administracyjny lub CLI:
   ```bash
   yunohost app install https://github.com/TWOJ_USERNAME/delegacje --debug
   ```

3. Podczas instalacji podaj:
   - Domenę (np. `delegacje.twojadomena.pl`)
   - Email admina i hasło
   - AI provider (opcjonalnie: `gemini` lub `openai` do OCR)

### Opcja B: Docker Compose

1. Skopiuj `.env.example` → `.env`:
   ```bash
   cp backend/.env.example backend/.env
   # Edytuj backend/.env i ustaw JWT_SECRET, ENCRYPTION_KEY itp.
   ```

2. Uruchom:
   ```bash
   docker-compose up -d
   ```

3. Aplikacja dostępna na `http://localhost` (lub skonfigurowany port)

### Opcja C: Lokalne uruchomienie (development)

```bash
# Backend
cd backend
cp .env.example .env
# Ustaw DATABASE_URL na lokalny PostgreSQL
npm install
npx prisma migrate deploy
npm run dev

# Frontend (w osobnym terminalu)
cd frontend
cp .env.example .env.local
# Ustaw NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev
```

---

## Zmienne środowiskowe

### Backend (`backend/.env`)

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Tajny klucz JWT (min 48 znaków) | ✅ |
| `ENCRYPTION_KEY` | Klucz szyfrowania danych (32 bajty base64) | ✅ |
| `CORS_ORIGIN` | URL frontendu | ✅ |
| `AI_PROVIDER` | `none` / `gemini` / `openai` | – |
| `GEMINI_API_KEY` | Klucz Gemini (jeśli `AI_PROVIDER=gemini`) | – |

Generowanie sekretów:
```bash
# JWT_SECRET
openssl rand -base64 48

# ENCRYPTION_KEY  
openssl rand -base64 32
```

### Frontend (`frontend/.env.local`)

| Zmienna | Opis |
|---------|------|
| `NEXT_PUBLIC_API_URL` | URL backendu (np. `http://localhost:3001`) |

---

## Struktura projektu

```
delegacje/
├── backend/          # Node.js API
│   ├── src/
│   │   └── modules/  # auth, users, projects, transactions...
│   └── prisma/       # Schema i migracje bazy danych
├── frontend/         # Next.js aplikacja
│   └── app/          # Strony (App Router)
├── nginx/            # Konfiguracja reverse proxy
├── yunohost/         # YunoHost packaging
│   ├── manifest.toml
│   ├── scripts/      # install, remove, upgrade, backup, restore
│   └── conf/         # nginx.conf, *.service
└── docker-compose.yml
```

## Licencja

MIT
