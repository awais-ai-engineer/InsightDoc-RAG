# InsightDoc frontend

Next.js App Router interface for the InsightDoc FastAPI backend.

Copy `.env.example` to `.env.local`, then run:

```bash
npm install
npm run dev
```

The bearer token is stored in browser local storage for this standalone client. This keeps local development simple, but an HTTP-only cookie architecture is preferable when frontend and backend share a production domain.
