import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import Request, HTTPException, status, Depends
import database as db

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "lucimara-novaes-doces-secret-key-change-in-prod-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "7"))
COOKIE_NAME = "access_token"

def hash_password(password: str) -> str:
    """Gera o hash seguro da senha com bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha plana corresponde ao hash armazenado."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Cria um token JWT assinado."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Tenta obter o usuário atual sem disparar exceção se não estiver logado."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        # O claim 'sub' em JWT deve ser string segundo a RFC 7519, convertemos para int na busca do SQLite
        db_user_id = int(user_id) if str(user_id).isdigit() else user_id
        user = db.fetch_one(
            "SELECT COD_USUARIO, USERNAME, NOME, IS_ADMIN, ATIVO FROM TB_USUARIOS WHERE COD_USUARIO = ?",
            (db_user_id,)
        )
        return user
    except jwt.PyJWTError:
        return None
    except Exception:
        return None

async def get_current_user(request: Request) -> Dict[str, Any]:
    """Obtém o usuário atual autenticado via Cookie HttpOnly ou Bearer Token."""
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado. Por favor, faça login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_active_user(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Valida se o usuário autenticado está ativo."""
    if not user.get("ATIVO", 1):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Contate o administrador.",
        )
    return user

async def require_admin(user: Dict[str, Any] = Depends(get_current_active_user)) -> Dict[str, Any]:
    """Exige privilégios de administrador."""
    if not user.get("IS_ADMIN", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito para administradores.",
        )
    return user
