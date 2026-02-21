import * as XLSX from 'xlsx';
import { ProjetoRepository } from '../repositories/ProjetoRepository';
import { ProjetoItemRepository } from '../repositories/ProjetoItemRepository';
import { ItemFonteRepository } from '../repositories/ItemFonteRepository';
import { TenantRepository } from '../repositories/TenantRepository';
import { ProjetoRelatorioHTMLService } from './ProjetoRelatorioHTMLService';
import { PuppeteerService } from './PuppeteerService';

/**
 * Tipos de relatório disponíveis
 */
export type TipoRelatorio = 'completo' | 'resumido' | 'xlsx';

/**
 * Serviço para geração de relatórios de projetos em PDF e XLSX.
 * Conforme Lei 14.133/2021 - Pesquisa de Preços com fontes PNCP.
 *
 * Usa Puppeteer para conversão HTML → PDF.
 */
export class ProjetoRelatorioService {
  private readonly htmlService: ProjetoRelatorioHTMLService;
  private readonly puppeteerService: PuppeteerService;

  constructor(
    private readonly projetoRepository: ProjetoRepository,
    private readonly projetoItemRepository: ProjetoItemRepository,
    private readonly itemFonteRepository: ItemFonteRepository,
    private readonly tenantRepository: TenantRepository
  ) {
    this.htmlService = new ProjetoRelatorioHTMLService(tenantRepository);
    this.puppeteerService = PuppeteerService.getInstance();
  }

  /**
   * Inicializa o serviço (carrega templates)
   */
  public async inicializar(): Promise<void> {
    console.log('[ProjetoRelatorioService] Inicializando serviço...');
    await this.htmlService.inicializar();
    console.log('[ProjetoRelatorioService] Serviço inicializado com sucesso');
  }

  /**
   * Gera relatório para um projeto (PDF ou XLSX).
   * @param projetoId ID do projeto
   * @param tipo Tipo de relatório ('completo', 'resumido', 'xlsx')
   * @param urlPublicaRelatorio URL pública do relatório para QR code (opcional)
   * @returns Buffer do arquivo gerado
   */
  public async gerarRelatorio(
    projetoId: string,
    tipo: TipoRelatorio = 'completo',
    urlPublicaRelatorio?: string
  ): Promise<Buffer> {
    if (tipo === 'xlsx') {
      return this.gerarXLSX(projetoId);
    }
    return this.gerarPDF(projetoId, tipo, urlPublicaRelatorio);
  }

  /**
   * Valida os dados do projeto antes de gerar relatório.
   * Verifica se há itens, se os itens têm fontes suficientes, etc.
   * @param projeto Projeto a ser validado
   * @param itens Itens do projeto
   * @param itensComFontes Itens com suas fontes
   * @throws Error se validação falhar
   */
  private validarDadosRelatorio(
    projeto: any,
    itens: any[],
    itensComFontes: any[]
  ): void {
    // Validar projeto
    if (!projeto) {
      throw new Error('Projeto não encontrado');
    }

    if (!projeto.nome || projeto.nome.trim().length === 0) {
      throw new Error('Projeto sem nome válido');
    }

    // Validar itens
    if (!itens || itens.length === 0) {
      throw new Error('Projeto não possui itens para gerar relatório');
    }

    // Verificar itens sem ID
    const itensSemId = itens.filter(item => !item.id);
    if (itensSemId.length > 0) {
      throw new Error(`${itensSemId.length} item(ns) sem ID encontrado(s)`);
    }

    // Verificar itens sem nome
    const itensSemNome = itens.filter(item => !item.nome || item.nome.trim().length === 0);
    if (itensSemNome.length > 0) {
      throw new Error(`${itensSemNome.length} item(ns) sem nome encontrado(s)`);
    }

    // Validar valores numéricos
    const itensComValoresInvalidos = itens.filter(item => {
      return (
        typeof item.quantidade !== 'number' ||
        item.quantidade <= 0 ||
        isNaN(item.quantidade)
      );
    });

    if (itensComValoresInvalidos.length > 0) {
      console.warn(
        `[ProjetoRelatorioService] ${itensComValoresInvalidos.length} item(ns) com quantidades inválidas`
      );
    }

    // Verificar fontes
    const itensComPoucasFontes = itensComFontes.filter(itemComFontes => {
      const fontesValidas = itemComFontes.fontes.filter(
        (fonte: any) => !fonte.ignoradoCalculo
      );
      return fontesValidas.length < 3;
    });

    if (itensComPoucasFontes.length > 0) {
      console.warn(
        `[ProjetoRelatorioService] ATENÇÃO: ${itensComPoucasFontes.length} item(ns) com menos de 3 fontes válidas`
      );
    }

    // Truncar valores extremos para evitar problemas de renderização
    itens.forEach(item => {
      // Truncar nomes muito longos
      if (item.nome && item.nome.length > 200) {
        console.warn(
          `[ProjetoRelatorioService] Truncando nome do item: ${item.nome.substring(0, 50)}...`
        );
        item.nome = item.nome.substring(0, 197) + '...';
      }

      // Truncar descrições muito longas
      if (item.descricao && item.descricao.length > 500) {
        console.warn(
          `[ProjetoRelatorioService] Truncando descrição do item: ${item.nome}`
        );
        item.descricao = item.descricao.substring(0, 497) + '...';
      }
    });
  }

  /**
   * Gera relatório PDF para um projeto usando Puppeteer.
   * Renderiza templates HTML/CSS e converte para PDF.
   */
  public async gerarPDF(
    projetoId: string,
    tipo: 'completo' | 'resumido' = 'completo',
    urlPublicaRelatorio?: string
  ): Promise<Buffer> {
    console.log(`[ProjetoRelatorioService] Gerando PDF ${tipo} para projeto: ${projetoId}`);

    // Buscar dados do projeto
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

    // Validar dados antes de gerar relatório
    this.validarDadosRelatorio(projeto, itens, itensComFontes);

    // Gerar HTML usando templates Handlebars
    const html = await this.htmlService.gerarHTML(
      projeto,
      itens,
      itensComFontes,
      tipo,
      urlPublicaRelatorio
    );

    // Converter HTML para PDF usando Puppeteer
    const pdfBuffer = await this.puppeteerService.htmlParaPDF(html);

    console.log(`[ProjetoRelatorioService] PDF ${tipo} gerado com sucesso`);
    return pdfBuffer;
  }

  /**
   * Gera relatório em formato XLSX (Excel)
   */
  public async gerarXLSX(projetoId: string): Promise<Buffer> {
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

    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Aba 1: Resumo Executivo
    const resumoData = [
      ['RELATÓRIO DE PESQUISA DE PREÇOS'],
      ['Projeto:', projeto.nome],
      ['Nº Processo:', projeto.numeroProcesso || 'N/A'],
      ['Status:', this.traduzirStatus(projeto.status)],
      ['Data Finalização:', projeto.dataFinalizacao ? new Date(projeto.dataFinalizacao).toLocaleDateString('pt-BR') : 'N/A'],
      [],
      ['RESUMO'],
      ['Total de Itens:', itens.length],
      ['Itens Precificados:', itens.filter(i => i.medianaCalculada).length],
      ['Valor Total Estimado:', `R$ ${this.formatarMoeda(valorTotalProjeto)}`],
      ['Total de Fontes PNCP:', itensComFontes.reduce((sum, i) => sum + i.fontes.length, 0)],
    ];
    const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo');

    // Aba 2: Itens
    const itensHeaders = ['#', 'Item', 'Descrição', 'Quantidade', 'Unidade', 'Preço Unitário', 'Valor Total'];
    const itensRows = itens.map((item, index) => [
      index + 1,
      item.nome,
      item.descricao || '',
      item.quantidade,
      item.unidadeMedida,
      item.medianaCalculada ? this.formatarMoeda(item.medianaCalculada) : 'N/A',
      item.medianaCalculada ? this.formatarMoeda(item.medianaCalculada * item.quantidade) : 'N/A',
    ]);
    const itensData = [itensHeaders, ...itensRows];
    const itensSheet = XLSX.utils.aoa_to_sheet(itensData);
    XLSX.utils.book_append_sheet(workbook, itensSheet, 'Itens');

    // Aba 3: Fontes
    const fontesHeaders = ['Item', 'Órgão', 'Município', 'UF', 'Valor Unitário', 'Data Licitação', 'Excluída', 'Justificativa'];
    const fontesRows: any[] = [];
    itensComFontes.forEach((itemComFontes) => {
      itemComFontes.fontes.forEach((fonte) => {
        fontesRows.push([
          itemComFontes.item.nome,
          fonte.razaoSocialOrgao || 'N/A',
          fonte.municipioNome || 'N/A',
          fonte.ufSigla || 'N/A',
          this.formatarMoeda(fonte.valorUnitario),
          fonte.dataLicitacao ? new Date(fonte.dataLicitacao).toLocaleDateString('pt-BR') : 'N/A',
          fonte.ignoradoCalculo ? 'Sim' : 'Não',
          fonte.justificativaExclusao || '',
        ]);
      });
    });
    const fontesData = [fontesHeaders, ...fontesRows];
    const fontesSheet = XLSX.utils.aoa_to_sheet(fontesData);
    XLSX.utils.book_append_sheet(workbook, fontesSheet, 'Fontes');

    // Aba 4: Estatísticas
    const statsHeaders = ['Item', 'Média', 'Mediana', 'Mínimo', 'Máximo', 'Desvio Padrão'];
    const statsRows: any[] = [];
    itensComFontes.forEach((itemComFontes) => {
      const fontesNaoExcluidas = itemComFontes.fontes.filter(f => !f.ignoradoCalculo);
      if (fontesNaoExcluidas.length > 0) {
        const valores = fontesNaoExcluidas.map(f => f.valorUnitario);
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;
        const minimo = Math.min(...valores);
        const maximo = Math.max(...valores);
        valores.sort((a, b) => a - b);
        const mediana = valores.length % 2 === 0
          ? (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2
          : valores[Math.floor(valores.length / 2)];
        const desvioPadrao = Math.sqrt(
          valores.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / valores.length
        );

        statsRows.push([
          itemComFontes.item.nome,
          this.formatarMoeda(media),
          this.formatarMoeda(mediana),
          this.formatarMoeda(minimo),
          this.formatarMoeda(maximo),
          this.formatarMoeda(desvioPadrao),
        ]);
      }
    });
    const statsData = [statsHeaders, ...statsRows];
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estatísticas');

    // Gerar buffer
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
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
