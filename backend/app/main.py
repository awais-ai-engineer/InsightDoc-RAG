from fastapi import FastAPI

from .api.v1.auth import router as auth_router
from .api.v1.documents import router as documents_router


app = FastAPI(
    title="InsightDoc API",
    version="0.1.0",
    description="Production API for InsightDoc document intelligence and RAG workflows.",
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "insightdoc-api"}
