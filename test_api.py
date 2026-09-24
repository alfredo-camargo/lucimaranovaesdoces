"""
Testes de integração completos para a API Lucimara Novaes Doces.
Usa o token JWT via header Authorization: Bearer para contornar
limitações do cookie HttpOnly em requests de IP local (127.0.0.1).
"""
import os
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:3000")


def make_session(username, password):
    """Faz login e retorna uma sessão autenticada via Bearer token."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    if r.status_code != 200:
        return None, r.status_code, r.json()
    data = r.json()
    token = data.get("access_token")
    if not token:
        set_cookie = r.headers.get("set-cookie", "")
        for part in set_cookie.split(";"):
            part = part.strip()
            if part.startswith("access_token="):
                token = part.split("=", 1)[1]
                break
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s, r.status_code, data


def test():
    # ------------------------------------------------------------------
    print("1. Testando acesso SEM autenticação a /doces...")
    r = requests.get(f"{BASE_URL}/doces")
    assert r.status_code == 401, f"Esperado 401, recebeu {r.status_code}: {r.text}"
    print("   ✓ Retornou 401 Não Autenticado.\n")

    # ------------------------------------------------------------------
    print("2. Testando login com credenciais ERRADAS...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "senhaerrada"})
    assert r.status_code == 401, f"Esperado 401, recebeu {r.status_code}: {r.text}"
    print("   ✓ Login inválido retornou 401.\n")

    # ------------------------------------------------------------------
    print("3. Testando login com credenciais CORRETAS (admin/admin123)...")
    s, status, data = make_session("admin", "admin123")
    assert status == 200, f"Esperado 200, recebeu {status}: {data}"
    assert data["user"]["IS_ADMIN"] == 1
    print(f"   ✓ Logado como '{data['user']['NOME']}' (Admin).\n")

    # ------------------------------------------------------------------
    print("4. Testando /auth/me com sessão válida...")
    r = s.get(f"{BASE_URL}/auth/me")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}: {r.text}"
    assert r.json()["USERNAME"] == "admin"
    print(f"   ✓ Sessão válida para '{r.json()['USERNAME']}'.\n")

    # ------------------------------------------------------------------
    print("5. Testando acesso a /doces COM autenticação...")
    r = s.get(f"{BASE_URL}/doces")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    print(f"   ✓ {len(r.json())} doces carregados.\n")

    # ------------------------------------------------------------------
    print("6. Testando acesso a /kits COM autenticação...")
    r = s.get(f"{BASE_URL}/kits")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    print(f"   ✓ {len(r.json())} kits carregados.\n")

    # ------------------------------------------------------------------
    print("7. Testando criação de usuário não-admin via /admin/usuarios...")
    r = s.post(f"{BASE_URL}/admin/usuarios", json={
        "username": "operador_teste", "nome": "Operador Teste",
        "password": "teste1234", "is_admin": False
    })
    assert r.status_code == 201, f"Esperado 201, recebeu {r.status_code}: {r.text}"
    new_user_id = r.json()["COD_USUARIO"]
    print(f"   ✓ Usuário 'operador_teste' criado com ID {new_user_id}.\n")

    # ------------------------------------------------------------------
    print("8. Testando listagem de usuários (admin)...")
    r = s.get(f"{BASE_URL}/admin/usuarios")
    assert r.status_code == 200
    assert len(r.json()) >= 2
    print(f"   ✓ {len(r.json())} usuários listados.\n")

    # ------------------------------------------------------------------
    print("9. Testando proibição: operador acessando /admin/usuarios...")
    s_op, status_op, _ = make_session("operador_teste", "teste1234")
    assert status_op == 200, f"Login do operador falhou: {status_op}"
    r = s_op.get(f"{BASE_URL}/admin/usuarios")
    assert r.status_code == 403, f"Esperado 403, recebeu {r.status_code}: {r.text}"
    print("   ✓ Operador recebeu 403 Proibido.\n")

    # ------------------------------------------------------------------
    print("10. Testando que operador PODE acessar /doces...")
    r = s_op.get(f"{BASE_URL}/doces")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    print(f"    ✓ Operador tem acesso aos doces.\n")

    # ------------------------------------------------------------------
    print("11. Testando salvar orçamento...")
    orcamento_payload = {
        "items": [
            {"id": 1, "nome": "Kit Festa Teste", "tipo": "kit",
             "quantidade": 2, "precoUnitario": 106.61, "subtotal": 213.22}
        ],
        "cliente": "Maria da Silva", "validade": "2026-12-31",
        "observacoes": "Entrega em mãos.",
        "subTotal": 213.22, "descontoGeral": 5.0,
        "totalComDesconto": 202.56, "frete": 20.0, "totalFinal": 222.56
    }
    r = s.post(f"{BASE_URL}/orcamento/salvar", json=orcamento_payload)
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}: {r.text}"
    orc_id = r.json()["COD_ORCAMENTO"]
    print(f"    ✓ Orçamento salvo com ID #{orc_id}.\n")

    # ------------------------------------------------------------------
    print("12. Testando listagem de orçamentos salvos...")
    r = s.get(f"{BASE_URL}/orcamentos")
    assert r.status_code == 200
    assert len(r.json()) >= 1
    print(f"    ✓ {len(r.json())} orçamento(s) listado(s).\n")

    # ------------------------------------------------------------------
    print(f"13. Testando detalhes do orçamento #{orc_id}...")
    r = s.get(f"{BASE_URL}/orcamentos/{orc_id}")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    detalhe = r.json()
    assert detalhe["CLIENTE"] == "Maria da Silva"
    assert len(detalhe["items"]) == 1
    print(f"    ✓ Orçamento #{orc_id} com {len(detalhe['items'])} item, cliente '{detalhe['CLIENTE']}'.\n")

    # ------------------------------------------------------------------
    print(f"14. Testando PDF do orçamento #{orc_id}...")
    r = s.get(f"{BASE_URL}/orcamentos/{orc_id}/pdf")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    assert "application/pdf" in r.headers.get("Content-Type", "")
    assert len(r.content) > 1000
    print(f"    ✓ PDF gerado com {len(r.content)} bytes.\n")

    # ------------------------------------------------------------------
    print(f"15. Testando visualização HTML do orçamento #{orc_id}...")
    r = s.get(f"{BASE_URL}/orcamentos/{orc_id}/visualizacao")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("Content-Type", "")
    print(f"    ✓ HTML retornado ({len(r.content)} bytes).\n")

    # ------------------------------------------------------------------
    print(f"16. Testando exclusão do orçamento #{orc_id}...")
    r = s.delete(f"{BASE_URL}/orcamentos/{orc_id}")
    assert r.status_code == 200, f"Esperado 200, recebeu {r.status_code}"
    print(f"    ✓ Orçamento #{orc_id} excluído.\n")

    # ------------------------------------------------------------------
    print("17. Testando alteração de senha...")
    r = s.post(f"{BASE_URL}/auth/alterar-senha", json={
        "current_password": "admin123", "new_password": "admin123"
    })
    assert r.status_code == 200
    print("    ✓ Alteração de senha realizada.\n")

    # ------------------------------------------------------------------
    print("18. Testando reset de senha via admin...")
    r = s.put(f"{BASE_URL}/admin/usuarios/{new_user_id}/reset-senha",
              json={"new_password": "novaSenha456"})
    assert r.status_code == 200
    print("    ✓ Senha do operador redefinida.\n")

    # ------------------------------------------------------------------
    print("19. Testando exclusão do usuário operador_teste...")
    r = s.delete(f"{BASE_URL}/admin/usuarios/{new_user_id}")
    assert r.status_code == 200
    print(f"    ✓ Usuário {new_user_id} excluído.\n")

    # ------------------------------------------------------------------
    print("20. Testando logout...")
    r = s.post(f"{BASE_URL}/auth/logout")
    assert r.status_code == 200
    print("    ✓ Logout realizado.\n")

    print("\n" + "="*55)
    print("  >>> TODOS OS 20 TESTES PASSARAM COM SUCESSO! <<<")
    print("="*55)


if __name__ == "__main__":
    test()
