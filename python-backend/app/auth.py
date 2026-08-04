from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256

from fastapi import HTTPException, Request, status
from psycopg import Connection

from .config import get_settings

AUTH_SESSION_COOKIE = "bconomics_session"


@dataclass(frozen=True)
class AuthContext:
    user_id: int
    workspace_id: str
    role: str


def _hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def require_authenticated(request: Request, connection: Connection) -> AuthContext:
    token = request.cookies.get(AUTH_SESSION_COOKIE)
    if not token:
        settings = get_settings()
        if settings.runtime_env != "production":
            return AuthContext(
                user_id=settings.demo_user_id,
                workspace_id=settings.demo_workspace_id,
                role="admin",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid authenticated session is required.",
        )

    row = connection.execute(
        """
        SELECT sessions.user_id, sessions.workspace_id, members.role
        FROM auth_sessions AS sessions
        JOIN app_users AS users
          ON users.id = sessions.user_id
        JOIN workspace_members AS members
          ON members.workspace_id = sessions.workspace_id
         AND members.user_id = sessions.user_id
        JOIN workspaces
          ON workspaces.id = sessions.workspace_id
        WHERE sessions.token_hash = %s
          AND sessions.expires_at > now()
          AND users.status = 'active'
          AND workspaces.status = 'active'
        LIMIT 1
        """,
        (_hash_token(token),),
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The authenticated session is invalid or expired.",
        )

    connection.execute(
        "UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = %s",
        (_hash_token(token),),
    )
    return AuthContext(
        user_id=int(row["user_id"]),
        workspace_id=str(row["workspace_id"]),
        role=str(row["role"]),
    )


def require_application_access(
    request: Request,
    connection: Connection,
    app_id: str,
) -> AuthContext:
    context = require_authenticated(request, connection)
    application = connection.execute(
        """
        SELECT 1
        FROM applications
        WHERE workspace_id = %s
          AND (
            app_id = %s
            OR id::text = %s
            OR source_id = %s
          )
        LIMIT 1
        """,
        (context.workspace_id, app_id, app_id, app_id),
    ).fetchone()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {app_id} was not found.",
        )
    return context
