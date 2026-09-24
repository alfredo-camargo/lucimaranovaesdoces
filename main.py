import os
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Response, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from weasyprint import HTML

import database as db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_active_user,
    require_admin,
    COOKIE_NAME,
)
from models import (
    DoceCreate,
    DoceUpdate,
    DoceCreatedResponse,
    KitCreate,
    KitUpdate,
    KitCreatedResponse,
    KitDetailResponse,
    ComposicaoCreate,
    ComposicaoUpdate,
    OrcamentoPayload,
    OrcamentoItem,
    OrcamentoSalvoResponse,
    OrcamentoDetalhesResponse,
    LoginRequest,
    LoginResponse,
    UserResponse,
    UserCreate,
    UserUpdate,
    PasswordChange,
    PasswordReset,
    MessageResponse,
)
from templates_engine import (
    generate_kit_html_block,
    generate_doce_html_block,
    generate_full_catalog_page,
    generate_orcamento_html,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa o banco e o admin padrão se necessário
    db.init_db()
    yield

app = FastAPI(
    title="Lucimara Novaes Doces API",
    description="Backend FastAPI seguro para gestão de doces, kits, orçamentos e usuários.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SQL_COMPOSITION = """
    SELECT c.COD_KIT, c.COD_DOCE, c.QUANTIDADE, c.DESCONTO, d.DESCRICAO as NOME_DOCE, d.PRECO 
    FROM TB_KIT_COMPOSICAO c
    JOIN TB_DOCES d ON c.COD_DOCE = d.COD_DOCE
    WHERE c.COD_KIT = ?
"""

def get_base_url(request: Request) -> str:
    """Extrai a URL base respeitando proxies reversos como Cloudflare Tunnel."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    return f"{proto}://{host}"

# ==========================================
# ROTAS DE AUTENTICAÇÃO
# ==========================================

@app.post("/auth/login", response_model=LoginResponse)
def login(login_data: LoginRequest, request: Request, response: Response):
    user = db.fetch_one(
        "SELECT COD_USUARIO, USERNAME, NOME, SENHA_HASH, IS_ADMIN, ATIVO FROM TB_USUARIOS WHERE LOWER(USERNAME) = LOWER(?)",
        (login_data.username.strip(),)
    )
    if not user or not verify_password(login_data.password, user["SENHA_HASH"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos."
        )

    if not user["ATIVO"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado. Contate o administrador."
        )

    # O claim 'sub' no padrão JWT (RFC 7519) deve ser string
    token = create_access_token({"sub": str(user["COD_USUARIO"]), "username": user["USERNAME"]})
    is_secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=is_secure,
        path="/"
    )

    user_info = {
        "COD_USUARIO": user["COD_USUARIO"],
        "USERNAME": user["USERNAME"],
        "NOME": user["NOME"],
        "IS_ADMIN": user["IS_ADMIN"],
        "ATIVO": user["ATIVO"],
    }
    return {
        "message": "Login realizado com sucesso",
        "user": user_info,
        "access_token": token,
        "token_type": "bearer",
    }

@app.post("/auth/logout", response_model=MessageResponse)
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax")
    return {"message": "Logout realizado com sucesso"}

@app.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_active_user)):
    return user

@app.post("/auth/alterar-senha", response_model=MessageResponse)
def alterar_senha(body: PasswordChange, current_user: Dict[str, Any] = Depends(get_current_active_user)):
    user_db = db.fetch_one("SELECT SENHA_HASH FROM TB_USUARIOS WHERE COD_USUARIO = ?", (current_user["COD_USUARIO"],))
    if not user_db or not verify_password(body.current_password, user_db["SENHA_HASH"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta.")

    nova_hash = hash_password(body.new_password)
    db.execute_query("UPDATE TB_USUARIOS SET SENHA_HASH = ? WHERE COD_USUARIO = ?", (nova_hash, current_user["COD_USUARIO"]))
    return {"message": "Senha alterada com sucesso!"}

# ==========================================
# ROTAS DE ADMINISTRAÇÃO DE USUÁRIOS
# ==========================================

@app.get("/admin/usuarios", response_model=List[UserResponse])
def listar_usuarios(admin: Dict[str, Any] = Depends(require_admin)):
    return db.fetch_all("SELECT COD_USUARIO, USERNAME, NOME, IS_ADMIN, ATIVO, CRIADO_EM FROM TB_USUARIOS ORDER BY NOME")

@app.post("/admin/usuarios", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def criar_usuario(user_in: UserCreate, admin: Dict[str, Any] = Depends(require_admin)):
    existente = db.fetch_one("SELECT COD_USUARIO FROM TB_USUARIOS WHERE USERNAME = ?", (user_in.username.strip(),))
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome de usuário já cadastrado.")

    senha_hash = hash_password(user_in.password)
    new_id = db.execute_insert(
        "INSERT INTO TB_USUARIOS (USERNAME, NOME, SENHA_HASH, IS_ADMIN, ATIVO) VALUES (?, ?, ?, ?, 1)",
        (user_in.username.strip(), user_in.nome.strip(), senha_hash, 1 if user_in.is_admin else 0)
    )
    user_created = db.fetch_one("SELECT COD_USUARIO, USERNAME, NOME, IS_ADMIN, ATIVO, CRIADO_EM FROM TB_USUARIOS WHERE COD_USUARIO = ?", (new_id,))
    return user_created

@app.put("/admin/usuarios/{id}", response_model=MessageResponse)
def atualizar_usuario(id: int, user_in: UserUpdate, admin: Dict[str, Any] = Depends(require_admin)):
    target = db.fetch_one("SELECT COD_USUARIO, IS_ADMIN FROM TB_USUARIOS WHERE COD_USUARIO = ?", (id,))
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Se for remover privilégios de admin do próprio usuário ou desativar o último admin
    if target["IS_ADMIN"] and not user_in.is_admin:
        admin_count = db.fetch_one("SELECT COUNT(*) as count FROM TB_USUARIOS WHERE IS_ADMIN = 1 AND ATIVO = 1")["count"]
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Não é possível remover o último administrador ativo do sistema.")

    db.execute_query(
        "UPDATE TB_USUARIOS SET NOME = ?, IS_ADMIN = ?, ATIVO = ? WHERE COD_USUARIO = ?",
        (user_in.nome.strip(), 1 if user_in.is_admin else 0, 1 if user_in.ativo else 0, id)
    )
    return {"message": "Usuário atualizado com sucesso"}

@app.put("/admin/usuarios/{id}/reset-senha", response_model=MessageResponse)
def resetar_senha_usuario(id: int, body: PasswordReset, admin: Dict[str, Any] = Depends(require_admin)):
    target = db.fetch_one("SELECT COD_USUARIO FROM TB_USUARIOS WHERE COD_USUARIO = ?", (id,))
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    nova_hash = hash_password(body.new_password)
    db.execute_query("UPDATE TB_USUARIOS SET SENHA_HASH = ? WHERE COD_USUARIO = ?", (nova_hash, id))
    return {"message": "Senha do usuário redefinida com sucesso"}

@app.delete("/admin/usuarios/{id}", response_model=MessageResponse)
def deletar_usuario(id: int, admin: Dict[str, Any] = Depends(require_admin)):
    if id == admin["COD_USUARIO"]:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta.")

    target = db.fetch_one("SELECT COD_USUARIO, IS_ADMIN FROM TB_USUARIOS WHERE COD_USUARIO = ?", (id,))
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if target["IS_ADMIN"]:
        admin_count = db.fetch_one("SELECT COUNT(*) as count FROM TB_USUARIOS WHERE IS_ADMIN = 1")["count"]
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Não é possível excluir o único administrador do sistema.")

    db.execute_query("DELETE FROM TB_USUARIOS WHERE COD_USUARIO = ?", (id,))
    return {"message": "Usuário excluído com sucesso"}

# ==========================================
# ROTAS PARA DOCES (TB_DOCES)
# ==========================================

@app.post("/doces", response_model=DoceCreatedResponse, status_code=status.HTTP_201_CREATED)
def criar_doce(doce: DoceCreate, user: Dict[str, Any] = Depends(get_current_active_user)):
    new_id = db.execute_insert(
        "INSERT INTO TB_DOCES (DESCRICAO, PRECO) VALUES (?, ?)",
        (doce.descricao, doce.preco),
    )
    return {"id": new_id, "descricao": doce.descricao, "preco": doce.preco}

@app.get("/doces")
def listar_doces(user: Dict[str, Any] = Depends(get_current_active_user)):
    return db.fetch_all("SELECT COD_DOCE, DESCRICAO, PRECO FROM TB_DOCES ORDER BY DESCRICAO")

@app.put("/doces/{id}", response_model=MessageResponse)
def atualizar_doce(id: int, doce: DoceUpdate, user: Dict[str, Any] = Depends(get_current_active_user)):
    affected = db.execute_query(
        "UPDATE TB_DOCES SET DESCRICAO = ?, PRECO = ? WHERE COD_DOCE = ?",
        (doce.descricao, doce.preco, id),
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Doce não encontrado.")
    return {"message": "Doce atualizado com sucesso"}

@app.delete("/doces/{id}", response_model=MessageResponse)
def deletar_doce(id: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    db.execute_query("DELETE FROM TB_KIT_COMPOSICAO WHERE COD_DOCE = ?", (id,))
    affected = db.execute_query("DELETE FROM TB_DOCES WHERE COD_DOCE = ?", (id,))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Doce não encontrado.")
    return {"message": "Doce deletado"}

@app.get("/doces/standalone")
def listar_doces_standalone(user: Dict[str, Any] = Depends(get_current_active_user)):
    query = """
        SELECT COD_DOCE, DESCRICAO, PRECO
        FROM TB_DOCES
        WHERE COD_DOCE NOT IN (SELECT DISTINCT COD_DOCE FROM TB_KIT_COMPOSICAO)
        ORDER BY DESCRICAO
    """
    return db.fetch_all(query)

# ==========================================
# ROTAS PARA KITS (TB_KITS)
# ==========================================

@app.post("/kits", response_model=KitCreatedResponse, status_code=status.HTTP_201_CREATED)
def criar_kit(kit: KitCreate, user: Dict[str, Any] = Depends(get_current_active_user)):
    new_id = db.execute_insert(
        "INSERT INTO TB_KITS (DESCRICAO) VALUES (?)",
        (kit.descricao,),
    )
    return {"id": new_id, "descricao": kit.descricao}

@app.get("/kits")
def listar_kits(user: Dict[str, Any] = Depends(get_current_active_user)):
    return db.fetch_all("SELECT COD_KIT, DESCRICAO FROM TB_KITS ORDER BY DESCRICAO")

@app.put("/kits/{id}", response_model=MessageResponse)
def atualizar_kit(id: int, kit: KitUpdate, user: Dict[str, Any] = Depends(get_current_active_user)):
    affected = db.execute_query(
        "UPDATE TB_KITS SET DESCRICAO = ? WHERE COD_KIT = ?",
        (kit.descricao, id),
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Kit não encontrado.")
    return {"message": "Kit atualizado"}

@app.delete("/kits/{id}", response_model=MessageResponse)
def deletar_kit(id: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    db.execute_query("DELETE FROM TB_KIT_COMPOSICAO WHERE COD_KIT = ?", (id,))
    affected = db.execute_query("DELETE FROM TB_KITS WHERE COD_KIT = ?", (id,))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Kit não encontrado.")
    return {"message": "Kit e suas composições deletados"}

@app.get("/kit/{id}/details", response_model=KitDetailResponse)
def obter_detalhes_kit(id: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    kit = db.fetch_one("SELECT COD_KIT, DESCRICAO FROM TB_KITS WHERE COD_KIT = ?", (id,))
    if not kit:
        raise HTTPException(status_code=404, detail="Kit não encontrado.")

    composition = db.fetch_all(SQL_COMPOSITION, (id,))
    preco_total = 0.0
    for item in composition:
        preco = float(item["PRECO"])
        desconto = float(item["DESCONTO"])
        qtd = float(item["QUANTIDADE"])
        preco_total += (preco - preco * (desconto / 100.0)) * qtd

    return {**kit, "PRECO_TOTAL": preco_total}

# ==========================================
# ROTAS PARA COMPOSIÇÃO DO KIT
# ==========================================

@app.get("/composicao/{cod_kit}")
def listar_composicao(cod_kit: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    return db.fetch_all(SQL_COMPOSITION, (cod_kit,))

@app.post("/composicao", response_model=MessageResponse)
def adicionar_item_composicao(item: ComposicaoCreate, user: Dict[str, Any] = Depends(get_current_active_user)):
    db.execute_insert(
        "INSERT INTO TB_KIT_COMPOSICAO (COD_KIT, COD_DOCE, QUANTIDADE, DESCONTO) VALUES (?, ?, ?, ?)",
        (item.cod_kit, item.cod_doce, item.quantidade, item.desconto or 0.0),
    )
    return {"message": "Item adicionado ao kit"}

@app.put("/composicao/{cod_kit}/{cod_doce}", response_model=MessageResponse)
def atualizar_desconto_composicao(cod_kit: int, cod_doce: int, body: ComposicaoUpdate, user: Dict[str, Any] = Depends(get_current_active_user)):
    affected = db.execute_query(
        "UPDATE TB_KIT_COMPOSICAO SET DESCONTO = ? WHERE COD_KIT = ? AND COD_DOCE = ?",
        (body.desconto, cod_kit, cod_doce),
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item da composição não encontrado.")
    return {"message": "Desconto atualizado com sucesso"}

@app.delete("/composicao/{cod_kit}/{cod_doce}", response_model=MessageResponse)
def remover_item_composicao(cod_kit: int, cod_doce: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    affected = db.execute_query(
        "DELETE FROM TB_KIT_COMPOSICAO WHERE COD_KIT = ? AND COD_DOCE = ?",
        (cod_kit, cod_doce),
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item da composição não encontrado.")
    return {"message": "Item removido do kit"}

# ==========================================
# ROTAS PARA CATÁLOGO
# ==========================================

def render_catalog_html(request: Request, kit_ids_param: Optional[str] = None, doce_ids_param: Optional[str] = None) -> str:
    kits = []
    doces = []
    kits_html = ""
    doces_html = ""

    # Processar Kits
    if kit_ids_param:
        if kit_ids_param == "all":
            kits = db.fetch_all("SELECT COD_KIT, DESCRICAO FROM TB_KITS ORDER BY DESCRICAO")
        else:
            ids = [int(x.strip()) for x in kit_ids_param.split(",") if x.strip().isdigit()]
            if ids:
                placeholders = ",".join("?" for _ in ids)
                kits = db.fetch_all(f"SELECT COD_KIT, DESCRICAO FROM TB_KITS WHERE COD_KIT IN ({placeholders})", tuple(ids))

        for k in kits:
            composition = db.fetch_all(SQL_COMPOSITION, (k["COD_KIT"],))
            kit_block = generate_kit_html_block(k, composition)
            kits_html += f'<div class="kit-item">{kit_block}</div>'

    # Processar Doces
    if doce_ids_param:
        ids = [int(x.strip()) for x in doce_ids_param.split(",") if x.strip().isdigit()]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            doces = db.fetch_all(f"SELECT COD_DOCE, DESCRICAO, PRECO FROM TB_DOCES WHERE COD_DOCE IN ({placeholders})", tuple(ids))

        for d in doces:
            doces_html += generate_doce_html_block(d)

    if not kits and not doces:
        raise HTTPException(status_code=400, detail="Nenhum kit ou doce foi selecionado para o catálogo.")

    content = ""
    if kits_html:
        content += f'<div class="catalog-section"><h2>Nossos Kits</h2><div class="kits-grid">{kits_html}</div></div>'
    if doces_html:
        content += f'<div class="catalog-section"><h2>Doces Individuais</h2><div class="doces-grid">{doces_html}</div></div>'

    return generate_full_catalog_page(content, get_base_url(request))

@app.get("/catalog/visualizacao", response_class=HTMLResponse)
def visualizar_catalogo(request: Request, kitIds: Optional[str] = None, doceIds: Optional[str] = None):
    return HTMLResponse(content=render_catalog_html(request, kitIds, doceIds))

@app.get("/catalog/pdf")
def gerar_pdf_catalogo(request: Request, kitIds: Optional[str] = None, doceIds: Optional[str] = None):
    if not kitIds and not doceIds:
        raise HTTPException(status_code=400, detail="Nenhum ID de kit ou doce foi fornecido.")

    html_content = render_catalog_html(request, kitIds, doceIds)

    if kitIds == "all" and not doceIds:
        filename = "catalogo_todos_kits.pdf"
    elif not kitIds and doceIds:
        filename = "catalogo_doces_selecionados.pdf"
    else:
        filename = "catalogo_personalizado.pdf"

    pdf_bytes = HTML(string=html_content, base_url=get_base_url(request)).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/kits/{id}/visualizacao", response_class=HTMLResponse)
def visualizar_kit_individual(request: Request, id: int):
    return HTMLResponse(content=render_catalog_html(request, kit_ids_param=str(id)))

@app.get("/kits/{id}/pdf")
def gerar_pdf_kit_individual(request: Request, id: int):
    html_content = render_catalog_html(request, kit_ids_param=str(id))
    pdf_bytes = HTML(string=html_content, base_url=get_base_url(request)).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="kit_{id}.pdf"'},
    )

# ==========================================
# ROTAS PARA ORÇAMENTO (GERAÇÃO & PERSISTÊNCIA)
# ==========================================

@app.post("/orcamento/visualizacao", response_class=HTMLResponse)
def visualizar_orcamento(request: Request, payload: OrcamentoPayload):
    html_content = generate_orcamento_html(payload, get_base_url(request))
    return HTMLResponse(content=html_content)

@app.post("/orcamento/pdf")
def gerar_pdf_orcamento(request: Request, payload: OrcamentoPayload):
    html_content = generate_orcamento_html(payload, get_base_url(request))
    pdf_bytes = HTML(string=html_content, base_url=get_base_url(request)).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="orcamento.pdf"'},
    )

@app.post("/orcamento/salvar")
def salvar_orcamento(
    payload: OrcamentoPayload,
    user: Dict[str, Any] = Depends(get_current_active_user)
):
    """Salva o orçamento e seus itens no banco de dados SQLite."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="O orçamento não possui nenhum item.")

    orcamento_id = db.execute_insert(
        """
        INSERT INTO TB_ORCAMENTOS (
            CLIENTE, VALIDADE, OBSERVACOES, SUBTOTAL, DESCONTO_GERAL,
            TOTAL_COM_DESCONTO, FRETE, TOTAL_FINAL, COD_USUARIO
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.cliente or "",
            payload.validade or "",
            payload.observacoes or "",
            payload.subTotal,
            payload.descontoGeral,
            payload.totalComDesconto,
            payload.frete,
            payload.totalFinal,
            user["COD_USUARIO"]
        )
    )

    for item in payload.items:
        db.execute_insert(
            """
            INSERT INTO TB_ORCAMENTO_ITENS (
                COD_ORCAMENTO, TIPO, ID_ORIGEM, NOME, QUANTIDADE, PRECO_UNITARIO, SUBTOTAL
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                orcamento_id,
                item.tipo or "item",
                item.id,
                item.nome,
                item.quantidade,
                item.precoUnitario,
                item.subtotal
            )
        )

    return {"COD_ORCAMENTO": orcamento_id, "message": f"Orçamento #{orcamento_id} gravado com sucesso!"}

@app.get("/orcamentos", response_model=List[OrcamentoSalvoResponse])
def listar_orcamentos_salvos(user: Dict[str, Any] = Depends(get_current_active_user)):
    """Retorna a lista de orçamentos gravados."""
    query = """
        SELECT o.COD_ORCAMENTO, o.CLIENTE, o.VALIDADE, o.OBSERVACOES, o.SUBTOTAL,
               o.DESCONTO_GERAL, o.TOTAL_COM_DESCONTO, o.FRETE, o.TOTAL_FINAL,
               o.CRIADO_EM, o.COD_USUARIO, u.NOME as CRIADO_POR_NOME
        FROM TB_ORCAMENTOS o
        LEFT JOIN TB_USUARIOS u ON o.COD_USUARIO = u.COD_USUARIO
        ORDER BY o.COD_ORCAMENTO DESC
    """
    return db.fetch_all(query)

@app.get("/orcamentos/{id}", response_model=OrcamentoDetalhesResponse)
def obter_orcamento_salvo(id: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    """Retorna detalhes e itens de um orçamento gravado."""
    orcamento = db.fetch_one(
        """
        SELECT o.COD_ORCAMENTO, o.CLIENTE, o.VALIDADE, o.OBSERVACOES, o.SUBTOTAL,
               o.DESCONTO_GERAL, o.TOTAL_COM_DESCONTO, o.FRETE, o.TOTAL_FINAL,
               o.CRIADO_EM, o.COD_USUARIO, u.NOME as CRIADO_POR_NOME
        FROM TB_ORCAMENTOS o
        LEFT JOIN TB_USUARIOS u ON o.COD_USUARIO = u.COD_USUARIO
        WHERE o.COD_ORCAMENTO = ?
        """,
        (id,)
    )
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")

    itens_db = db.fetch_all(
        """
        SELECT COD_ITEM, COD_ORCAMENTO, TIPO, ID_ORIGEM, NOME, QUANTIDADE, PRECO_UNITARIO, SUBTOTAL
        FROM TB_ORCAMENTO_ITENS
        WHERE COD_ORCAMENTO = ?
        """,
        (id,)
    )

    items = [
        OrcamentoItem(
            id=i["ID_ORIGEM"],
            nome=i["NOME"],
            tipo=i["TIPO"],
            quantidade=float(i["QUANTIDADE"]),
            precoUnitario=float(i["PRECO_UNITARIO"]),
            subtotal=float(i["SUBTOTAL"])
        )
        for i in itens_db
    ]

    return {**orcamento, "items": items}

@app.delete("/orcamentos/{id}", response_model=MessageResponse)
def excluir_orcamento_salvo(id: int, user: Dict[str, Any] = Depends(get_current_active_user)):
    db.execute_query("DELETE FROM TB_ORCAMENTO_ITENS WHERE COD_ORCAMENTO = ?", (id,))
    affected = db.execute_query("DELETE FROM TB_ORCAMENTOS WHERE COD_ORCAMENTO = ?", (id,))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    return {"message": "Orçamento excluído com sucesso"}

def _build_payload_from_db(id: int) -> OrcamentoPayload:
    orcamento = db.fetch_one("SELECT * FROM TB_ORCAMENTOS WHERE COD_ORCAMENTO = ?", (id,))
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")

    itens_db = db.fetch_all("SELECT * FROM TB_ORCAMENTO_ITENS WHERE COD_ORCAMENTO = ?", (id,))
    items = [
        OrcamentoItem(
            id=i["ID_ORIGEM"],
            nome=i["NOME"],
            tipo=i["TIPO"],
            quantidade=float(i["QUANTIDADE"]),
            precoUnitario=float(i["PRECO_UNITARIO"]),
            subtotal=float(i["SUBTOTAL"])
        )
        for i in itens_db
    ]

    return OrcamentoPayload(
        items=items,
        subTotal=float(orcamento["SUBTOTAL"]),
        descontoGeral=float(orcamento["DESCONTO_GERAL"]),
        totalComDesconto=float(orcamento["TOTAL_COM_DESCONTO"]),
        frete=float(orcamento["FRETE"]),
        totalFinal=float(orcamento["TOTAL_FINAL"]),
        cliente=orcamento["CLIENTE"] or "",
        validade=orcamento["VALIDADE"] or "",
        observacoes=orcamento["OBSERVACOES"] or ""
    )

@app.get("/orcamentos/{id}/visualizacao", response_class=HTMLResponse)
def visualizar_orcamento_salvo(request: Request, id: int):
    payload = _build_payload_from_db(id)
    html_content = generate_orcamento_html(payload, get_base_url(request))
    return HTMLResponse(content=html_content)

@app.get("/orcamentos/{id}/pdf")
def gerar_pdf_orcamento_salvo(request: Request, id: int):
    payload = _build_payload_from_db(id)
    html_content = generate_orcamento_html(payload, get_base_url(request))
    pdf_bytes = HTML(string=html_content, base_url=get_base_url(request)).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="orcamento_{id}.pdf"'},
    )

# ==========================================
# ARQUIVOS ESTÁTICOS & PÁGINA INICIAL
# ==========================================

@app.api_route("/", methods=["GET", "HEAD"])
def index():
    return FileResponse("index.html")

@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def favicon():
    fav_path = os.path.join(os.path.dirname(__file__), "favicon.ico")
    if os.path.exists(fav_path):
        return FileResponse(fav_path)
    return Response(status_code=204)

@app.api_route("/{filename}", methods=["GET", "HEAD"])
def static_file(filename: str):
    allowed_files = {"style.css", "app.js", "logo.png", "index.html"}
    if filename in allowed_files:
        file_path = os.path.join(os.path.dirname(__file__), filename)
        if os.path.exists(file_path):
            return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
