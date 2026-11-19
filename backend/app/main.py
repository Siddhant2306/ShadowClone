"""FastAPI application setup and route registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from app.config import ALLOWED_ORIGINS
from app.diagnostics import TraceMiddleware, emit
from app.routes import auth, profile, memories, voice, conversations, health

app = FastAPI(title="Shadow Clone")


@app.exception_handler(OperationalError)
async def database_unavailable(request, exc):
    # Never return driver details: they can contain SQL or connection information.
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database connection unavailable. Check Supabase project status and DATABASE_URL. If the direct IPv6 connection times out, use your project's Session pooler connection."
        },
        headers={"Retry-After": "10"},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
    expose_headers=["X-Request-ID"],
)

for router in (
    auth.router,
    profile.router,
    memories.router,
    voice.router,
    conversations.router,
    health.router,
):
    app.include_router(router)

# Outermost middleware correlates every HTTP request and WebSocket session.
app.add_middleware(TraceMiddleware)
emit("app.routes.ready", routes=[getattr(route, "path", "") for route in app.routes])
