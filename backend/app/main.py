from fastapi import FastAPI

app = FastAPI(
    title="InsightDoc API",
    version="0.1.0",
    description="Production API for InsightDoc document intelligence and RAG workflows.",
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "insightdoc-api"}
