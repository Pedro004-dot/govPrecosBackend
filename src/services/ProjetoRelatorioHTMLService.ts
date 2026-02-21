import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { TenantRepository } from '../repositories/TenantRepository';
import { QRCodeService } from './QRCodeService';

/**
 * Serviço para geração de HTML de relatórios usando templates Handlebars.
 * Templates são carregados em memória para melhor performance.
 */
export class ProjetoRelatorioHTMLService {
  private templatesPath: string;
  private stylesPath: string;
  private templates: Map<string, HandlebarsTemplateDelegate>;
  private styles: Map<string, string>;

  constructor(private readonly tenantRepository: TenantRepository) {
    // Em produção (dist/), __dirname = dist/services → dist/templates/relatorio pode não existir.
    // Fallback: usar src/templates/relatorio a partir do cwd (ex.: em dev ou se templates forem copiados para outro lugar).
    const basePath = path.join(__dirname, '../templates/relatorio');
    const fallbackPath = path.join(process.cwd(), 'src', 'templates', 'relatorio');
    this.templatesPath = fs.existsSync(basePath) ? basePath : fallbackPath;
    this.stylesPath = path.join(this.templatesPath, 'styles');
    this.templates = new Map();
    this.styles = new Map();
  }

  /**
   * Inicializa o serviço carregando templates e registrando helpers
   */
  public async inicializar(): Promise<void> {
    console.log('[ProjetoRelatorioHTMLService] Carregando templates...');
    this.carregarTemplates();
    this.carregarStyles();
    this.registrarHelpers();
    console.log('[ProjetoRelatorioHTMLService] Templates carregados com sucesso');
  }

  /**
   * Carrega todos os templates Handlebars na memória
   */
  private carregarTemplates(): void {
    const templates = [
      'base.html',
      'completo.html',
      'resumido.html',
      'sections/capa.html',
      'sections/resumo-executivo.html',
      'sections/metodologia.html',
      'sections/item.html',
      'sections/resumo-financeiro.html',
      'sections/extrato-fontes.html',
      'sections/assinatura.html',
      'components/cabecalho.html',
      'components/rodape.html',
      'components/card.html',
      'components/tabela.html',
      'components/mini-card.html',
    ];

    templates.forEach((templateName) => {
      const templatePath = path.join(this.templatesPath, templateName);

      // Verificar se arquivo existe antes de tentar ler
      if (fs.existsSync(templatePath)) {
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        const compiled = Handlebars.compile(templateSource);
        this.templates.set(templateName, compiled);
      } else {
        console.warn(`[ProjetoRelatorioHTMLService] Template não encontrado: ${templateName}`);
      }
    });

    // Registrar partials para componentes reutilizáveis
    const capaTemplate = this.templates.get('sections/capa.html');
    if (capaTemplate) {
      Handlebars.registerPartial('sections/capa', capaTemplate);
    }

    const resumoTemplate = this.templates.get('sections/resumo-executivo.html');
    if (resumoTemplate) {
      Handlebars.registerPartial('sections/resumo-executivo', resumoTemplate);
    }

    const metodologiaTemplate = this.templates.get('sections/metodologia.html');
    if (metodologiaTemplate) {
      Handlebars.registerPartial('sections/metodologia', metodologiaTemplate);
    }

    const itemTemplate = this.templates.get('sections/item.html');
    if (itemTemplate) {
      Handlebars.registerPartial('sections/item', itemTemplate);
    }

    const resumoFinanceiroTemplate = this.templates.get('sections/resumo-financeiro.html');
    if (resumoFinanceiroTemplate) {
      Handlebars.registerPartial('sections/resumo-financeiro', resumoFinanceiroTemplate);
    }

    const extratoTemplate = this.templates.get('sections/extrato-fontes.html');
    if (extratoTemplate) {
      Handlebars.registerPartial('sections/extrato-fontes', extratoTemplate);
    }

    const assinaturaTemplate = this.templates.get('sections/assinatura.html');
    if (assinaturaTemplate) {
      Handlebars.registerPartial('sections/assinatura', assinaturaTemplate);
    }

    // Componentes
    const cabecalhoTemplate = this.templates.get('components/cabecalho.html');
    if (cabecalhoTemplate) {
      Handlebars.registerPartial('cabecalho', cabecalhoTemplate);
    }

    const rodapeTemplate = this.templates.get('components/rodape.html');
    if (rodapeTemplate) {
      Handlebars.registerPartial('rodape', rodapeTemplate);
    }

    const cardTemplate = this.templates.get('components/card.html');
    if (cardTemplate) {
      Handlebars.registerPartial('card', cardTemplate);
    }

    const tabelaTemplate = this.templates.get('components/tabela.html');
    if (tabelaTemplate) {
      Handlebars.registerPartial('tabela', tabelaTemplate);
    }

    const miniCardTemplate = this.templates.get('components/mini-card.html');
    if (miniCardTemplate) {
      Handlebars.registerPartial('mini-card', miniCardTemplate);
    }
  }

  /**
   * Carrega arquivos CSS na memória
   */
  private carregarStyles(): void {
    const styleFiles = ['base.css', 'layout.css', 'components.css', 'print.css'];

    styleFiles.forEach((fileName) => {
      const stylePath = path.join(this.stylesPath, fileName);

      if (fs.existsSync(stylePath)) {
        const styleContent = fs.readFileSync(stylePath, 'utf-8');
        this.styles.set(fileName, styleContent);
      } else {
        console.warn(`[ProjetoRelatorioHTMLService] CSS não encontrado: ${fileName}`);
      }
    });
  }

  /**
   * Registra helpers customizados do Handlebars
   */
  private registrarHelpers(): void {
    // Formatação de moeda
    Handlebars.registerHelper('formatarMoeda', (valor: number) => {
      if (typeof valor !== 'number' || isNaN(valor)) return '0,00';
      return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    });

    // Formatação de data
    Handlebars.registerHelper('formatarData', (data: Date | string) => {
      if (!data) return 'N/A';
      const d = typeof data === 'string' ? new Date(data) : data;
      return d.toLocaleDateString('pt-BR');
    });

    // Traduzir status
    Handlebars.registerHelper('traduzirStatus', (status: string) => {
      const traducoes: Record<string, string> = {
        rascunho: 'Rascunho',
        em_andamento: 'Em Andamento',
        finalizado: 'Finalizado',
        cancelado: 'Cancelado',
      };
      return traducoes[status] || status;
    });

    // Truncar texto
    Handlebars.registerHelper('truncate', (text: string, length: number) => {
      if (!text || text.length <= length) return text;
      return text.substring(0, length - 3) + '...';
    });

    // Condicionais
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

    // Helper para incluir CSS inline
    Handlebars.registerHelper('includeCSS', (fileName: string) => {
      return new Handlebars.SafeString(this.styles.get(fileName) || '');
    });

    // Helper para iterar com index
    Handlebars.registerHelper('eachWithIndex', function(this: any, array: any[], options: any) {
      if (!array || array.length === 0) return options.inverse(this);

      let result = '';
      for (let i = 0; i < array.length; i++) {
        const data = Handlebars.createFrame(options.data || {});
        data.index = i + 1; // Índice começa em 1 para exibição
        data.first = i === 0;
        data.last = i === array.length - 1;
        result += options.fn(array[i], { data });
      }
      return result;
    });

    // Helper para limitar array (usado no modo resumido)
    Handlebars.registerHelper('limitArray', (array: any[], limit?: number) => {
      if (!array || !Array.isArray(array)) return [];
      if (!limit || limit <= 0) return array;
      return array.slice(0, limit);
    });

    // Helper para multiplicar dois números
    Handlebars.registerHelper('multiply', (a: number, b: number) => {
      if (typeof a !== 'number' || typeof b !== 'number') return 0;
      return a * b;
    });

    // Helper para calcular total de fontes utilizadas (não excluídas)
    Handlebars.registerHelper('calcularFontesUtilizadas', (itensComFontes: any[]) => {
      if (!itensComFontes || !Array.isArray(itensComFontes)) return 0;
      return itensComFontes.reduce((total, itemComFontes) => {
        const fontesUtilizadas = itemComFontes.fontes.filter((f: any) => !f.ignoradoCalculo);
        return total + fontesUtilizadas.length;
      }, 0);
    });

    // Helper para filtrar array e retornar quantidade
    Handlebars.registerHelper('filter', (array: any[], property: string) => {
      if (!array || !Array.isArray(array)) return 0;
      return array.filter((item) => item[property]).length;
    });

    // Helper para verificar se array tem elementos
    Handlebars.registerHelper('hasItems', (array: any[]) => {
      return array && Array.isArray(array) && array.length > 0;
    });
  }

  /**
   * Gera HTML para relatório completo ou resumido
   */
  public async gerarHTML(
    projeto: any,
    itens: any[],
    itensComFontes: any[],
    tipo: 'completo' | 'resumido',
    urlPublicaRelatorio?: string
  ): Promise<string> {
    console.log(`[ProjetoRelatorioHTMLService] Gerando HTML do relatório ${tipo}...`);

    // Preparar dados para template
    const dados = await this.prepararDados(projeto, itens, itensComFontes, tipo, urlPublicaRelatorio);

    // Renderizar conteúdo (completo ou resumido)
    const templateName = tipo === 'completo' ? 'completo.html' : 'resumido.html';
    const contentTemplate = this.templates.get(templateName);

    if (!contentTemplate) {
      throw new Error(`Template ${templateName} não encontrado`);
    }

    const conteudo = contentTemplate(dados);

    // Renderizar base HTML com o conteúdo injetado
    const baseTemplate = this.templates.get('base.html');
    if (!baseTemplate) {
      throw new Error('Template base.html não encontrado');
    }

    const html = baseTemplate({
      ...dados,
      conteudo,
      cssBase: this.styles.get('base.css') || '',
      cssLayout: this.styles.get('layout.css') || '',
      cssComponents: this.styles.get('components.css') || '',
      cssPrint: this.styles.get('print.css') || '',
    });

    console.log('[ProjetoRelatorioHTMLService] HTML gerado com sucesso');
    return html;
  }

  /**
   * Prepara dados para serem injetados no template
   */
  private async prepararDados(
    projeto: any,
    itens: any[],
    itensComFontes: any[],
    tipo: 'completo' | 'resumido',
    urlPublicaRelatorio?: string
  ): Promise<any> {
    const valorTotalProjeto = itens.reduce((sum, item) => {
      return sum + (item.medianaCalculada ? item.medianaCalculada * item.quantidade : 0);
    }, 0);

    const totalItens = itens.length;
    const itensComMediana = itens.filter(i => i.medianaCalculada).length;
    const totalFontes = itensComFontes.reduce((sum, i) => sum + i.fontes.length, 0);

    // Gerar QR code se necessário
    let qrCodeDataUrl: string | undefined;
    if (urlPublicaRelatorio) {
      try {
        const qrCodeBuffer = await QRCodeService.gerarQRCode(urlPublicaRelatorio, 35);
        qrCodeDataUrl = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;
      } catch (error) {
        console.warn('[ProjetoRelatorioHTMLService] Erro ao gerar QR code:', error);
      }
    }

    // Buscar tenant para brasão
    const tenant = await this.tenantRepository.buscarPorId(projeto.tenantId);
    const brasaoUrl = tenant?.brasaoUrl;

    // Converter logos para data URIs
    const logoSymbolPath = path.join(__dirname, '../public/relatorio-assets/logo-symbol.png');
    const logoBrancoPath = path.join(__dirname, '../public/relatorio-assets/logo-branco.png');

    let logoSymbolDataUri = '';
    let logoBrancoDataUri = '';

    if (fs.existsSync(logoSymbolPath)) {
      const logoBuffer = fs.readFileSync(logoSymbolPath);
      logoSymbolDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    if (fs.existsSync(logoBrancoPath)) {
      const logoBuffer = fs.readFileSync(logoBrancoPath);
      logoBrancoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    return {
      // Projeto
      projeto: {
        ...projeto,
        statusTraduzido: this.traduzirStatus(projeto.status),
        dataFinalizacaoFormatada: projeto.dataFinalizacao
          ? new Date(projeto.dataFinalizacao).toLocaleDateString('pt-BR')
          : null,
      },

      // Itens
      itens,
      itensComFontes: itensComFontes.map((itemComFontes) => ({
        ...itemComFontes,
        item: {
          ...itemComFontes.item,
          valorTotalItem: itemComFontes.item.medianaCalculada
            ? itemComFontes.item.medianaCalculada * itemComFontes.item.quantidade
            : 0,
          percentualGlobal: valorTotalProjeto > 0
            ? ((itemComFontes.item.medianaCalculada || 0) * itemComFontes.item.quantidade / valorTotalProjeto) * 100
            : 0,
        },
        fontes: itemComFontes.fontes,
        fontesNaoExcluidas: itemComFontes.fontes.filter((f: any) => !f.ignoradoCalculo),
        estatisticas: this.calcularEstatisticas(itemComFontes.fontes),
        resumido: tipo === 'resumido',
        maxFontes: tipo === 'resumido' ? 3 : undefined,
      })),

      // Resumo
      resumo: {
        totalItens,
        itensComMediana,
        valorTotalProjeto,
        totalFontes,
      },

      // Assets (data URIs)
      logoSymbolDataUri,
      logoBrancoDataUri,
      brasaoUrl,

      // Metadados
      dataGeracao: new Date().toLocaleString('pt-BR'),
      urlPublicaRelatorio,
      qrCodeDataUrl,

      // CSS inline
      css: {
        base: this.styles.get('base.css') || '',
        layout: this.styles.get('layout.css') || '',
        components: this.styles.get('components.css') || '',
        print: this.styles.get('print.css') || '',
      },
    };
  }

  private calcularEstatisticas(fontes: any[]) {
    const fontesNaoExcluidas = fontes.filter(f => !f.ignoradoCalculo);
    if (fontesNaoExcluidas.length === 0) return null;

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

    return { media, mediana, minimo, maximo, desvioPadrao };
  }

  private traduzirStatus(status: string): string {
    const traducoes: Record<string, string> = {
      rascunho: 'Rascunho',
      em_andamento: 'Em Andamento',
      finalizado: 'Finalizado',
      cancelado: 'Cancelado',
    };
    return traducoes[status] || status;
  }
}
