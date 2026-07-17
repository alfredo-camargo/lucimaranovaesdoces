document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000';

    // --- Cache de Elementos DOM ---
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

    // --- Lógica das Abas ---
    document.querySelector('.tabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            const targetId = e.target.dataset.tabTarget;
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            e.target.classList.add('active');
        }
    });

    // --- Funções da API ---
    const fetchData = async (endpoint, options = {}) => {
        try {
            const res = await fetch(`${API_URL}/${endpoint}`, options);
            if (!res.ok) {
                throw new Error(`Erro na requisição: ${res.statusText}`);
            }
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return res.json();
            }
            return true; // Sucesso para requisições sem corpo (ex: DELETE)
        } catch (error) {
            console.error(`Falha ao acessar o endpoint ${endpoint}:`, error);
            return null;
        }
    };

    // --- Funções de Renderização ---
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
        // Popula o select da aba de orçamento
        orcamentoSelectDoce.innerHTML = selectDoceAdd.innerHTML;
    };

    const renderKits = (kits) => {
        tabelaKits.innerHTML = '';
        selectKitBusca.innerHTML = '<option value="">-- Selecione um Kit --</option>';
        selectKitsVisualizacao.innerHTML = '';
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
            // Popula o select da aba de orçamento
            orcamentoSelectKit.innerHTML += `<option value="${k.COD_KIT}">${k.DESCRICAO}</option>`;
        });
    };

    const renderComposicao = (composicao) => {
        tabelaComposicao.innerHTML = '';
        let totalKit = 0;
        composicao.forEach(c => {
            const subtotal = (c.PRECO - c.PRECO * (c.DESCONTO / 100)) * c.QUANTIDADE;
            totalKit += subtotal;
            tabelaComposicao.innerHTML += `<tr>
                <td>${c.NOME_DOCE}</td><td>R$ ${c.PRECO.toFixed(2)}</td><td>${c.QUANTIDADE}</td>
                <td style="display: flex; align-items: center; gap: 5px;">
                    <input type="number" step="0.1" class="input-desconto" value="${c.DESCONTO}" style="width: 70px; margin: 0; padding: 4px;"> %
                    <button class="btn-edit-desconto btn-edit" data-kit-id="${c.COD_KIT}" data-doce-id="${c.COD_DOCE}" style="padding: 5px 10px; font-size: 12px; margin: 0;">Salvar</button>
                </td>
                <td>R$ ${subtotal.toFixed(2)}</td>
                <td><button class="btn-delete-item btn-delete" data-kit-id="${c.COD_KIT}" data-doce-id="${c.COD_DOCE}">Remover</button></td>
            </tr>`;
        });
        valorTotalKitDisplay.innerText = `Valor Total do Kit: R$ ${totalKit.toFixed(2)}`;
    };

    // --- Lógica do Orçamento ---
    let orcamentoAtual = [];

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
                </tr>
            `;
        });

        const descontoPerc = parseFloat(orcamentoDescontoGeral.value) || 0;
        const frete = parseFloat(orcamentoFrete.value) || 0;

        const valorDesconto = subTotal * (descontoPerc / 100);
        const totalComDesconto = subTotal - valorDesconto;
        const totalFinal = totalComDesconto + frete;

        orcamentoSubtotal.textContent = `R$ ${subTotal.toFixed(2)}`;
        orcamentoTotalFinal.textContent = `R$ ${totalFinal.toFixed(2)}`;
    };

    const limparOrcamento = () => {
        orcamentoAtual = [];
        orcamentoDescontoGeral.value = 0;
        orcamentoFrete.value = 0;
        orcamentoObservacoes.value = '';
        renderOrcamento();
    };
    // --- Funções de Carregamento ---
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

    // --- Event Listeners ---

    // DOCES
    doceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = doceIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `doces/${id}` : 'doces';
        const body = JSON.stringify({ descricao: doceDescricaoInput.value, preco: docePrecoInput.value });
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

    // KITS
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

    // COMPOSIÇÃO
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
            const body = JSON.stringify({ desconto: novoDesconto });
            await fetchData(`composicao/${kitId}/${doceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
            carregarComposicao();
        } else if (target.classList.contains('btn-delete-item')) {
            if (confirm('Remover este doce do kit?')) {
                await fetchData(`composicao/${kitId}/${doceId}`, { method: 'DELETE' });
                carregarComposicao();
            }
        }
    });

    // VISUALIZAÇÃO
    const getSelectedKitIds = () => Array.from(selectKitsVisualizacao.selectedOptions).map(option => option.value);

    btnVisualizarTodos.addEventListener('click', () => window.open(`${API_URL}/kits/visualizacao/todos`, '_blank'));
    btnPdfTodos.addEventListener('click', () => window.open(`${API_URL}/kits/pdf/todos`, '_blank'));

    btnVisualizarSelecionados.addEventListener('click', () => {
        const selectedIds = getSelectedKitIds();
        if (selectedIds.length === 0) {
            return alert('Por favor, selecione pelo menos um kit para visualizar.');
        }
        window.open(`${API_URL}/kits/visualizacao/selecionados?ids=${selectedIds.join(',')}`, '_blank');
    });

    btnPdfSelecionados.addEventListener('click', () => {
        const selectedIds = getSelectedKitIds();
        if (selectedIds.length === 0) {
            return alert('Por favor, selecione pelo menos um kit para gerar o PDF.');
        }
        window.open(`${API_URL}/kits/pdf/selecionados?ids=${selectedIds.join(',')}`, '_blank');
    });

    // ORÇAMENTO
    btnOrcamentoAddDoce.addEventListener('click', async () => {
        const doceId = orcamentoSelectDoce.value;
        if (!doceId) return;

        const doce = (await fetchData('doces')).find(d => d.COD_DOCE == doceId);
        const quantidade = parseInt(orcamentoDoceQtd.value);

        orcamentoAtual.push({
            id: doce.COD_DOCE,
            nome: doce.DESCRICAO,
            tipo: 'doce',
            quantidade: quantidade,
            precoUnitario: doce.PRECO,
            subtotal: doce.PRECO * quantidade
        });
        renderOrcamento();
    });

    btnOrcamentoAddKit.addEventListener('click', async () => {
        const kitId = orcamentoSelectKit.value;
        if (!kitId) return;

        const kitDetails = await fetchData(`kit/${kitId}/details`);
        const quantidade = parseInt(orcamentoKitQtd.value);

        orcamentoAtual.push({
            id: kitDetails.COD_KIT,
            nome: kitDetails.DESCRICAO,
            tipo: 'kit',
            quantidade: quantidade,
            precoUnitario: kitDetails.PRECO_TOTAL,
            subtotal: kitDetails.PRECO_TOTAL * quantidade
        });
        renderOrcamento();
    });

    tabelaOrcamento.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const index = e.target.dataset.index;
            orcamentoAtual.splice(index, 1); // Remove o item do array
            renderOrcamento();
        }
    });

    orcamentoDescontoGeral.addEventListener('input', renderOrcamento);
    orcamentoFrete.addEventListener('input', renderOrcamento);
    btnOrcamentoLimpar.addEventListener('click', limparOrcamento);

    const gerarSaidaOrcamento = async (tipo) => {
        let subTotal = 0;
        orcamentoAtual.forEach(item => subTotal += item.subtotal);
        const descontoGeral = parseFloat(orcamentoDescontoGeral.value) || 0;
        const frete = parseFloat(orcamentoFrete.value) || 0;
        const totalComDesconto = subTotal * (1 - descontoGeral / 100);
        const totalFinal = totalComDesconto + frete;

        const orcamentoData = {
            items: orcamentoAtual,
            cliente: orcamentoCliente.value,
            validade: orcamentoValidade.value,
            observacoes: orcamentoObservacoes.value,
            subTotal, descontoGeral, totalComDesconto, frete, totalFinal
        };

        const res = await fetch(`${API_URL}/orcamento/${tipo}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orcamentoData)
        });

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    btnOrcamentoVisualizar.addEventListener('click', () => gerarSaidaOrcamento('visualizacao'));
    btnOrcamentoPdf.addEventListener('click', () => gerarSaidaOrcamento('pdf'));

    // --- Carga Inicial ---
    const init = () => {
        carregarDoces();
        carregarKits();
    };

    init();
});