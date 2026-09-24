from typing import List, Optional
from pydantic import BaseModel, Field

# --- Modelos para Doces ---

class DoceCreate(BaseModel):
    descricao: str = Field(..., min_length=1)
    preco: float

class DoceUpdate(BaseModel):
    descricao: str = Field(..., min_length=1)
    preco: float

class DoceResponse(BaseModel):
    COD_DOCE: int
    DESCRICAO: str
    PRECO: float

class DoceCreatedResponse(BaseModel):
    id: int
    descricao: str
    preco: float

# --- Modelos para Kits ---

class KitCreate(BaseModel):
    descricao: str = Field(..., min_length=1)

class KitUpdate(BaseModel):
    descricao: str = Field(..., min_length=1)

class KitResponse(BaseModel):
    COD_KIT: int
    DESCRICAO: str

class KitCreatedResponse(BaseModel):
    id: int
    descricao: str

class KitDetailResponse(BaseModel):
    COD_KIT: int
    DESCRICAO: str
    PRECO_TOTAL: float

# --- Modelos para Composição do Kit ---

class ComposicaoItem(BaseModel):
    COD_KIT: int
    COD_DOCE: int
    QUANTIDADE: float
    DESCONTO: float
    NOME_DOCE: str
    PRECO: float

class ComposicaoCreate(BaseModel):
    cod_kit: int
    cod_doce: int
    quantidade: float
    desconto: Optional[float] = 0.0

class ComposicaoUpdate(BaseModel):
    desconto: float

# --- Modelos para Orçamento ---

class OrcamentoItem(BaseModel):
    id: Optional[int] = None
    nome: str
    tipo: Optional[str] = None
    quantidade: float
    precoUnitario: float
    subtotal: float

class OrcamentoPayload(BaseModel):
    items: List[OrcamentoItem] = []
    subTotal: float = 0.0
    descontoGeral: float = 0.0
    totalComDesconto: float = 0.0
    frete: float = 0.0
    totalFinal: float = 0.0
    cliente: Optional[str] = ""
    validade: Optional[str] = ""
    observacoes: Optional[str] = ""

# --- Modelos para Autenticação e Usuários ---

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class UserResponse(BaseModel):
    COD_USUARIO: int
    USERNAME: str
    NOME: str
    IS_ADMIN: int
    ATIVO: int
    CRIADO_EM: Optional[str] = None

class LoginResponse(BaseModel):
    message: str
    user: UserResponse
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3)
    nome: str = Field(..., min_length=1)
    password: str = Field(..., min_length=4)
    is_admin: bool = False

class UserUpdate(BaseModel):
    nome: str = Field(..., min_length=1)
    is_admin: bool = False
    ativo: bool = True

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4)

class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=4)

# --- Modelos para Orçamento Salvo ---

class OrcamentoSalvoResponse(BaseModel):
    COD_ORCAMENTO: int
    CLIENTE: Optional[str] = None
    VALIDADE: Optional[str] = None
    OBSERVACOES: Optional[str] = None
    SUBTOTAL: float
    DESCONTO_GERAL: float
    TOTAL_COM_DESCONTO: float
    FRETE: float
    TOTAL_FINAL: float
    CRIADO_EM: str
    COD_USUARIO: Optional[int] = None
    CRIADO_POR_NOME: Optional[str] = None

class OrcamentoDetalhesResponse(OrcamentoSalvoResponse):
    items: List[OrcamentoItem] = []

# --- Modelos Genéricos ---

class MessageResponse(BaseModel):
    message: str
