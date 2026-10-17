"""One error format for the whole API.

Every error response has this shape:
    {"error": {"code": "not_found", "message": "Service not found.", "fields": {}}}

`fields` is filled in for invalid input, keyed by the JSON field name:
    {"error": {"code": "validation_error", "message": "...", "fields": {"expectedDuration": "..."}}}
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
}
LOCATIONS = {"body", "query", "path", "header", "cookie"}


class ApiError(Exception):
    """Raise from a route, dependency or logic function to send an error response.

        raise ApiError(404, "not_found", "Service not found.")
        raise ApiError(409, "email_taken", "That email is already registered.", {"email": "Already registered."})
    """

    def __init__(self, status: int, code: str, message: str, fields: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}


def error_response(status: int, code: str, message: str, fields: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "fields": fields or {}}},
    )


def _field_name(loc: tuple) -> str:
    # Pydantic reports where a problem is as ("body", "expectedDuration"). Drop the "body" part.
    parts = loc[1:] if loc and loc[0] in LOCATIONS else loc
    return ".".join(str(part) for part in parts) or str(loc[0])


async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status, exc.code, exc.message, exc.fields)


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, str] = {}
    for error in exc.errors():
        message = error["msg"].removeprefix("Value error, ")  # prefix added by custom validators
        fields.setdefault(_field_name(error["loc"]), message)  # keep the first problem per field
    return error_response(422, "validation_error", "Some fields are invalid.", fields)


async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # FastAPI's own errors, like 404 for an unknown path or 405 for the wrong method.
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return error_response(exc.status_code, CODES.get(exc.status_code, "error"), message)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, handle_api_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)
