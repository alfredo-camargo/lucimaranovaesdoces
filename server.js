const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util'); // Usado para 'promisify' os métodos do DB
const cors = require('cors');
const puppeteer = require('puppeteer'); // Importa puppeteer
const fetch = require('node-fetch').default; // Importa node-fetch (acessando o default export)

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Adiciona middleware para servir arquivos estáticos da pasta raiz

const db = new sqlite3.Database('./banco.sqlite', (err) => {
    if (err) console.error('Erro ao conectar ao banco:', err.message);
    else console.log('Conectado ao banco de dados SQLite.');
});

// Promisify db.all e db.get para usar com async/await
db.allAsync = promisify(db.all).bind(db);
db.getAsync = promisify(db.get).bind(db);

// ==========================================
// ROTAS PARA DOCES (TB_DOCES)
// ==========================================
app.post('/doces', (req, res) => {
    const { descricao, preco } = req.body;
    db.run("INSERT INTO TB_DOCES (DESCRICAO, PRECO) VALUES (?, ?)", 
    [descricao, preco], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // this.lastID contém o ID gerado automaticamente pelo AUTOINCREMENT
        res.status(201).json({ id: this.lastID, descricao, preco });
    });
});


app.get('/doces', (req, res) => {
    db.all("SELECT COD_DOCE, DESCRICAO, PRECO FROM TB_DOCES", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/doces/:id', (req, res) => {
    const { descricao, preco } = req.body;
    db.run("UPDATE TB_DOCES SET DESCRICAO = ?, PRECO = ? WHERE COD_DOCE = ?", 
    [descricao, preco, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Doce atualizado com sucesso" });
    });
});

app.delete('/doces/:id', (req, res) => {
    db.run("DELETE FROM TB_DOCES WHERE COD_DOCE = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Doce deletado" });
    });
});

// ==========================================
// ROTAS PARA KITS (TB_KITS)
// ==========================================
app.post('/kits', (req, res) => {
    const { descricao } = req.body;
    db.run("INSERT INTO TB_KITS (DESCRICAO) VALUES (?)", 
    [descricao], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, descricao });
    });
});


app.get('/kits', (req, res) => {
    db.all("SELECT COD_KIT, DESCRICAO FROM TB_KITS", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/kits/:id', (req, res) => {
    const { descricao } = req.body;
    db.run("UPDATE TB_KITS SET DESCRICAO = ? WHERE COD_KIT = ?", 
    [descricao, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Kit atualizado" });
    });
});

app.delete('/kits/:id', (req, res) => {
    db.run("DELETE FROM tb_kit_composicao WHERE COD_KIT = ?", req.params.id, (err) => {
        db.run("DELETE FROM TB_KITS WHERE COD_KIT = ?", req.params.id, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Kit e suas composições deletados" });
        });
    });
});

// Rota para obter detalhes e preço calculado de um kit
app.get('/kit/:id/details', async (req, res) => {
    try {
        const kit = await db.getAsync("SELECT COD_KIT, DESCRICAO FROM TB_KITS WHERE COD_KIT = ?", [req.params.id]);
        if (!kit) return res.status(404).json({ message: "Kit não encontrado." });

        const composition = await db.allAsync(compositionSql, [req.params.id]);
        let precoTotal = 0;
        composition.forEach(item => {
            precoTotal += (item.PRECO - item.PRECO * (item.DESCONTO / 100)) * item.QUANTIDADE;
        });

        res.json({ ...kit, PRECO_TOTAL: precoTotal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ROTAS PARA COMPOSIÇÃO DO KIT (tb_kit_composicao)
// ==========================================
app.get('/composicao/:cod_kit', (req, res) => {
    const sql = `
        SELECT c.COD_KIT, c.COD_DOCE, c.QUANTIDADE, c.DESCONTO, d.DESCRICAO as NOME_DOCE, d.PRECO 
        FROM tb_kit_composicao c
        JOIN TB_DOCES d ON c.COD_DOCE = d.COD_DOCE
        WHERE c.COD_KIT = ?
    `;
    db.all(sql, [req.params.cod_kit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/composicao', (req, res) => {
    const { cod_kit, cod_doce, quantidade, desconto } = req.body;
    db.run("INSERT INTO tb_kit_composicao (COD_KIT, COD_DOCE, QUANTIDADE, DESCONTO) VALUES (?, ?, ?, ?)", 
    [cod_kit, cod_doce, quantidade, desconto || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Item adicionado ao kit" });
    });
});

// Rota para ATUALIZAR o desconto de um item específico na composição do kit
app.put('/composicao/:cod_kit/:cod_doce', (req, res) => {
    const { desconto } = req.body;
    db.run("UPDATE tb_kit_composicao SET DESCONTO = ? WHERE COD_KIT = ? AND COD_DOCE = ?", 
    [desconto, req.params.cod_kit, req.params.cod_doce], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Desconto atualizado com sucesso" });
    });
});

app.delete('/composicao/:cod_kit/:cod_doce', (req, res) => {
    db.run("DELETE FROM tb_kit_composicao WHERE COD_KIT = ? AND COD_DOCE = ?", 
    [req.params.cod_kit, req.params.cod_doce], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Item removido do kit" });
    });
});

// ==========================================
// FUNÇÕES AUXILIARES DE VISUALIZAÇÃO
// ==========================================

/**
 * Gera o bloco HTML para um único kit.
 * @param {object} kit - O objeto do kit (com COD_KIT, DESCRICAO).
 * @param {Array} composition - A composição do kit.
 * @returns {string} - O bloco HTML do kit.
 */
function generateKitHtmlBlock(kit, composition) {
    let html = `<div class="container"><h2>${kit.DESCRICAO}</h2>`;
    let totalKit = 0;
    let qtdTotal = 0;

    if (composition.length > 0) {
        html += `<table width='100%'>`;
        html += `<tr><th align='left'>Descr. Doce</th><th align='left'>Qtd.</th><th align='left'>Valor unit.</th><th align='left'>Valor total</th></tr>`;
        html += `<tr><td colspan=4><hr></td></tr>`;
        composition.forEach(item => {
            const subtotal = (item.PRECO - item.PRECO * (item.DESCONTO / 100)) * item.QUANTIDADE;
            const calculo = (item.PRECO - item.PRECO * (item.DESCONTO / 100));
            totalKit += subtotal;
            qtdTotal += item.QUANTIDADE;
            html += `<tr><td>${item.NOME_DOCE}</td><td>${item.QUANTIDADE}</td><td>R$ ${calculo.toFixed(2)}</td><td>R$ ${subtotal.toFixed(2)}</td></tr>`;
        });
        html += `<tr><td colspan=4><hr></td></tr>`;
        html += `<tr><td>&nbsp;</td><td>${qtdTotal}</td><td>&nbsp;</td><td>R$ ${totalKit.toFixed(2)}</td></tr></table>`;
    } else {
        html += `<p>Este kit não possui itens.</p>`;
    }

    html += `</div>`;
    return html;
}

/**
 * Gera o cabeçalho e rodapé do HTML para as páginas de visualização.
 * @param {string} content - O conteúdo principal da página (os blocos dos kits).
 * @param {object} req - O objeto de requisição do Express.
 * @returns {string} - O HTML completo da página.
 */
function generateFullHtmlPage(content, req) {
    const host = req.protocol + '://' + req.get('host');
    const headerImageUrl = process.env.HEADER_IMAGE_URL || `${host}/logo_lucimaranovaesdoces_2.png`;
    const footerPhone = process.env.FOOTER_PHONE || '(11) 96901-5853';
    const footerEmail = process.env.FOOTER_EMAIL || 'rafmth@gmail.com';
    const footerCompanyName = process.env.FOOTER_COMPANY_NAME || 'Lucimara Novaes Doces';
    const currentYear = new Date().getFullYear();

    return `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Visualização de Kits</title><style>
            body { font-family: Arial, sans-serif; margin: 0; background-color: #f4f4f9; color: #333; }
            .header-image-container { text-align: center; padding: 10px 0; background-color: #fff; border-bottom: 1px solid #eee; }
            .header-image { max-width: 100%; height: auto; }
            .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; margin: 20px auto; }
            h1 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { color: #555; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 8px; padding: 5px 0; border-bottom: 1px dotted #eee; }
            li:last-child { border-bottom: none; }
            .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 1.0em; color: #28a745; }
            footer { text-align: center; margin-top: 30px; padding: 15px; background-color: #343a40; color: white; font-size: 0.9em; }
            footer a { color: #007bff; text-decoration: none; }
            footer a:hover { text-decoration: underline; }
            table { border-collapse: collapse; margin-top: 15px; }
            th, td { padding: 8px; text-align: left; }
        </style></head>
        <body>
            <div class="header-image-container">
                <img src="${headerImageUrl}" width="150" height="50" alt="Logo da Empresa" class="header-image">
            </div>
            ${content}
            <footer>
                <p>Entre em contato: ${footerPhone} | <a href="mailto:${footerEmail}">${footerEmail}</a></p>
                <p>&copy; ${currentYear} ${footerCompanyName}. Todos os direitos reservados.</p>
            </footer>
        </body></html>
    `;
}

const compositionSql = `
    SELECT c.COD_KIT, c.COD_DOCE, c.QUANTIDADE, c.DESCONTO, d.DESCRICAO as NOME_DOCE, d.PRECO 
    FROM tb_kit_composicao c
    JOIN TB_DOCES d ON c.COD_DOCE = d.COD_DOCE
    WHERE c.COD_KIT = ?
`;

// ==========================================
// ROTAS PARA VISUALIZAÇÃO DE KIT
// ==========================================
app.get('/kits/:id/visualizacao', (req, res) => {
    const host = req.protocol + '://' + req.get('host'); // Obtém o host dinamicamente
    // Variáveis de ambiente para configuração
    const headerImageUrl = process.env.HEADER_IMAGE_URL || `${host}/logo_lucimaranovaesdoces_2.png`; // Usa URL absoluta
    const footerPhone = process.env.FOOTER_PHONE || '(11) 96901-5853';
    const footerEmail = process.env.FOOTER_EMAIL || 'rafmth@gmail.com';
    const footerCompanyName = process.env.FOOTER_COMPANY_NAME || 'Lucimara Novaes Doces';
    const currentYear = new Date().getFullYear();

    const kitId = req.params.id;

    // 1. Busca a descrição do Kit
    db.get("SELECT COD_KIT, DESCRICAO FROM TB_KITS WHERE COD_KIT = ?", [kitId], (err, kitRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!kitRow) return res.status(404).json({ message: "Kit não encontrado." });

        // 2. Busca a composição do Kit
        db.all(compositionSql, [kitId], (err, compositionRows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const kitHtmlBlock = generateKitHtmlBlock(kitRow, compositionRows);
            const fullHtml = generateFullHtmlPage(kitHtmlBlock, req);

            res.status(200).type('text/html').send(fullHtml);
        });
    });
});

// Rota para visualizar TODOS os kits
app.get('/kits/visualizacao/todos', async (req, res) => {
    try {
        const kits = await db.allAsync("SELECT COD_KIT, DESCRICAO FROM TB_KITS ORDER BY DESCRICAO", []);
        let allKitsHtml = '';

        for (const kit of kits) {
            const composition = await db.allAsync(compositionSql, [kit.COD_KIT]);
            allKitsHtml += generateKitHtmlBlock(kit, composition);
        }

        const fullHtml = generateFullHtmlPage(allKitsHtml, req);
        res.status(200).type('text/html').send(fullHtml);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rota para visualizar kits SELECIONADOS
app.get('/kits/visualizacao/selecionados', async (req, res) => {
    try {
        const ids = req.query.ids;
        if (!ids) {
            return res.status(400).json({ error: 'Nenhum ID de kit foi fornecido.' });
        }

        const idArray = ids.split(',').map(Number);
        // Cria placeholders (?) para a consulta SQL
        const placeholders = idArray.map(() => '?').join(',');

        const kits = await db.allAsync(`SELECT COD_KIT, DESCRICAO FROM TB_KITS WHERE COD_KIT IN (${placeholders})`, idArray);
        let selectedKitsHtml = '';

        for (const kit of kits) {
            const composition = await db.allAsync(compositionSql, [kit.COD_KIT]);
            selectedKitsHtml += generateKitHtmlBlock(kit, composition);
        }

        const fullHtml = generateFullHtmlPage(selectedKitsHtml, req);
        res.status(200).type('text/html').send(fullHtml);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ROTAS PARA GERAR PDF DO KIT
// ==========================================

// Helper function to generate PDF from a URL
async function generatePdfFromUrl(url, res, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Falha ao obter a visualização HTML de ${url}: ${response.statusText}`, errorText);
            return res.status(response.status).json({ error: `Falha ao obter a visualização HTML: ${response.statusText}` });
        }
        const htmlContent = await response.text();

        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(`Erro ao gerar PDF para ${filename}:`, error);
        res.status(500).json({ error: `Falha ao gerar PDF.` });
    }
}

// Rota para PDF de um único kit
app.get('/kits/:id/pdf', async (req, res) => {
    const kitId = req.params.id;
    const htmlUrl = `${req.protocol}://${req.get('host')}/kits/${kitId}/visualizacao`;
    await generatePdfFromUrl(htmlUrl, res, `kit_${kitId}.pdf`);
});

// Rota para PDF de TODOS os kits
app.get('/kits/pdf/todos', async (req, res) => {
    const htmlUrl = `${req.protocol}://${req.get('host')}/kits/visualizacao/todos`;
    await generatePdfFromUrl(htmlUrl, res, `todos_os_kits.pdf`);
});

// Rota para PDF de kits SELECIONADOS
app.get('/kits/pdf/selecionados', async (req, res) => {
    const ids = req.query.ids;
    if (!ids) return res.status(400).json({ error: 'Nenhum ID de kit foi fornecido.' });
    
    const htmlUrl = `${req.protocol}://${req.get('host')}/kits/visualizacao/selecionados?ids=${ids}`;
    await generatePdfFromUrl(htmlUrl, res, `kits_selecionados.pdf`);
});

// ==========================================
// ROTAS PARA GERAR ORÇAMENTO
// ==========================================

/**
 * Gera o HTML para a página de orçamento.
 * @param {object} orcamentoData - Os dados do orçamento vindos do frontend.
 * @param {object} req - O objeto de requisição do Express.
 * @returns {string} - O HTML completo da página de orçamento.
 */
function generateOrcamentoHtml(orcamentoData, req) {
    const { items, subTotal, descontoGeral, totalComDesconto, frete, totalFinal, cliente, validade, observacoes } = orcamentoData;
    const host = req.protocol + '://' + req.get('host');
    const headerImageUrl = `${host}/logo_lucimaranovaesdoces_2.png`;
    const currentYear = new Date().getFullYear();

    let itemsHtml = '';
    items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.precoUnitario.toFixed(2)}</td>
                <td>R$ ${item.subtotal.toFixed(2)}</td>
            </tr>
        `;
    });

    let validadeText = 'Orçamento válido por 7 dias.';
    if (validade) {
        // Formata a data de YYYY-MM-DD para DD/MM/YYYY
        const [year, month, day] = validade.split('-');
        validadeText = `Proposta válida até ${day}/${month}/${year}.`;
    }

    let observacoesHtml = '';
    if (observacoes) {
        observacoesHtml = `
            <div class="notes">
                <strong>Observações:</strong>
                <p>${observacoes.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #fafafa; 
                color: #074e6f; 
                margin: 0;
                padding: 20px;
            }
            .invoice-box { 
                max-width: 800px; 
                margin: auto; 
                padding: 30px; 
                border: 1px solid #eceff1; 
                box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12); 
                font-size: 14px; 
                line-height: 18px; 
                background: white;
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header img { width: 100%; max-width: 180px; }
            .header h1 { margin: 10px 0 0; color: #4e342e; font-weight: 400; }
            .details { margin-bottom: 20px; font-size: 0.95em; }
            .details-item { margin-bottom: 5px; }
            table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
            table td, table th { padding: 10px 13px; vertical-align: top; }
            .notes { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eceff1; font-size: 0.9em; color: #032738; }
            .notes p { margin: 5px 0 0; }
            .invoice-table tr { border-bottom: 1px solid #b5d7ee; }
            .invoice-table tr.heading th { background-color: #ffff; color: #4e342e; text-transform: uppercase; font-size: 12px; font-weight: 600; border-bottom: 2px solid #4e342e; }
            .totals-table { float: right; width: 45%; margin-top: 20px; }
            .totals-table td { text-align: right; padding: 8px 0; }
            .totals-table tr.strong td { font-weight: 600; color: #4e342e; }
            footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #b5d7ee; font-size: 0.9em; color: #032738; }
        </style>
        </head><body>
        <div class="invoice-box">
            <div class="header">
                <img src="${headerImageUrl}" alt="Logo">
                <h1>Proposta de Orçamento</h1>
            </div>
            ${cliente ? `<div class="details"><div class="details-item"><strong>Cliente:</strong> ${cliente}</div></div>` : ''}
            <table class="invoice-table">
                <tr class="heading"><th width="55%">Item</th><th width="15%">Qtd.</th><th width="15%">Valor Unit.</th><th width="15%">Subtotal</th></tr>
                ${itemsHtml}
            </table>
            <table class="totals-table">
                <tr><td>Subtotal:</td><td>R$ ${subTotal.toFixed(2)}</td></tr>
                <tr><td>Desconto Geral (${descontoGeral}%):</td><td>R$ ${(subTotal - totalComDesconto).toFixed(2)}</td></tr>
                <tr class="strong"><td>Total Parcial:</td><td>R$ ${totalComDesconto.toFixed(2)}</td></tr>
                <tr><td>Frete:</td><td>R$ ${frete.toFixed(2)}</td></tr>
                <tr class="strong" style="font-size: 1.0em;"><td>VALOR TOTAL:</td><td>R$ ${totalFinal.toFixed(2)}</td></tr>
            </table>
            <div style="clear:both;"></div>
            ${observacoesHtml}
            <footer>
                <p>${validadeText} &copy; ${currentYear} Lucimara Novaes Doces.</p>
            </footer>
        </div>
        </body></html>
    `;
}

app.post('/orcamento/visualizacao', (req, res) => {
    const orcamentoHtml = generateOrcamentoHtml(req.body, req);
    res.status(200).type('text/html').send(orcamentoHtml);
});

app.post('/orcamento/pdf', async (req, res) => {
    try {
        const orcamentoHtml = generateOrcamentoHtml(req.body, req);
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(orcamentoHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="orcamento.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Erro ao gerar PDF do orçamento:', error);
        res.status(500).json({ error: 'Falha ao gerar PDF do orçamento.' });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});