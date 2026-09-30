from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings

from .api.v1.auth import router as auth_router
from .api.v1.chat import router as chat_router
from .api.v1.chats import router as chats_router
from .api.v1.documents import router as documents_router
from .api.v1.workspaces import router as workspaces_router


app = FastAPI(
    title="InsightDoc API",
    version="0.1.0",
    description="Production API for InsightDoc document intelligence and RAG workflows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(chats_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "insightdoc-api"}
