import html
import os
from datetime import datetime
from typing import Any, Dict, List
from models import OrcamentoPayload

def generate_kit_html_block(kit: Dict[str, Any], composition: List[Dict[str, Any]]) -> str:
    """Gera o bloco HTML para um único kit."""
    kit_desc = html.escape(str(kit.get("DESCRICAO", "")))
    out = [f"<h3>{kit_desc}</h3>"]
    total_kit = 0.0
    qtd_total = 0

    if composition:
        out.append("<table width='100%'>")
        out.append("<tr><th align='left'>Descr. Doce</th><th align='left'>Qtd.</th><th align='left'>Valor unit.</th><th align='left'>Valor total</th></tr>")
        out.append("<tr><td colspan=4><hr></td></tr>")

        for item in composition:
            nome_doce = html.escape(str(item.get("NOME_DOCE", "")))
            preco = float(item.get("PRECO", 0.0))
            desconto = float(item.get("DESCONTO", 0.0))
            quantidade = float(item.get("QUANTIDADE", 0))

            calculo = preco - preco * (desconto / 100.0)
            subtotal = calculo * quantidade
            total_kit += subtotal
            qtd_total += int(quantidade) if quantidade.is_integer() else quantidade

            out.append(
                f"<tr><td>{nome_doce}</td><td>{quantidade:g}</td><td>R$ {calculo:.2f}</td><td>R$ {subtotal:.2f}</td></tr>"
            )

        out.append("<tr><td colspan=4><hr></td></tr>")
        out.append(f"<tr><td>&nbsp;</td><td>{qtd_total:g}</td><td>&nbsp;</td><td>R$ {total_kit:.2f}</td></tr></table>")
    else:
        out.append("<p>Este kit não possui itens cadastrados.</p>")

    return "".join(out)

def generate_doce_html_block(doce: Dict[str, Any]) -> str:
    """Gera o bloco HTML para um único doce individual."""
    descricao = html.escape(str(doce.get("DESCRICAO", "")))
    preco = float(doce.get("PRECO", 0.0))
    return f"""
        <div class="container doce-item">
            <h3>{descricao}</h3>
            <p><strong>Preço:</strong> R$ {preco:.2f}</p>
            <p>Um doce delicioso, perfeito para qualquer ocasião.</p>
            <div class="doce-image-placeholder">
            </div>
        </div>
    """

def generate_full_catalog_page(content: str, base_url: str) -> str:
    """Gera a página HTML completa para visualização do catálogo."""
    header_image_url = os.getenv("HEADER_IMAGE_URL", f"{base_url}/logo.png")
    footer_phone = os.getenv("FOOTER_PHONE", "(11) 96901-5853")
    footer_email = os.getenv("FOOTER_EMAIL", "rafmth@gmail.com")
    footer_company_name = os.getenv("FOOTER_COMPANY_NAME", "Lucimara Novaes Doces")
    current_year = datetime.now().year

    return f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Catálogo de Produtos</title><style>
            body {{ font-family: Arial, sans-serif; margin: 0; background-color: #f4f4f9; color: #333; }}
            .header-image-container {{ text-align: center; padding: 10px 0; background-color: #fff; border-bottom: 1px solid #eee; }}
            .header-image {{ max-width: 100%; height: auto; }}
            .container {{ background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; margin: 20px auto; }}
            h1 {{ color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }}
            h2 {{ color: #555; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }}
            ul {{ list-style: none; padding: 0; }}
            li {{ margin-bottom: 8px; padding: 5px 0; border-bottom: 1px dotted #eee; }}
            li:last-child {{ border-bottom: none; }}
            .total {{ font-weight: bold; text-align: right; margin-top: 20px; font-size: 1.0em; color: #28a745; }}
            footer {{ text-align: center; margin-top: 30px; padding: 15px; background-color: #343a40; color: white; font-size: 0.9em; }}
            footer a {{ color: #007bff; text-decoration: none; }}
            footer a:hover {{ text-decoration: underline; }}
            
            /* Estilos para o catálogo */
            .catalog-section {{ margin-bottom: 40px; }}
            .catalog-section h2 {{ text-align: center; color: #4e342e; margin-bottom: 25px; font-size: 1.8em; }}
            .kits-grid, .doces-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 25px;
                padding: 0 20px;
            }}
            .kit-item, .doce-item {{
                background-color: #fff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border: 1px solid #e0e0e0;
            }}
            .doce-item h3 {{ margin-top: 0; color: #6d4c41; }}
            table {{ border-collapse: collapse; margin-top: 15px; }}
            th, td {{ padding: 8px; text-align: left; }}
        </style></head>
        <body>
            <div class="header-image-container">
                <img src="{header_image_url}" width="150" height="50" alt="Logo da Empresa" class="header-image">
            </div>
            {content}
            <footer>
                <p>Entre em contato: {footer_phone} | <a href="mailto:{footer_email}">{footer_email}</a></p>
                <p>&copy; {current_year} {footer_company_name}. Todos os direitos reservados.</p>
            </footer>
        </body></html>"""

def generate_orcamento_html(data: OrcamentoPayload, base_url: str) -> str:
    """Gera o HTML para a página de orçamento."""
    header_image_url = os.getenv("HEADER_IMAGE_URL", f"{base_url}/logo.png")
    current_year = datetime.now().year

    items_html_list = []
    for item in data.items:
        nome_item = html.escape(str(item.nome))
        items_html_list.append(f"""
            <tr>
                <td>{nome_item}</td>
                <td>{item.quantidade:g}</td>
                <td>R$ {item.precoUnitario:.2f}</td>
                <td>R$ {item.subtotal:.2f}</td>
            </tr>
        """)
    items_html = "".join(items_html_list)

    validade_text = "Orçamento válido por 7 dias."
    if data.validade:
        parts = data.validade.strip().split("-")
        if len(parts) == 3:
            year, month, day = parts
            validade_text = f"Proposta válida até {day}/{month}/{year}."
        else:
            validade_text = f"Proposta válida até {html.escape(data.validade)}."

    observacoes_html = ""
    if data.observacoes:
        escaped_obs = html.escape(data.observacoes).replace("\n", "<br>")
        observacoes_html = f"""
            <div class="notes">
                <strong>Observações:</strong>
                <p>{escaped_obs}</p>
            </div>
        """

    cliente_html = ""
    if data.cliente:
        cliente_html = f"""<div class="details"><div class="details-item"><strong>Cliente:</strong> {html.escape(data.cliente)}</div></div>"""

    desconto_valor = data.subTotal - data.totalComDesconto

    return f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento</title>
        <style>
            body {{ 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #fafafa; 
                color: #074e6f; 
                margin: 0;
                padding: 20px;
            }}
            .invoice-box {{ 
                max-width: 800px; 
                margin: auto; 
                padding: 30px; 
                border: 1px solid #eceff1; 
                box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12); 
                font-size: 14px; 
                line-height: 18px; 
                background: white;
            }}
            .header {{ text-align: center; margin-bottom: 20px; }}
            .header img {{ width: 100%; max-width: 180px; }}
            .header h1 {{ margin: 10px 0 0; color: #4e342e; font-weight: 400; }}
            .details {{ margin-bottom: 20px; font-size: 0.95em; }}
            .details-item {{ margin-bottom: 5px; }}
            table {{ width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }}
            table td, table th {{ padding: 10px 13px; vertical-align: top; }}
            .notes {{ margin-top: 30px; padding-top: 15px; border-top: 1px solid #eceff1; font-size: 0.9em; color: #032738; }}
            .notes p {{ margin: 5px 0 0; }}
            .invoice-table tr {{ border-bottom: 1px solid #b5d7ee; }}
            .invoice-table tr.heading th {{ background-color: #ffff; color: #4e342e; text-transform: uppercase; font-size: 12px; font-weight: 600; border-bottom: 2px solid #4e342e; }}
            .totals-table {{ float: right; width: 45%; margin-top: 20px; }}
            .totals-table td {{ text-align: right; padding: 8px 0; }}
            .totals-table tr.strong td {{ font-weight: 600; color: #4e342e; }}
            footer {{ text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #b5d7ee; font-size: 0.9em; color: #032738; }}
        </style>
        </head><body>
        <div class="invoice-box">
            <div class="header">
                <img src="{header_image_url}" alt="Logo">
                <h1>Proposta de Orçamento</h1>
            </div>
            {cliente_html}
            <table class="invoice-table">
                <tr class="heading"><th width="55%">Item</th><th width="15%">Qtd.</th><th width="15%">Valor Unit.</th><th width="15%">Subtotal</th></tr>
                {items_html}
            </table>
            <table class="totals-table">
                <tr><td>Subtotal:</td><td>R$ {data.subTotal:.2f}</td></tr>
                <tr><td>Desconto Geral ({data.descontoGeral:g}%):</td><td>R$ {desconto_valor:.2f}</td></tr>
                <tr class="strong"><td>Total Parcial:</td><td>R$ {data.totalComDesconto:.2f}</td></tr>
                <tr><td>Frete:</td><td>R$ {data.frete:.2f}</td></tr>
                <tr class="strong" style="font-size: 1.0em;"><td>VALOR TOTAL:</td><td>R$ {data.totalFinal:.2f}</td></tr>
            </table>
            <div style="clear:both;"></div>
            {observacoes_html}
            <footer>
                <p>{validade_text} &copy; {current_year} Lucimara Novaes Doces.</p>
            </footer>
        </div>
        </body></html>"""
