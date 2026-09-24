document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.origin;
    let currentUser = null;
    let orcamentoAtual = [];

    // --- Cache de Elementos DOM ---
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userHeader = document.getElementById('userHeader');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userBadge = document.getElementById('userBadge');
    const btnLogout = document.getElementById('btnLogout');
    const tabAdmin = document.getElementById('tabAdmin');

    const doceForm = document.getElementById('doceForm');
    const doceIdInput = document.getElementById('doceId');
    const doceDescricaoInput = document.getElementById('doceDescricao');
    const docePrecoInput = document.getElementById('docePreco');
    const tabelaDoces = document.getElementById('tabelaDoces');
    const selectDoceAdd = document.getElementById('selectDoceAdd');

    const kitForm = document.getElementById('kitForm');
    const kitIdInput = document.getElementById('kitId');
    const kitDescricaoInput = document.getElementById('kitDescricao');
    const tabelaKits = document.getElementById('tabelaKits');
    const selectKitBusca = document.getElementById('selectKitBusca');
    const selectKitsVisualizacao = document.getElementById('selectKitsVisualizacao');

    const composicaoForm = document.getElementById('composicaoForm');
    const compQuantidadeInput = document.getElementById('compQuantidade');
    const compDescontoInput = document.getElementById('compDesconto');
    const tabelaComposicao = document.getElementById('tabelaComposicao');
    const valorTotalKitDisplay = document.getElementById('valorTotalKit');
    const selectDocesVisualizacao = document.getElementById('selectDocesVisualizacao');

    const btnVisualizarSelecionados = document.getElementById('btnVisualizarSelecionados');
    const btnPdfSelecionados = document.getElementById('btnPdfSelecionados');
    const btnVisualizarTodos = document.getElementById('btnVisualizarTodos');
    const btnPdfTodos = document.getElementById('btnPdfTodos');

    const orcamentoSelectKit = document.getElementById('orcamento-select-kit');
    const orcamentoKitQtd = document.getElementById('orcamento-kit-qtd');
    const btnOrcamentoAddKit = document.getElementById('btn-orcamento-add-kit');
    const orcamentoSelectDoce = document.getElementById('orcamento-select-doce');
    const orcamentoDoceQtd = document.getElementById('orcamento-doce-qtd');
    const btnOrcamentoAddDoce = document.getElementById('btn-orcamento-add-doce');
    const tabelaOrcamento = document.getElementById('tabelaOrcamento');
    const orcamentoSubtotal = document.getElementById('orcamento-subtotal');
    const orcamentoDescontoGeral = document.getElementById('orcamento-desconto-geral');
    const orcamentoFrete = document.getElementById('orcamento-frete');
    const orcamentoTotalFinal = document.getElementById('orcamento-total-final');
    const orcamentoCliente = document.getElementById('orcamento-cliente');
    const orcamentoValidade = document.getElementById('orcamento-validade');
    const orcamentoObservacoes = document.getElementById('orcamento-observacoes');
    const btnOrcamentoVisualizar = document.getElementById('btn-orcamento-visualizar');
    const btnOrcamentoPdf = document.getElementById('btn-orcamento-pdf');
    const btnOrcamentoLimpar = document.getElementById('btn-orcamento-limpar');
    const btnOrcamentoSalvar = document.getElementById('btn-orcamento-salvar');
    const orcamentoSalvoFeedback = document.getElementById('orcamentoSalvoFeedback');

    const tabelaOrcamentosSalvos = document.getElementById('tabelaOrcamentosSalvos');

    const formUsuario = document.getElementById('formUsuario');
    const adminUsuarioId = document.getElementById('adminUsuarioId');
    const adminNome = document.getElementById('adminNome');
    const adminUsername = document.getElementById('adminUsername');
    const adminSenha = document.getElementById('adminSenha');
    const adminIsAdmin = document.getElementById('adminIsAdmin');
    const tabelaUsuarios = document.getElementById('tabelaUsuarios');
    const usuarioFeedback = document.getElementById('usuarioFeedback');
    const btnCancelarUsuario = document.getElementById('btnCancelarUsuario');

    const modalAlterarSenha = document.getElementById('modalAlterarSenha');
    const formAlterarSenha = document.getElementById('formAlterarSenha');
    const senhaAtual = document.getElementById('senhaAtual');
    const novaSenha = document.getElementById('novaSenha');
    const msgAlterarSenha = document.getElementById('msgAlterarSenha');
    const btnOpenAlterarSenha = document.getElementById('btnOpenAlterarSenha');
    const btnFecharModalSenha = document.getElementById('btnFecharModalSenha');

    // ==========================================
    // FUNÇÕES DA API
    // ==========================================
    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const fetchData = async (endpoint, options = {}) => {
        try {
            const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
            const res = await fetch(`${API_URL}/${endpoint}`, {
                ...options,
                headers,
                credentials: 'include'
            });

            if (res.status === 401) {
                localStorage.removeItem('access_token');
                mostrarLogin();
                return null;
            }

            const contentType = res.headers.get('content-type');
            if (!res.ok) {
                let msg = `Erro ${res.status}: ${res.statusText}`;
                try {
                    const errData = await res.json();
                    msg = errData.detail || msg;
                } catch (_) {}
                throw new Error(msg);
            }

            if (contentType && contentType.includes('application/json')) {
                return res.json();
            }
            return true;
        } catch (error) {
            console.error(`Falha ao acessar /${endpoint}:`, error);
            alert(`Erro: ${error.message}`);
            return null;
        }
    };

    // ==========================================
    // AUTENTICAÇÃO
    // ==========================================
    const mostrarLogin = () => {
        loginError.style.display = 'none';
        loginError.textContent = '';
        loginForm.reset();
        loginOverlay.style.display = 'flex';
        userHeader.style.display = 'none';
    };

    const esconderLogin = (user) => {
        currentUser = user;
        loginOverlay.style.display = 'none';
        userHeader.style.display = 'flex';
        userNameDisplay.textContent = user.NOME;

        if (user.IS_ADMIN) {
            userBadge.textContent = 'Admin';
            userBadge.className = 'badge badge-admin';
            tabAdmin.style.display = '';
        } else {
            userBadge.textContent = 'Operador';
            userBadge.className = 'badge badge-user';
            tabAdmin.style.display = 'none';
        }
    };

    const verificarSessao = async () => {
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const user = await res.json();
                esconderLogin(user);
                return true;
            }
        } catch (_) {}
        localStorage.removeItem('access_token');
        mostrarLogin();
        return false;
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const btnSubmit = document.getElementById('btnLoginSubmit');
        btnSubmit.textContent = 'Entrando...';
        btnSubmit.disabled = true;

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: document.getElementById('loginUsername').value.trim(),
                    password: document.getElementById('loginPassword').value
                })
            });

            const data = await res.json();
            if (!res.ok) {
                loginError.textContent = data.detail || 'Usuário ou senha incorretos.';
                loginError.style.display = 'block';
            } else {
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                }
                esconderLogin(data.user);
                init();
            }
        } catch (_) {
            loginError.textContent = 'Erro de conexão com o servidor.';
            loginError.style.display = 'block';
        } finally {
            btnSubmit.textContent = 'Entrar no Sistema';
            btnSubmit.disabled = false;
        }
    });

    btnLogout.addEventListener('click', async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include'
            });
        } catch (_) {}
        localStorage.removeItem('access_token');
        currentUser = null;
        orcamentoAtual = [];
        mostrarLogin();
    });

    btnOpenAlterarSenha.addEventListener('click', () => {
        formAlterarSenha.reset();
        msgAlterarSenha.style.display = 'none';
        modalAlterarSenha.style.display = 'flex';
    });

    btnFecharModalSenha.addEventListener('click', () => {
        modalAlterarSenha.style.display = 'none';
    });

    formAlterarSenha.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgAlterarSenha.style.display = 'none';
        const res = await fetchData('auth/alterar-senha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: senhaAtual.value, new_password: novaSenha.value })
        });
        if (res) {
            msgAlterarSenha.textContent = '✅ Senha alterada com sucesso!';
            msgAlterarSenha.className = 'form-msg alert-success';
            msgAlterarSenha.style.display = 'block';
            formAlterarSenha.reset();
            setTimeout(() => { modalAlterarSenha.style.display = 'none'; }, 2000);
        }
    });

    // ==========================================
    // ABAS
    // ==========================================
    document.querySelector('.tabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            const targetId = e.target.dataset.tabTarget;
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            e.target.classList.add('active');

            if (targetId === 'abaOrcamentosSalvos') carregarOrcamentosSalvos();
            if (targetId === 'abaAdmin') carregarUsuarios();
        }
    });

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    const renderDoces = (doces) => {
        tabelaDoces.innerHTML = '';
        selectDoceAdd.innerHTML = '<option value="">-- Selecione um Doce --</option>';
        doces.forEach(d => {
            tabelaDoces.innerHTML += `<tr>
                <td>${d.COD_DOCE}</td><td>${d.DESCRICAO}</td><td>R$ ${d.PRECO.toFixed(2)}</td>
                <td>
                    <button class="btn-edit" data-id="${d.COD_DOCE}" data-descricao="${d.DESCRICAO}" data-preco="${d.PRECO}">Editar</button>
                    <button class="btn-delete" data-id="${d.COD_DOCE}">Deletar</button>
                </td></tr>`;
            selectDoceAdd.innerHTML += `<option value="${d.COD_DOCE}">${d.DESCRICAO} (R$ ${d.PRECO.toFixed(2)})</option>`;
        });
        orcamentoSelectDoce.innerHTML = selectDoceAdd.innerHTML;
    };

    const renderKits = (kits) => {
        tabelaKits.innerHTML = '';
        selectKitBusca.innerHTML = '<option value="">-- Selecione um Kit --</option>';
        selectKitsVisualizacao.innerHTML = '';
        orcamentoSelectKit.innerHTML = '<option value="">-- Selecione um Kit --</option>';
        kits.forEach(k => {
            tabelaKits.innerHTML += `<tr>
                <td>${k.COD_KIT}</td><td>${k.DESCRICAO}</td>
                <td>
                    <button class="btn-edit" data-id="${k.COD_KIT}" data-descricao="${k.DESCRICAO}">Editar</button>
                    <button class="btn-view" data-action="view" data-id="${k.COD_KIT}">Visualizar</button>
                    <button class="btn-view" data-action="pdf" data-id="${k.COD_KIT}">PDF</button>
                    <button class="btn-delete" data-id="${k.COD_KIT}">Deletar</button>
                </td></tr>`;
            selectKitBusca.innerHTML += `<option value="${k.COD_KIT}">${k.DESCRICAO}</option>`;
            selectKitsVisualizacao.innerHTML += `<option value="${k.COD_KIT}">${k.DESCRICAO}</option>`;
            orcamentoSelectKit.innerHTML += `<option value="${k.COD_KIT}">${k.DESCRICAO}</option>`;
        });
    };

    const renderComposicao = (composicao) => {
        tabelaComposicao.innerHTML = '';
        let totalKit = 0;
        composicao.forEach(c => {
            const subtotal = (c.PRECO - c.PRECO * (c.DESCONTO / 100)) * c.QUANTIDADE;
            const descontoDisplay = (c.PRECO - c.PRECO * (c.DESCONTO / 100));
            totalKit += subtotal;
            tabelaComposicao.innerHTML += `<tr>
                <td>${c.NOME_DOCE}</td><td>R$ ${c.PRECO.toFixed(2)}</td><td>${c.QUANTIDADE}</td>
                <td style="display: flex; align-items: center; gap: 5px;">
                    <input type="number" step="0.1" class="input-desconto" value="${c.DESCONTO}" style="width: 70px; margin: 0; padding: 4px;">%
                    <button class="btn-edit-desconto btn-edit" data-kit-id="${c.COD_KIT}" data-doce-id="${c.COD_DOCE}" style="padding: 10px 15px; font-size: 12px; margin: 0;">Salvar</button>
                </td>
                <td>R$ ${descontoDisplay.toFixed(2)}</td>
                <td>R$ ${subtotal.toFixed(2)}</td>
                <td><button class="btn-delete-item btn-delete" data-kit-id="${c.COD_KIT}" data-doce-id="${c.COD_DOCE}">Remover</button></td>
            </tr>`;
        });
        valorTotalKitDisplay.innerText = `Valor Total do Kit: R$ ${totalKit.toFixed(2)}`;
    };

    // ==========================================
    // ORÇAMENTO
    // ==========================================
    const renderOrcamento = () => {
        tabelaOrcamento.innerHTML = '';
        let subTotal = 0;
        orcamentoAtual.forEach((item, index) => {
            subTotal += item.subtotal;
            tabelaOrcamento.innerHTML += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.quantidade}</td>
                    <td>R$ ${item.precoUnitario.toFixed(2)}</td>
                    <td>R$ ${item.subtotal.toFixed(2)}</td>
                    <td><button class="btn-delete" data-index="${index}">X</button></td>
                </tr>`;
        });
        const descontoPerc = parseFloat(orcamentoDescontoGeral.value) || 0;
        const frete = parseFloat(orcamentoFrete.value) || 0;
        const totalComDesconto = subTotal * (1 - descontoPerc / 100);
        const totalFinal = totalComDesconto + frete;
        orcamentoSubtotal.textContent = `R$ ${subTotal.toFixed(2)}`;
        orcamentoTotalFinal.textContent = `R$ ${totalFinal.toFixed(2)}`;
    };

    const limparOrcamento = () => {
        orcamentoAtual = [];
        orcamentoDescontoGeral.value = 0;
        orcamentoFrete.value = 0;
        orcamentoCliente.value = '';
        orcamentoValidade.value = '';
        orcamentoObservacoes.value = '';
        orcamentoSalvoFeedback.style.display = 'none';
        renderOrcamento();
    };

    const getOrcamentoPayload = () => {
        let subTotal = 0;
        orcamentoAtual.forEach(item => subTotal += item.subtotal);
        const descontoGeral = parseFloat(orcamentoDescontoGeral.value) || 0;
        const frete = parseFloat(orcamentoFrete.value) || 0;
        const totalComDesconto = subTotal * (1 - descontoGeral / 100);
        const totalFinal = totalComDesconto + frete;
        return {
            items: orcamentoAtual,
            cliente: orcamentoCliente.value,
            validade: orcamentoValidade.value,
            observacoes: orcamentoObservacoes.value,
            subTotal, descontoGeral, totalComDesconto, frete, totalFinal
        };
    };

    btnOrcamentoAddDoce.addEventListener('click', async () => {
        const doceId = orcamentoSelectDoce.value;
        if (!doceId) return;
        const doce = (await fetchData('doces')).find(d => d.COD_DOCE == doceId);
        const quantidade = parseInt(orcamentoDoceQtd.value) || 1;
        orcamentoAtual.push({ id: doce.COD_DOCE, nome: doce.DESCRICAO, tipo: 'doce', quantidade, precoUnitario: doce.PRECO, subtotal: doce.PRECO * quantidade });
        renderOrcamento();
    });

    btnOrcamentoAddKit.addEventListener('click', async () => {
        const kitId = orcamentoSelectKit.value;
        if (!kitId) return;
        const kitDetails = await fetchData(`kit/${kitId}/details`);
        const quantidade = parseInt(orcamentoKitQtd.value) || 1;
        orcamentoAtual.push({ id: kitDetails.COD_KIT, nome: kitDetails.DESCRICAO, tipo: 'kit', quantidade, precoUnitario: kitDetails.PRECO_TOTAL, subtotal: kitDetails.PRECO_TOTAL * quantidade });
        renderOrcamento();
    });

    tabelaOrcamento.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            orcamentoAtual.splice(e.target.dataset.index, 1);
            renderOrcamento();
        }
    });

    orcamentoDescontoGeral.addEventListener('input', renderOrcamento);
    orcamentoFrete.addEventListener('input', renderOrcamento);
    btnOrcamentoLimpar.addEventListener('click', limparOrcamento);

    const gerarSaidaOrcamento = async (tipo) => {
        if (orcamentoAtual.length === 0) return alert('Adicione pelo menos um item ao orçamento.');
        const payload = getOrcamentoPayload();
        const res = await fetch(`${API_URL}/orcamento/${tipo}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    btnOrcamentoVisualizar.addEventListener('click', () => gerarSaidaOrcamento('visualizacao'));
    btnOrcamentoPdf.addEventListener('click', () => gerarSaidaOrcamento('pdf'));

    btnOrcamentoSalvar.addEventListener('click', async () => {
        if (orcamentoAtual.length === 0) return alert('Adicione pelo menos um item ao orçamento antes de salvar.');
        orcamentoSalvoFeedback.style.display = 'none';
        const payload = getOrcamentoPayload();
        const res = await fetchData('orcamento/salvar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res) {
            orcamentoSalvoFeedback.textContent = `✅ ${res.message}`;
            orcamentoSalvoFeedback.style.display = 'block';
        }
    });

    // ==========================================
    // ORÇAMENTOS SALVOS
    // ==========================================
    const formatDate = (isoStr) => {
        if (!isoStr) return '--';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (_) { return isoStr; }
    };

    const carregarOrcamentosSalvos = async () => {
        tabelaOrcamentosSalvos.innerHTML = '<tr><td colspan="7" style="text-align: center;">Carregando...</td></tr>';
        const lista = await fetchData('orcamentos');
        if (!lista) return;
        if (lista.length === 0) {
            tabelaOrcamentosSalvos.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #90a4ae;">Nenhum orçamento salvo ainda.</td></tr>';
            return;
        }
        tabelaOrcamentosSalvos.innerHTML = '';
        lista.forEach(o => {
            tabelaOrcamentosSalvos.innerHTML += `<tr>
                <td><strong>#${o.COD_ORCAMENTO}</strong></td>
                <td>${formatDate(o.CRIADO_EM)}</td>
                <td>${o.CLIENTE || '<em style="color:#90a4ae">—</em>'}</td>
                <td>${o.VALIDADE ? o.VALIDADE.split('-').reverse().join('/') : '<em style="color:#90a4ae">—</em>'}</td>
                <td><strong>R$ ${parseFloat(o.TOTAL_FINAL).toFixed(2)}</strong></td>
                <td>${o.CRIADO_POR_NOME || '--'}</td>
                <td>
                    <button class="btn-view" onclick="window.open('${API_URL}/orcamentos/${o.COD_ORCAMENTO}/visualizacao','_blank')">Visualizar</button>
                    <button class="btn-view" onclick="window.open('${API_URL}/orcamentos/${o.COD_ORCAMENTO}/pdf','_blank')">PDF</button>
                    <button class="btn-edit btn-carregar-orcamento" data-id="${o.COD_ORCAMENTO}">Carregar</button>
                    <button class="btn-delete btn-del-orcamento" data-id="${o.COD_ORCAMENTO}">Excluir</button>
                </td>
            </tr>`;
        });
    };

    tabelaOrcamentosSalvos.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-del-orcamento')) {
            if (!confirm('Excluir este orçamento salvo?')) return;
            const id = e.target.dataset.id;
            const res = await fetchData(`orcamentos/${id}`, { method: 'DELETE' });
            if (res) carregarOrcamentosSalvos();
        }
        if (e.target.classList.contains('btn-carregar-orcamento')) {
            const id = e.target.dataset.id;
            const detalhe = await fetchData(`orcamentos/${id}`);
            if (!detalhe) return;
            limparOrcamento();
            orcamentoAtual = detalhe.items.map(i => ({
                id: i.id, nome: i.nome, tipo: i.tipo,
                quantidade: i.quantidade, precoUnitario: i.precoUnitario, subtotal: i.subtotal
            }));
            orcamentoCliente.value = detalhe.CLIENTE || '';
            orcamentoValidade.value = detalhe.VALIDADE || '';
            orcamentoObservacoes.value = detalhe.OBSERVACOES || '';
            orcamentoDescontoGeral.value = detalhe.DESCONTO_GERAL || 0;
            orcamentoFrete.value = detalhe.FRETE || 0;
            renderOrcamento();
            // Navegar para a aba de orçamento
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById('abaOrcamento').classList.add('active');
            document.querySelector('[data-tab-target="abaOrcamento"]').classList.add('active');
            alert(`Orçamento #${id} carregado! Você pode editá-lo e salvar novamente.`);
        }
    });

    // ==========================================
    // CARREGAMENTO DE DADOS
    // ==========================================
    const carregarDoces = async () => {
        const doces = await fetchData('doces');
        if (doces) renderDoces(doces);
    };

    const carregarKits = async () => {
        const kits = await fetchData('kits');
        if (kits) renderKits(kits);
    };

    const carregarComposicao = async () => {
        const codKit = selectKitBusca.value;
        tabelaComposicao.innerHTML = '';
        valorTotalKitDisplay.innerText = '';
        if (!codKit) return;
        const composicao = await fetchData(`composicao/${codKit}`);
        if (composicao) renderComposicao(composicao);
    };

    const carregarDocesStandalone = async () => {
        const docesStandalone = await fetchData('doces/standalone');
        if (docesStandalone) {
            selectDocesVisualizacao.innerHTML = '';
            docesStandalone.forEach(d => {
                selectDocesVisualizacao.innerHTML += `<option value="${d.COD_DOCE}">${d.DESCRICAO} (R$ ${d.PRECO.toFixed(2)})</option>`;
            });
        }
    };

    // ==========================================
    // EVENT LISTENERS - DOCES
    // ==========================================
    doceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = doceIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `doces/${id}` : 'doces';
        const body = JSON.stringify({ descricao: doceDescricaoInput.value, preco: parseFloat(docePrecoInput.value) });
        await fetchData(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
        doceForm.reset();
        doceIdInput.value = '';
        carregarDoces();
    });

    tabelaDoces.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('btn-edit')) {
            doceIdInput.value = target.dataset.id;
            doceDescricaoInput.value = target.dataset.descricao;
            docePrecoInput.value = target.dataset.preco;
        } else if (target.classList.contains('btn-delete')) {
            if (confirm('Deletar doce?')) {
                await fetchData(`doces/${target.dataset.id}`, { method: 'DELETE' });
                carregarDoces();
            }
        }
    });

    // ==========================================
    // EVENT LISTENERS - KITS
    // ==========================================
    kitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = kitIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `kits/${id}` : 'kits';
        const body = JSON.stringify({ descricao: kitDescricaoInput.value });
        await fetchData(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
        kitForm.reset();
        kitIdInput.value = '';
        carregarKits();
    });

    tabelaKits.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (target.classList.contains('btn-edit')) {
            kitIdInput.value = id;
            kitDescricaoInput.value = target.dataset.descricao;
        } else if (target.classList.contains('btn-view')) {
            if (target.dataset.action === 'view') {
                window.open(`${API_URL}/kits/${id}/visualizacao`, '_blank');
            } else if (target.dataset.action === 'pdf') {
                window.open(`${API_URL}/kits/${id}/pdf`, '_blank');
            }
        } else if (target.classList.contains('btn-delete')) {
            if (confirm('Deletar Kit e toda sua composição?')) {
                await fetchData(`kits/${id}`, { method: 'DELETE' });
                carregarKits();
                carregarComposicao();
            }
        }
    });

    // ==========================================
    // EVENT LISTENERS - COMPOSIÇÃO
    // ==========================================
    selectKitBusca.addEventListener('change', carregarComposicao);

    composicaoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = JSON.stringify({
            cod_kit: selectKitBusca.value,
            cod_doce: selectDoceAdd.value,
            quantidade: compQuantidadeInput.value,
            desconto: compDescontoInput.value || 0
        });
        await fetchData('composicao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        compQuantidadeInput.value = '';
        compDescontoInput.value = '0';
        carregarComposicao();
    });

    tabelaComposicao.addEventListener('click', async (e) => {
        const target = e.target;
        const { kitId, doceId } = target.dataset;
        if (target.classList.contains('btn-edit-desconto')) {
            const inputDesconto = target.closest('td').querySelector('.input-desconto');
            const novoDesconto = parseFloat(inputDesconto.value) || 0;
            await fetchData(`composicao/${kitId}/${doceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ desconto: novoDesconto }) });
            carregarComposicao();
        } else if (target.classList.contains('btn-delete-item')) {
            if (confirm('Remover este doce do kit?')) {
                await fetchData(`composicao/${kitId}/${doceId}`, { method: 'DELETE' });
                carregarComposicao();
            }
        }
    });

    // ==========================================
    // EVENT LISTENERS - VISUALIZAÇÃO/CATÁLOGO
    // ==========================================
    const getSelectedIds = (selectElement) => Array.from(selectElement.selectedOptions).map(o => o.value);

    btnVisualizarTodos.addEventListener('click', () => window.open(`${API_URL}/catalog/visualizacao?kitIds=all`, '_blank'));
    btnPdfTodos.addEventListener('click', () => window.open(`${API_URL}/catalog/pdf?kitIds=all`, '_blank'));

    btnVisualizarSelecionados.addEventListener('click', () => {
        const kitIds = getSelectedIds(selectKitsVisualizacao);
        const doceIds = getSelectedIds(selectDocesVisualizacao);
        if (kitIds.length === 0 && doceIds.length === 0) return alert('Selecione pelo menos um kit ou doce.');
        const q = [kitIds.length > 0 ? `kitIds=${kitIds.join(',')}` : '', doceIds.length > 0 ? `doceIds=${doceIds.join(',')}` : ''].filter(Boolean).join('&');
        window.open(`${API_URL}/catalog/visualizacao?${q}`, '_blank');
    });

    btnPdfSelecionados.addEventListener('click', () => {
        const kitIds = getSelectedIds(selectKitsVisualizacao);
        const doceIds = getSelectedIds(selectDocesVisualizacao);
        if (kitIds.length === 0 && doceIds.length === 0) return alert('Selecione pelo menos um kit ou doce.');
        const q = [kitIds.length > 0 ? `kitIds=${kitIds.join(',')}` : '', doceIds.length > 0 ? `doceIds=${doceIds.join(',')}` : ''].filter(Boolean).join('&');
        window.open(`${API_URL}/catalog/pdf?${q}`, '_blank');
    });

    // ==========================================
    // GESTÃO DE USUÁRIOS (Admin)
    // ==========================================
    const renderUsuarios = (usuarios) => {
        tabelaUsuarios.innerHTML = '';
        usuarios.forEach(u => {
            const isAdmin = u.IS_ADMIN === 1;
            const isAtivo = u.ATIVO === 1;
            const dataFormatada = u.CRIADO_EM ? new Date(u.CRIADO_EM).toLocaleDateString('pt-BR') : '--';
            tabelaUsuarios.innerHTML += `<tr>
                <td>${u.COD_USUARIO}</td>
                <td>${u.NOME}</td>
                <td><code>${u.USERNAME}</code></td>
                <td><span class="badge ${isAdmin ? 'badge-admin' : 'badge-user'}">${isAdmin ? 'Admin' : 'Operador'}</span></td>
                <td><span class="badge ${isAtivo ? 'badge-active' : 'badge-inactive'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
                <td>${dataFormatada}</td>
                <td>
                    <button class="btn-edit btn-editar-usuario"
                        data-id="${u.COD_USUARIO}"
                        data-nome="${u.NOME}"
                        data-username="${u.USERNAME}"
                        data-admin="${u.IS_ADMIN}"
                        data-ativo="${u.ATIVO}">Editar</button>
                    <button class="btn-view btn-reset-senha" data-id="${u.COD_USUARIO}" data-username="${u.USERNAME}">Reset Senha</button>
                    ${u.COD_USUARIO !== currentUser?.COD_USUARIO ? `<button class="btn-delete btn-del-usuario" data-id="${u.COD_USUARIO}">Excluir</button>` : ''}
                </td>
            </tr>`;
        });
    };

    const carregarUsuarios = async () => {
        const usuarios = await fetchData('admin/usuarios');
        if (usuarios) renderUsuarios(usuarios);
    };

    const resetarFormUsuario = () => {
        formUsuario.reset();
        adminUsuarioId.value = '';
        adminSenha.required = true;
        adminUsername.readOnly = false;
        document.getElementById('btnSalvarUsuario').textContent = 'Salvar Usuário';
        btnCancelarUsuario.style.display = 'none';
        usuarioFeedback.style.display = 'none';
    };

    formUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();
        usuarioFeedback.style.display = 'none';
        const id = adminUsuarioId.value;

        let res;
        if (id) {
            res = await fetchData(`admin/usuarios/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: adminNome.value, is_admin: adminIsAdmin.checked, ativo: true })
            });
        } else {
            res = await fetchData('admin/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: adminUsername.value, nome: adminNome.value, password: adminSenha.value, is_admin: adminIsAdmin.checked })
            });
        }

        if (res) {
            usuarioFeedback.textContent = id ? '✅ Usuário atualizado!' : '✅ Usuário criado com sucesso!';
            usuarioFeedback.className = 'form-msg alert-success';
            usuarioFeedback.style.display = 'block';
            resetarFormUsuario();
            carregarUsuarios();
        }
    });

    btnCancelarUsuario.addEventListener('click', resetarFormUsuario);

    tabelaUsuarios.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('btn-editar-usuario')) {
            adminUsuarioId.value = target.dataset.id;
            adminNome.value = target.dataset.nome;
            adminUsername.value = target.dataset.username;
            adminUsername.readOnly = true;
            adminIsAdmin.checked = target.dataset.admin === '1';
            adminSenha.required = false;
            adminSenha.value = '';
            document.getElementById('btnSalvarUsuario').textContent = 'Atualizar Usuário';
            btnCancelarUsuario.style.display = '';
            usuarioFeedback.style.display = 'none';
            adminNome.focus();
        }

        if (target.classList.contains('btn-reset-senha')) {
            const novaSenhaReset = prompt(`Digite a nova senha para o usuário "${target.dataset.username}":`);
            if (!novaSenhaReset || novaSenhaReset.trim().length < 4) return alert('Senha deve ter pelo menos 4 caracteres.');
            const res = await fetchData(`admin/usuarios/${target.dataset.id}/reset-senha`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: novaSenhaReset })
            });
            if (res) alert('Senha redefinida com sucesso!');
        }

        if (target.classList.contains('btn-del-usuario')) {
            if (!confirm('Excluir este usuário permanentemente?')) return;
            const res = await fetchData(`admin/usuarios/${target.dataset.id}`, { method: 'DELETE' });
            if (res) carregarUsuarios();
        }
    });

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    const init = async () => {
        await carregarDoces();
        await carregarKits();
        await carregarDocesStandalone();
    };

    const start = async () => {
        const autenticado = await verificarSessao();
        if (autenticado) init();
    };

    start();
});