from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def register_error_handlers(app: FastAPI) -> None:
    """Register safe, non-leaking global exception handlers."""

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected internal error occurred."},
        )
