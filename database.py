import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, List, Optional, Dict

DB_PATH = Path(os.getenv("DB_PATH", Path(__file__).resolve().parent / "data" / "banco.sqlite"))

def get_db_connection() -> sqlite3.Connection:
    """Cria e retorna uma conexão com o banco de dados SQLite."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

@contextmanager
def get_db():
    """Gerenciador de contexto para conexão com o banco de dados."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Inicializa as tabelas se não existirem e garante a criação do admin inicial."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_DOCES (
                COD_DOCE INTEGER PRIMARY KEY AUTOINCREMENT,
                DESCRICAO varchar,
                PRECO float
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_KITS (
                COD_KIT INTEGER PRIMARY KEY AUTOINCREMENT,
                DESCRICAO varchar
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_KIT_COMPOSICAO (
                COD_KIT numeric,
                COD_DOCE numeric,
                QUANTIDADE numeric,
                DESCONTO float
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_USUARIOS (
                COD_USUARIO INTEGER PRIMARY KEY AUTOINCREMENT,
                USERNAME TEXT UNIQUE NOT NULL,
                NOME TEXT NOT NULL,
                SENHA_HASH TEXT NOT NULL,
                IS_ADMIN INTEGER DEFAULT 0,
                ATIVO INTEGER DEFAULT 1,
                CRIADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_ORCAMENTOS (
                COD_ORCAMENTO INTEGER PRIMARY KEY AUTOINCREMENT,
                CLIENTE TEXT,
                VALIDADE TEXT,
                OBSERVACOES TEXT,
                SUBTOTAL REAL NOT NULL,
                DESCONTO_GERAL REAL DEFAULT 0,
                TOTAL_COM_DESCONTO REAL NOT NULL,
                FRETE REAL DEFAULT 0,
                TOTAL_FINAL REAL NOT NULL,
                CRIADO_EM DATETIME DEFAULT CURRENT_TIMESTAMP,
                COD_USUARIO INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TB_ORCAMENTO_ITENS (
                COD_ITEM INTEGER PRIMARY KEY AUTOINCREMENT,
                COD_ORCAMENTO INTEGER NOT NULL,
                TIPO TEXT,
                ID_ORIGEM INTEGER,
                NOME TEXT NOT NULL,
                QUANTIDADE REAL NOT NULL,
                PRECO_UNITARIO REAL NOT NULL,
                SUBTOTAL REAL NOT NULL,
                FOREIGN KEY (COD_ORCAMENTO) REFERENCES TB_ORCAMENTOS (COD_ORCAMENTO) ON DELETE CASCADE
            )
        """)

        # Cria admin inicial se não houver usuários cadastrados
        cursor.execute("SELECT COUNT(*) FROM TB_USUARIOS")
        if cursor.fetchone()[0] == 0:
            from auth import hash_password
            initial_password = os.getenv("ADMIN_INITIAL_PASSWORD", "admin123")
            senha_hash = hash_password(initial_password)
            cursor.execute(
                "INSERT INTO TB_USUARIOS (USERNAME, NOME, SENHA_HASH, IS_ADMIN, ATIVO) VALUES (?, ?, ?, 1, 1)",
                ("admin", "Administrador", senha_hash)
            )
            print(">>> Usuário administrador inicial 'admin' criado com sucesso!")

def fetch_all(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Executa uma query SELECT e retorna todas as linhas como dicionários."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def fetch_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """Executa uma query SELECT e retorna uma linha como dicionário, ou None."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

def execute_insert(query: str, params: tuple = ()) -> int:
    """Executa um INSERT e retorna o ID da linha inserida (lastrowid)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.lastrowid

def execute_query(query: str, params: tuple = ()) -> int:
    """Executa UPDATE/DELETE e retorna a quantidade de linhas afetadas."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.rowcount
