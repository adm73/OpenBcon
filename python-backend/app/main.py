from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .router import router

settings = get_settings()

app = FastAPI(
    title="OpenBcon Business Plan Backend",
    version="0.1.0",
    description=(
        "Python + LangGraph backend for reading funding program and company data "
        "from PostgreSQL and generating funding-ready business plans."
    ),
)

allowed_origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def healthcheck():
    return {
        "status": "ok",
        "service": "openbcon-python-backend",
        "model": settings.openai_model if not settings.use_mock_llm else "mock",
    }


app.include_router(router)
