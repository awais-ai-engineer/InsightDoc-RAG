# InsightDoc

InsightDoc is a private document intelligence application. Users upload PDF, TXT, or DOCX files, organize them into workspaces, and ask questions that are answered from retrieved document context with source citations.

## Architecture

```text
Next.js client → FastAPI → PostgreSQL + pgvector
                         ↘ local uploads (development)
                         ↘ OpenRouter-compatible LLM
```

The backend extracts text, creates overlapping chunks, embeds them with `sentence-transformers/all-MiniLM-L6-v2`, and stores 384-dimensional vectors in PostgreSQL. Queries use owner-scoped cosine retrieval before sending selected context to the configured provider.

## Features

- JWT signup, login, session hydration, and protected routes
- Automatic PDF, TXT, and DOCX ingestion up to 50 MB
- User-scoped documents, retrieval, chats, workspaces, and favorites
- Persistent ordered chat messages and structured citations
- Responsive Next.js dashboard, document manager, chat, history, favorites, and settings
- Alembic migrations and PostgreSQL-backed automated tests
- Preserved legacy Streamlit prototype in `app.py` and `modules/`

## Local development

Prerequisites: Python 3.11+, Node.js 20+, Docker, and Docker Compose.

Start PostgreSQL with pgvector:

```powershell
docker compose up -d db
```

Create the Python environment and install the backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item .env.example .env
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Use another terminal for the frontend:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The API defaults to `http://127.0.0.1:8000/api/v1`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection with pgvector enabled |
| `JWT_SECRET_KEY` | JWT signing secret, at least 32 bytes |
| `OPENROUTER_API_KEY` | Provider credential |
| `OPENROUTER_BASE_URL` | OpenAI-compatible provider base URL |
| `LLM_MODEL` | Provider model identifier |
| `FRONTEND_ORIGIN` | Exact browser origin allowed by CORS |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible FastAPI `/api/v1` URL |

The frontend stores the bearer token in browser local storage for this standalone architecture. A same-domain production deployment should consider secure HTTP-only cookies.

## Testing and validation

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check

cd ..\frontend
npm run lint
npx tsc --noEmit
npm run build
```

Tests mock embeddings and provider calls where appropriate. They do not make real LLM requests.

## Provider status

The OpenRouter account used during development returned HTTP 400 with an empty response, including its key endpoint. Retrieval and citation generation are independently tested and operational. Provider failures return a clean 503 response, and the frontend explains that documents and chat history remain safe.

## Production requirements

Local files under `data/uploads` are suitable for development only. Production needs durable object storage behind the existing storage service boundary, hosted PostgreSQL with pgvector, strong secrets, HTTPS, and separately hosted frontend and backend services. No cloud infrastructure is provisioned by this repository.
