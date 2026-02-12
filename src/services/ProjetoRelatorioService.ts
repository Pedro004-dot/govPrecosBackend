import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import path from 'path';
import { ProjetoRepository } from '../repositories/ProjetoRepository';
import { ProjetoItemRepository } from '../repositories/ProjetoItemRepository';
import { ItemFonteRepository } from '../repositories/ItemFonteRepository';

/**
 * Serviço para geração de relatórios de projetos em PDF.
 * Conforme Lei 14.133/2021 - Pesquisa de Preços com fontes PNCP.
 */
export class ProjetoRelatorioService {
  // Paleta de cores GovPreços
  private readonly cores = {
    navyEscuro: '#0A3D62',      // Azul navy da marca (principal)
    azulBrand: '#4D8EFF',       // Azul elétrico (logo / destaques)
    verdeCheck: '#27AE60',      // Verde do checkmark do logo
    verdeCheckBg: '#27AE6026',  // Verde transparente (fundo do badge)
    preto: '#000000',
    cinzaEscuro: '#374151',
    cinza: '#9ca3af',
    cinzaClaro: '#f3f4f6',
    cinzaMedio: '#e5e7eb',
    branco: '#ffffff',
  };

  private paginaAtual = 0;
  private nomeProjeto = '';

  constructor(
    private readonly projetoRepository: ProjetoRepository,
    private readonly projetoItemRepository: ProjetoItemRepository,
    private readonly itemFonteRepository: ItemFonteRepository
  ) {}

  /**
   * Gera relatório PDF para um projeto.
   * Retorna um stream de bytes do PDF.
   */
  public async gerarPDF(projetoId: string): Promise<Buffer> {
    const projeto = await this.projetoRepository.buscarPorId(projetoId);
    if (!projeto) {
      throw new Error('Projeto não encontrado');
    }

    const itens = await this.projetoItemRepository.listarPorProjeto(projetoId);

    const itensComFontes = await Promise.all(
      itens.map(async (item) => {
        if (!item.id) {
          throw new Error('Item sem ID encontrado no projeto');
        }
        const fontes = await this.itemFonteRepository.listarFontesPorItem(item.id);
        return { item, fontes };
      })
    );

    const valorTotalProjeto = itens.reduce((sum, item) => {
      return sum + (item.medianaCalculada ? item.medianaCalculada * item.quantidade : 0);
    }, 0);

    this.paginaAtual = 0;
    this.nomeProjeto = projeto.nome;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: 'A4',
          bufferPages: true,
        });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // CAPA
        this.novaPagina(doc, false);
        this.adicionarCapa(doc, projeto, itens);

        // RESUMO EXECUTIVO
        this.novaPagina(doc, true);
        this.adicionarResumoExecutivo(doc, projeto, itens, itensComFontes);

        // METODOLOGIA
        this.novaPagina(doc, true);
        this.adicionarMetodologia(doc);

        // ITENS E FONTES
        itensComFontes.forEach((itemComFontes) => {
          this.novaPagina(doc, true);
          this.adicionarItem(doc, itemComFontes.item, itemComFontes.fontes, valorTotalProjeto);
        });

        // RESUMO FINANCEIRO
        this.novaPagina(doc, true);
        this.adicionarResumoFinanceiro(doc, itens);

        // EXTRATO DE FONTES
        this.novaPagina(doc, true);
        this.adicionarExtratoFontes(doc);

        // ASSINATURA
        this.novaPagina(doc, true);
        this.adicionarSecaoAssinatura(doc, projeto);

        // Numeração de páginas (pula capa)
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
          doc.switchToPage(i);
          if (i > 0) {
            this.adicionarRodape(doc, i + 1, range.count);
          }
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ========================================================
  // LOGO — imagens PNG embedadas
  // ========================================================

  private readonly logoPath       = path.join(__dirname, '../assets/logo-symbol.png');
  private readonly logoBrancoPath = path.join(__dirname, '../assets/logo-branco.png');

  /**
   * Embeds the GovPreços logo PNG at the given position.
   * @param doc     PDFKit document
   * @param x       left edge
   * @param y       top edge
   * @param size    desired height in points (width scales proportionally)
   * @param onDark  if true, uses the white variant
   */
  private desenharLogo(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    size: number,
    onDark: boolean = false
  ) {
    try {
      const src = onDark ? this.logoBrancoPath : this.logoPath;
      doc.image(src, x, y, { height: size });
    } catch {
      // fallback: draw a simple placeholder if image is missing
      doc.rect(x, y, size, size).stroke(onDark ? this.cores.branco : this.cores.azulBrand);
    }
  }

  // ========================================================
  // LAYOUT AUXILIARES
  // ========================================================

  private novaPagina(doc: PDFKit.PDFDocument, comCabecalho: boolean = true) {
    if (this.paginaAtual > 0) {
      doc.addPage();
    }
    this.paginaAtual++;

    if (comCabecalho) {
      this.adicionarCabecalho(doc);
    }
  }

  private adicionarCabecalho(doc: PDFKit.PDFDocument) {
    const y = 20;
    const pageWidth = doc.page.width;

    // Faixa superior estreita na cor navy
    doc.rect(0, 0, pageWidth, 42).fill(this.cores.navyEscuro);

    // Micro logo (20px alto)
    this.desenharLogo(doc, 50, 11, 20, true);

    // "GovPreços" em branco
    doc.fontSize(8).font('Helvetica-Bold').fillColor(this.cores.branco);
    doc.text('GOV', 74, 19, { continued: true });
    doc.font('Helvetica').fillColor('#cce0ff');
    doc.text('PREÇOS', { continued: false });

    // Nome do projeto à direita
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.7)');
    doc.text(this.nomeProjeto, 50, 31, {
      width: pageWidth - 100,
      align: 'right',
    });

    doc.fillColor(this.cores.preto);
    doc.y = 55;
  }

  private adicionarRodape(doc: PDFKit.PDFDocument, numeroPagina: number, totalPaginas: number) {
    const pageWidth = doc.page.width;
    const y = doc.page.height - 38;

    // Linha
    doc.strokeColor(this.cores.cinzaMedio).lineWidth(0.5);
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).stroke();

    doc.fontSize(7.5).fillColor(this.cores.cinza).font('Helvetica');

    // Esquerda: sistema
    doc.text('GovPreços — Sistema de Pesquisa de Preços (PNCP)', 50, y + 6, {
      width: 260,
      align: 'left',
    });

    // Centro: página
    doc.text(`Página ${numeroPagina} de ${totalPaginas}`, 50, y + 6, {
      width: pageWidth - 100,
      align: 'center',
    });

    // Direita: data
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 50, y + 6, {
      width: pageWidth - 100,
      align: 'right',
    });

    doc.fillColor(this.cores.preto);
  }

  // ========================================================
  // CAPA
  // ========================================================

  private adicionarCapa(doc: PDFKit.PDFDocument, projeto: any, itens: any[]) {
    const pageWidth  = doc.page.width;
    const pageHeight = doc.page.height;

    // ── Faixa de marca (header) ──────────────────────────────
    const headerH = 130;
    doc.rect(0, 0, pageWidth, headerH).fill(this.cores.navyEscuro);

    // Acento azul elétrico — barra lateral esquerda
    doc.rect(0, 0, 5, headerH).fill(this.cores.azulBrand);

    // Logo PNG (80px alto), centrado verticalmente na faixa
    const logoSize = 80;
    const logoX = 20;
    const logoY = (headerH - logoSize) / 2;
    this.desenharLogo(doc, logoX, logoY, logoSize, true);

    // Wordmark: "GOV" + "PREÇOS" (placed to the right of the logo)
    const wordX = logoX + logoSize + 16;
    const wordY = logoY + 6;

    doc.fontSize(30).font('Helvetica-Bold').fillColor(this.cores.branco);
    doc.text('GOV', wordX, wordY, { continued: true });
    doc.font('Helvetica').fillColor('#a8c8ff');
    doc.text('PREÇOS');

    // Tagline
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.55)');
    doc.text('PESQUISA DE PREÇOS', wordX, wordY + 38, { characterSpacing: 1.5 });

    // Linha divisória verde
    const divY = headerH - 3;
    doc.rect(0, divY, pageWidth, 3).fill(this.cores.verdeCheck);

    // ── Subtítulo do documento ───────────────────────────────
    doc.y = headerH + 40;
    doc.fontSize(22).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text('RELATÓRIO DE', { align: 'center', width: pageWidth });

    doc.fontSize(22).font('Helvetica-Bold').fillColor(this.cores.azulBrand);
    doc.text('PESQUISA DE PREÇOS', { align: 'center', width: pageWidth });

    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').fillColor(this.cores.cinzaEscuro);
    doc.text('Conforme Lei 14.133/2021 e IN nº 65/2021', {
      align: 'center',
      width: pageWidth,
    });

    // Linha decorativa
    doc.moveDown(1.5);
    const lineY = doc.y;
    doc.save();
    doc.strokeColor(this.cores.azulBrand).lineWidth(1.5);
    doc.moveTo(120, lineY).lineTo(pageWidth - 120, lineY).stroke();
    doc.restore();

    // ── Card de identificação do projeto ──────────────────────
    const cardX = 70;
    const cardY = lineY + 20;
    const cardW = pageWidth - 140;
    const cardH = 230;

    // Sombra suave
    doc.save();
    doc.fillOpacity(0.06);
    doc.roundedRect(cardX + 3, cardY + 4, cardW, cardH, 4).fill(this.cores.preto);
    doc.fillOpacity(1);
    doc.restore();

    // Card body
    doc.roundedRect(cardX, cardY, cardW, cardH, 4)
      .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);

    // Cabeçalho do card (faixa navy fina)
    doc.save();
    doc.roundedRect(cardX, cardY, cardW, 32, 4).fill(this.cores.navyEscuro);
    // Cobrir cantos inferiores arredondados do topo com um rect sólido
    doc.rect(cardX, cardY + 20, cardW, 12).fill(this.cores.navyEscuro);
    doc.restore();

    doc.fontSize(10).font('Helvetica-Bold').fillColor(this.cores.branco);
    doc.text('IDENTIFICAÇÃO DO PROJETO', cardX + 20, cardY + 10, {
      width: cardW - 40,
      align: 'left',
    });

    // Campos do projeto
    let fieldY = cardY + 46;
    const labelX = cardX + 20;
    const valueX = cardX + 140;
    const valueW = cardW - 160;

    const field = (label: string, value: string) => {
      doc.fontSize(8.5).font('Helvetica').fillColor(this.cores.cinza);
      doc.text(label, labelX, fieldY);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(this.cores.cinzaEscuro);
      doc.text(value, valueX, fieldY - 1, { width: valueW });
      fieldY += 22;

      // Linha separadora leve
      doc.strokeColor(this.cores.cinzaClaro).lineWidth(0.5);
      doc.moveTo(labelX, fieldY - 6).lineTo(cardX + cardW - 20, fieldY - 6).stroke();
    };

    field('Projeto:', projeto.nome);
    if (projeto.numeroProcesso) field('Nº Processo:', projeto.numeroProcesso);
    if (projeto.objeto) {
      doc.fontSize(8.5).font('Helvetica').fillColor(this.cores.cinza);
      doc.text('Objeto:', labelX, fieldY);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(this.cores.cinzaEscuro);
      doc.text(projeto.objeto, valueX, fieldY - 1, { width: valueW, lineGap: 1 });
      fieldY += 34;
      doc.strokeColor(this.cores.cinzaClaro).lineWidth(0.5);
      doc.moveTo(labelX, fieldY - 6).lineTo(cardX + cardW - 20, fieldY - 6).stroke();
    }
    field('Status:', this.traduzirStatus(projeto.status));
    if (projeto.dataFinalizacao) {
      field('Finalizado em:', new Date(projeto.dataFinalizacao).toLocaleDateString('pt-BR'));
    }
    field('Total de Itens:', itens.length.toString());

    // ── Rodapé da capa ────────────────────────────────────────
    doc.y = pageHeight - 70;
    doc.fontSize(8).font('Helvetica').fillColor(this.cores.cinza);
    doc.text(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, {
      align: 'center',
      width: pageWidth,
    });
    doc.moveDown(0.4);
    doc.fontSize(7.5);
    doc.text('GovPreços — Portal Nacional de Contratações Públicas (PNCP)', {
      align: 'center',
      width: pageWidth,
    });

    doc.fillColor(this.cores.preto);
  }

  // ========================================================
  // RESUMO EXECUTIVO
  // ========================================================

  private adicionarResumoExecutivo(
    doc: PDFKit.PDFDocument,
    projeto: any,
    itens: any[],
    itensComFontes: any[]
  ) {
    this.adicionarTituloSecao(doc, 'RESUMO EXECUTIVO');

    const totalItens      = itens.length;
    const itensComMediana = itens.filter(i => i.medianaCalculada).length;
    const valorTotal      = itens.reduce((sum, item) => {
      return sum + (item.medianaCalculada ? item.medianaCalculada * item.quantidade : 0);
    }, 0);
    const totalFontes = itensComFontes.reduce((sum, i) => sum + i.fontes.length, 0);

    const cardWidth  = (doc.page.width - 130) / 2;
    const cardHeight = 70;
    const startX     = 50;
    const startY     = doc.y;

    this.desenharCard(doc, startX,                 startY,                    cardWidth, cardHeight,
      'Total de Itens', totalItens.toString(), this.cores.navyEscuro);

    this.desenharCard(doc, startX + cardWidth + 20, startY,                   cardWidth, cardHeight,
      'Valor Total Estimado', `R$ ${this.formatarMoeda(valorTotal)}`, this.cores.azulBrand);

    this.desenharCard(doc, startX,                 startY + cardHeight + 14,  cardWidth, cardHeight,
      'Itens Precificados', `${itensComMediana} de ${totalItens}`, this.cores.navyEscuro);

    this.desenharCard(doc, startX + cardWidth + 20, startY + cardHeight + 14, cardWidth, cardHeight,
      'Total de Fontes PNCP', totalFontes.toString(), this.cores.verdeCheck);

    doc.y = startY + (cardHeight * 2) + 30;

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text('Informações do Projeto');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    this.adicionarLinha(doc, 'Projeto:', projeto.nome);
    if (projeto.numeroProcesso) this.adicionarLinha(doc, 'Nº Processo:', projeto.numeroProcesso);
    if (projeto.objeto)         this.adicionarLinha(doc, 'Objeto:', projeto.objeto);
    this.adicionarLinha(doc, 'Status:', this.traduzirStatus(projeto.status));
    if (projeto.dataFinalizacao) {
      this.adicionarLinha(doc, 'Finalizado em:',
        new Date(projeto.dataFinalizacao).toLocaleDateString('pt-BR'));
    }
  }

  private desenharCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    titulo: string,
    valor: string,
    cor: string
  ) {
    // Borda + fundo branco
    doc.roundedRect(x, y, width, height, 3)
      .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);

    // Acento lateral colorido
    doc.save();
    doc.roundedRect(x, y, 4, height, 2).fill(cor);
    doc.rect(x + 2, y, 2, height).fill(cor); // cobrir canto arredondado direito do acento
    doc.restore();

    doc.fontSize(8.5).fillColor(this.cores.cinza).font('Helvetica');
    doc.text(titulo, x + 16, y + 14, { width: width - 26 });

    doc.fontSize(18).fillColor(cor).font('Helvetica-Bold');
    doc.text(valor, x + 16, y + 30, { width: width - 26 });
  }

  private adicionarLinha(doc: PDFKit.PDFDocument, label: string, valor: string) {
    const y = doc.y;
    doc.font('Helvetica').fillColor(this.cores.cinzaEscuro);
    doc.text(label, 50, y, { continued: true, width: 150 });
    doc.font('Helvetica-Bold').fillColor(this.cores.preto);
    doc.text(' ' + valor, { width: 350 });
  }

  // ========================================================
  // METODOLOGIA
  // ========================================================

  private adicionarMetodologia(doc: PDFKit.PDFDocument) {
    this.adicionarTituloSecao(doc, 'METODOLOGIA DE PESQUISA');

    doc.fontSize(10).fillColor(this.cores.preto).font('Helvetica');
    doc.text(
      'Este relatório foi elaborado em conformidade com a Lei Federal nº 14.133/2021, que estabelece normas gerais de licitação e contratação para as administrações públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios, bem como em alinhamento com a Instrução Normativa nº 65, de 07 de julho de 2021.',
      { align: 'justify' }
    );

    doc.moveDown(1.5);
    this.adicionarSubtituloSecao(doc, 'Base Legal');

    doc.fontSize(10).fillColor(this.cores.preto).font('Helvetica');
    doc.text(
      'A pesquisa de preços foi realizada utilizando dados públicos do Portal Nacional de Contratações Públicas (PNCP), conforme determinado pela legislação vigente e pelo art. 5º, inciso I, da Instrução Normativa nº 65/2021, que trata das fontes válidas para composição do valor estimado.',
      { align: 'justify' }
    );

    doc.moveDown(1.5);
    this.adicionarSubtituloSecao(doc, 'Critérios de Seleção');

    doc.fontSize(10).font('Helvetica').fillColor(this.cores.preto);
    const criterios = [
      'Mínimo de 3 (três) fontes de preços para cada item, quando possível',
      'Fontes provenientes do PNCP (Portal Nacional de Contratações Públicas)',
      'Preferência por licitações recentes (últimos 12 meses)',
      'Cálculo de mediana para determinação do preço estimado',
      'Exclusão de outliers devidamente justificados, quando aplicável',
    ];

    criterios.forEach((criterio, index) => {
      doc.text(`${index + 1}. ${criterio}`, { indent: 10 });
      doc.moveDown(0.5);
    });

    doc.moveDown(0.5);
    this.adicionarSubtituloSecao(doc, 'Cálculo da Mediana');

    doc.fontSize(10).fillColor(this.cores.preto).font('Helvetica');
    doc.text(
      'A mediana foi utilizada como medida central de tendência por ser mais robusta a valores extremos (outliers) do que a média aritmética. O cálculo considera apenas as fontes não excluídas, garantindo maior precisão na estimativa de preço, em consonância com o art. 3º, inciso V, da Instrução Normativa nº 65/2021, que exige a explicitação do método matemático aplicado para definição do valor estimado.',
      { align: 'justify' }
    );
  }

  // ========================================================
  // ITENS
  // ========================================================

  private adicionarItem(
    doc: PDFKit.PDFDocument,
    item: any,
    fontes: any[],
    valorTotalProjeto: number
  ) {
    // Título do item
    doc.fontSize(15).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text(`ITEM: ${item.nome}`);
    doc.moveDown(0.3);

    doc.strokeColor(this.cores.azulBrand).lineWidth(1.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica').fillColor(this.cores.preto);
    if (item.descricao) {
      doc.fillColor(this.cores.cinzaEscuro);
      doc.text('Descrição: ', 50, doc.y, { continued: true });
      doc.fillColor(this.cores.preto);
      doc.text(item.descricao);
      doc.moveDown(0.5);
    }

    doc.fillColor(this.cores.cinzaEscuro);
    doc.text('Quantidade: ', 50, doc.y, { continued: true });
    doc.fillColor(this.cores.preto);
    doc.text(`${item.quantidade} ${item.unidadeMedida}`);
    doc.moveDown(0.5);

    const totalFontes         = fontes.length;
    const fontesNaoExcluidas  = fontes.filter(f => !f.ignoradoCalculo);
    const valorUnitarioMediana = item.medianaCalculada || 0;
    const valorTotalItem       = valorUnitarioMediana * item.quantidade;
    const percentualGlobal     = valorTotalProjeto > 0 && valorTotalItem > 0
      ? (valorTotalItem / valorTotalProjeto) * 100
      : 0;

    doc.fontSize(9).font('Helvetica').fillColor(this.cores.cinzaEscuro);
    doc.text(
      `Fontes consideradas no cálculo: ${fontesNaoExcluidas.length} de ${totalFontes} (PNCP)`,
    );
    if (percentualGlobal > 0) {
      doc.moveDown(0.2);
      doc.text(
        `Participação do item no valor total estimado da cotação: ${percentualGlobal.toFixed(2)}%`,
      );
    }

    doc.moveDown(0.8);

    // Caixas de valor
    if (item.medianaCalculada) {
      const boxesY   = doc.y;
      const boxWidth = (doc.page.width - 120) / 2;

      // Preço unitário
      doc.roundedRect(50, boxesY, boxWidth, 55, 3)
        .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);
      doc.save();
      doc.roundedRect(50, boxesY, 4, 55, 2).fill(this.cores.navyEscuro);
      doc.rect(52, boxesY, 2, 55).fill(this.cores.navyEscuro);
      doc.restore();
      doc.fontSize(8.5).fillColor(this.cores.cinzaEscuro).font('Helvetica');
      doc.text('Preço Estimado (Mediana)', 62, boxesY + 12);
      doc.fontSize(17).fillColor(this.cores.navyEscuro).font('Helvetica-Bold');
      doc.text(`R$ ${this.formatarMoeda(item.medianaCalculada)}`, 62, boxesY + 28);

      // Valor total
      doc.roundedRect(70 + boxWidth, boxesY, boxWidth, 55, 3)
        .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);
      doc.save();
      doc.roundedRect(70 + boxWidth, boxesY, 4, 55, 2).fill(this.cores.azulBrand);
      doc.rect(72 + boxWidth, boxesY, 2, 55).fill(this.cores.azulBrand);
      doc.restore();
      doc.fontSize(8.5).fillColor(this.cores.cinzaEscuro).font('Helvetica');
      doc.text('Valor Total Estimado', 82 + boxWidth, boxesY + 12);
      doc.fontSize(17).fillColor(this.cores.azulBrand).font('Helvetica-Bold');
      doc.text(
        `R$ ${this.formatarMoeda(item.medianaCalculada * item.quantidade)}`,
        82 + boxWidth,
        boxesY + 28
      );

      doc.y = boxesY + 65;
    }

    // Estatísticas
    if (fontesNaoExcluidas.length > 0) {
      const valores = fontesNaoExcluidas.map(f => f.valorUnitario);
      const media   = valores.reduce((a, b) => a + b, 0) / valores.length;
      const minimo  = Math.min(...valores);
      const maximo  = Math.max(...valores);

      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
      doc.text('Estatísticas das Fontes');
      doc.moveDown(0.5);

      const statsY     = doc.y;
      const statsWidth = (doc.page.width - 130) / 3;

      this.desenharMiniCard(doc, 50,                  statsY, statsWidth, 40, 'Média',   `R$ ${this.formatarMoeda(media)}`,   this.cores.navyEscuro);
      this.desenharMiniCard(doc, 60 + statsWidth,     statsY, statsWidth, 40, 'Mínimo',  `R$ ${this.formatarMoeda(minimo)}`,  this.cores.verdeCheck);
      this.desenharMiniCard(doc, 70 + statsWidth * 2, statsY, statsWidth, 40, 'Máximo',  `R$ ${this.formatarMoeda(maximo)}`,  this.cores.cinzaEscuro);

      doc.y = statsY + 50;
    }

    // Tabela de fontes
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text('Fontes de Pesquisa (PNCP)');
    doc.moveDown(0.5);

    if (fontes.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor(this.cores.cinzaEscuro);
      doc.text('Nenhuma fonte adicionada.');
      doc.fillColor(this.cores.preto);
    } else {
      const headers      = ['#', 'Órgão', 'Local', 'Valor Unit.', 'Data'];
      const columnWidths = [30, 160, 100, 80, 65];
      const rows: string[][] = [];

      fontes.forEach((fonte, index) => {
        const excluida = fonte.ignoradoCalculo;
        rows.push([
          (index + 1).toString(),
          (fonte.razaoSocialOrgao || 'N/A').substring(0, 30),
          `${fonte.municipioNome || 'N/A'}-${fonte.ufSigla || ''}`,
          `R$ ${this.formatarMoeda(fonte.valorUnitario)}${excluida ? ' *' : ''}`,
          fonte.dataLicitacao
            ? new Date(fonte.dataLicitacao).toLocaleDateString('pt-BR')
            : 'N/A',
        ]);
      });

      this.desenharTabela(doc, headers, rows, columnWidths);

      const fontesExcluidas = fontes.filter(f => f.ignoradoCalculo);
      if (fontesExcluidas.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(this.cores.preto);
        doc.text('* Fontes Excluídas do Cálculo:');
        doc.moveDown(0.3);

        fontesExcluidas.forEach((fonte) => {
          const fonteIndex = fontes.indexOf(fonte) + 1;
          doc.fontSize(9).fillColor(this.cores.cinzaEscuro).font('Helvetica');
          doc.text(`Fonte ${fonteIndex}: `, 60, doc.y, { continued: true });
          doc.fillColor(this.cores.preto);
          doc.text(fonte.justificativaExclusao || 'Sem justificativa');
          doc.moveDown(0.5);
        });

        doc.fillColor(this.cores.preto);
      }
    }

    if (item.observacoes) {
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(this.cores.preto);
      doc.text('Observações:');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor(this.cores.preto);
      doc.text(item.observacoes, { align: 'justify' });
    }
  }

  private desenharMiniCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    titulo: string,
    valor: string,
    cor: string
  ) {
    doc.roundedRect(x, y, width, height, 3)
      .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);

    doc.fontSize(8).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text(titulo, x + 10, y + 8, { width: width - 20 });

    doc.fontSize(11).fillColor(cor).font('Helvetica-Bold');
    doc.text(valor, x + 10, y + 22, { width: width - 20 });
  }

  // ========================================================
  // RESUMO FINANCEIRO
  // ========================================================

  private adicionarResumoFinanceiro(doc: PDFKit.PDFDocument, itens: any[]) {
    this.adicionarTituloSecao(doc, 'RESUMO FINANCEIRO');

    let valorTotalEstimado = 0;
    let quantidadeItens    = itens.length;
    let itensComMediana    = 0;

    const headers      = ['#', 'Item', 'Qtd', 'Unit.', 'Total'];
    const columnWidths = [30, 220, 60, 80, 85];
    const rows: string[][] = [];

    itens.forEach((item, index) => {
      const valorItem = item.medianaCalculada
        ? item.medianaCalculada * item.quantidade
        : 0;
      valorTotalEstimado += valorItem;
      if (item.medianaCalculada) itensComMediana++;

      rows.push([
        (index + 1).toString(),
        item.nome.substring(0, 40),
        `${item.quantidade} ${item.unidadeMedida}`,
        `R$ ${this.formatarMoeda(item.medianaCalculada || 0)}`,
        `R$ ${this.formatarMoeda(valorItem)}`,
      ]);
    });

    this.desenharTabela(doc, headers, rows, columnWidths);

    doc.moveDown(1);

    // Totalizador
    const totalY       = doc.y;
    const totalBoxW    = doc.page.width - 100;

    doc.roundedRect(50, totalY, totalBoxW, 90, 3)
      .fillAndStroke(this.cores.branco, this.cores.cinzaMedio);

    doc.fontSize(10).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text('Total de Itens:', 70, totalY + 18);
    doc.fillColor(this.cores.preto).font('Helvetica-Bold');
    doc.text(`${quantidadeItens}`, 260, totalY + 18);

    doc.font('Helvetica').fillColor(this.cores.cinzaEscuro);
    doc.text('Itens Precificados:', 70, totalY + 36);
    doc.fillColor(this.cores.preto).font('Helvetica-Bold');
    doc.text(`${itensComMediana} de ${quantidadeItens}`, 260, totalY + 36);

    // Separador
    doc.strokeColor(this.cores.cinzaMedio).lineWidth(0.5);
    doc.moveTo(70, totalY + 56).lineTo(doc.page.width - 70, totalY + 56).stroke();

    // Valor total
    doc.fontSize(11).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text('VALOR TOTAL ESTIMADO:', 70, totalY + 66);

    doc.fontSize(17).fillColor(this.cores.azulBrand).font('Helvetica-Bold');
    doc.text(
      `R$ ${this.formatarMoeda(valorTotalEstimado)}`,
      doc.page.width - 250,
      totalY + 64
    );

    doc.y = totalY + 100;
    doc.fillColor(this.cores.preto).font('Helvetica');
  }

  // ========================================================
  // EXTRATO DE FONTES
  // ========================================================

  private adicionarExtratoFontes(doc: PDFKit.PDFDocument) {
    this.adicionarTituloSecao(doc, 'EXTRATO DE FONTES UTILIZADAS NESTE RELATÓRIO');

    doc.fontSize(10).font('Helvetica').fillColor(this.cores.preto);
    doc.text(
      'ATENÇÃO — Este sistema é uma solução tecnológica que reúne, organiza e apresenta dados públicos de contratações governamentais, atendendo aos parâmetros de pesquisa dispostos na legislação vigente. Assim, não é considerado uma fonte primária de preços, mas sim um meio para que as pesquisas sejam realizadas de forma segura, ágil e eficaz.',
      { align: 'justify' }
    );

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text('Fontes utilizadas nesta cotação:');
    doc.moveDown(0.6);

    doc.fontSize(10).font('Helvetica').fillColor(this.cores.preto);
    doc.text('1 — Portal Nacional de Contratações Públicas (PNCP)', { indent: 10 });
    doc.fillColor(this.cores.azulBrand);
    doc.text('   https://www.gov.br/pncp/pt-br', { indent: 10 });

    doc.moveDown(1);
    doc.fillColor(this.cores.preto);
  }

  // ========================================================
  // ASSINATURA
  // ========================================================

  private adicionarSecaoAssinatura(doc: PDFKit.PDFDocument, projeto: any) {
    this.adicionarTituloSecao(doc, 'RESPONSÁVEL PELA PESQUISA');

    doc.moveDown(2);

    const centerX  = doc.page.width / 2;
    const boxWidth = 280;
    const startY   = doc.y + 40;
    const lineY    = startY + 50;

    doc.strokeColor(this.cores.navyEscuro).lineWidth(1);
    doc.moveTo(centerX - boxWidth / 2, lineY)
      .lineTo(centerX + boxWidth / 2, lineY)
      .stroke();

    doc.fontSize(8.5).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text('Assinatura do Responsável', centerX - boxWidth / 2, lineY + 8, {
      width: boxWidth,
      align: 'center',
    });

    doc.moveDown(2);
    const camposY = doc.y;
    doc.fontSize(9).fillColor(this.cores.preto);
    doc.text('Nome: __________________________________________', centerX - boxWidth / 2, camposY, {
      width: boxWidth,
    });
    doc.text('Cargo: __________________________________________', centerX - boxWidth / 2, camposY + 20, {
      width: boxWidth,
    });

    doc.y = camposY + 60;

    // Aviso legal com box estilizada
    const avisoY = doc.y + 10;
    const avisoW = doc.page.width - 100;

    doc.roundedRect(50, avisoY, avisoW, 75, 3)
      .fillAndStroke('#EFF6FF', this.cores.azulBrand + '55');

    doc.save();
    doc.roundedRect(50, avisoY, 4, 75, 2).fill(this.cores.azulBrand);
    doc.rect(52, avisoY, 2, 75).fill(this.cores.azulBrand);
    doc.restore();

    doc.fontSize(9.5).fillColor(this.cores.navyEscuro).font('Helvetica-Bold');
    doc.text('IMPORTANTE:', 66, avisoY + 14);
    doc.moveDown(0.3);
    doc.fontSize(8.5).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text(
      'Este documento deve ser arquivado junto ao processo licitatório para fins de auditoria e controle. A pesquisa de preços tem validade de acordo com a legislação vigente.',
      66,
      avisoY + 28,
      { width: avisoW - 30, align: 'justify' }
    );

    doc.y = avisoY + 90;
    doc.moveDown(1);

    doc.fontSize(8).fillColor(this.cores.cinzaEscuro).font('Helvetica');
    doc.text('• Documento gerado em conformidade com a Lei Federal nº 14.133/2021');
    doc.text('• Pesquisa realizada utilizando dados do Portal Nacional de Contratações Públicas (PNCP)');

    doc.fillColor(this.cores.preto).font('Helvetica');
  }

  // ========================================================
  // HELPERS DE ESTILO TIPOGRÁFICO
  // ========================================================

  /**
   * Título de seção com linha azul abaixo.
   */
  private adicionarTituloSecao(doc: PDFKit.PDFDocument, titulo: string) {
    doc.fontSize(17).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text(titulo);
    doc.moveDown(0.3);

    // Linha dupla: azul brand + faixa fina navy
    doc.strokeColor(this.cores.azulBrand).lineWidth(2);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.strokeColor(this.cores.navyEscuro).lineWidth(0.5);
    doc.moveTo(50, doc.y + 3).lineTo(doc.page.width - 50, doc.y + 3).stroke();

    doc.moveDown(1);
    doc.fillColor(this.cores.preto);
  }

  private adicionarSubtituloSecao(doc: PDFKit.PDFDocument, subtitulo: string) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor(this.cores.navyEscuro);
    doc.text(subtitulo);
    doc.moveDown(0.5);
    doc.fillColor(this.cores.preto);
  }

  // ========================================================
  // TABELA
  // ========================================================

  private desenharTabela(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    columnWidths: number[]
  ) {
    const startX    = 50;
    const startY    = doc.y;
    const rowHeight = 25;
    let currentY    = startY;
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

    // Cabeçalho — fundo navy escuro
    doc.rect(startX, currentY, totalWidth, rowHeight).fill(this.cores.navyEscuro);

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(this.cores.branco);
    let currentX = startX;
    headers.forEach((header, i) => {
      doc.text(header, currentX + 6, currentY + 8, {
        width: columnWidths[i] - 12,
        align: 'left',
      });
      currentX += columnWidths[i];
    });

    currentY += rowHeight;

    // Linhas da tabela
    doc.font('Helvetica').fontSize(8);
    rows.forEach((row, rowIndex) => {
      currentX = startX;
      const bg = rowIndex % 2 === 0 ? this.cores.cinzaClaro : this.cores.branco;
      doc.rect(startX, currentY, totalWidth, rowHeight).fill(bg);

      doc.fillColor(this.cores.cinzaEscuro);
      row.forEach((cell, colIndex) => {
        doc.text(cell, currentX + 6, currentY + 8, {
          width: columnWidths[colIndex] - 12,
          align: 'left',
        });
        currentX += columnWidths[colIndex];
      });

      // Borda inferior leve
      doc.strokeColor(this.cores.cinzaMedio).lineWidth(0.4);
      doc.moveTo(startX, currentY + rowHeight)
        .lineTo(startX + totalWidth, currentY + rowHeight)
        .stroke();

      currentY += rowHeight;
    });

    // Borda externa
    doc.strokeColor(this.cores.cinzaMedio).lineWidth(0.6);
    doc.rect(startX, startY, totalWidth, currentY - startY).stroke();

    doc.fillColor(this.cores.preto);
    doc.y = currentY + 10;
  }

  // ========================================================
  // UTILITÁRIOS
  // ========================================================

  private traduzirStatus(status: string): string {
    const traducoes: Record<string, string> = {
      rascunho:     'Rascunho',
      em_andamento: 'Em Andamento',
      finalizado:   'Finalizado',
      cancelado:    'Cancelado',
    };
    return traducoes[status] || status;
  }

  private formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
