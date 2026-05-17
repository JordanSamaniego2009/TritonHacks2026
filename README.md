# Pinnical

A collaborative, real-time map app where users drop photo pins with locational data on a map. Each pin is analyzed by AI, and a built in AI assistant that lets you ask questions about what you're seeing.

Built for hackathon @ https://tritonhacks-26.devpost.com/.

---

## What it does

- Drop a pin anywhere on the map by taking a photo or uploading one from your device
- AI automatically analyzes the image which will identify the scene type, culture, weather, flora/fauna, and generate a description
- Ask the AI assistant anything about the pinned location as it has full context of the image and coordinates
- Ask for nearby services (example: "find me restaurants near here") and the app drops live map pins pulled from OpenStreetMap
- Leave comments on any pin and see other users' pins in real time

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Map | Leaflet.js |
| Backend | FastAPI (Python) |
| AI | Groq API — `meta-llama/llama-4-scout-17b-16e-instruct` |
| Location data | OpenStreetMap via Overpass API, geopy |
| Database + Auth | Supabase (Postgres + Realtime + Auth) |
| Camera | react-webcam |

---

## Prerequisites

- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/JordanSamaniego2009/TritonHacks2026.git
cd pinnical
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install fastapi uvicorn python-dotenv openai geopy httpx
```

Create a `.env` file inside `backend/`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Start the backend:

```bash
uvicorn main:app --reload
```

The backend will be running at `http://localhost:8000`. You can verify it's alive by visiting that URL as you should see `{"message": "Backend is live"}`.

### 3. Set up the frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file inside `frontend/`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the frontend in development mode:

```bash
npm run dev
```

The app will be running at `http://localhost:3000`.

---

## Supabase setup
Create the following tables in your Supabase project:

**`pins`**
| column | type |
|---|---|
| id | int8, primary key |
| created_at | timestamptz |
| user_id | text |
| user_name | text |
| image | text (base64) |
| latitude | float8 |
| longitude | float8 |
| label | text |
| note | text |
| analysis | text |

**`comments`**
| column | type |
|---|---|
| id | int8, primary key |
| created_at | timestamptz |
| pin_id | int8 (foreign key → pins.id) |
| user_id | text |
| user_name | text |
| user_avatar | text |
| content | text |

Enable **Realtime** on both tables in the Supabase dashboard (Database → Replication → enable for `pins` and `comments`).
Enable **Google OAuth** (or any provider) under Authentication → Providers in Supabase.

---

## How to use the app

1. Sign in with your Google account
2. Click the **camera icon** (bottom left of the map) to drop a pin
3. Take a photo or upload an image and the app will use your device's GPS to place the pin
4. The AI will analyze the image and auto-label the pin
5. Click any pin on the map to view its details, image, and AI analysis
6. Use **"Set as AI context"** on a pin to give the AI assistant full awareness of that location and image
7. Type in the AI chat panel on the right and ask anything about the location, or ask for nearby services like "find restaurants near here"
8. Leave comments on any pin using the left panel

---

## Team

Built at TritonHacks 2026 by Jordan Samaniego, Neil Ambalkar, Eric Choi, Rishay Singh.