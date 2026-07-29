from fastapi import FastAPI

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


@app.get("/api/health")
def healthcheck():
    return {
        "status": "ok",
        "service": "openbcon-python-backend",
        "model": settings.openai_model if not settings.use_mock_llm else "mock",
    }


app.include_router(router)
