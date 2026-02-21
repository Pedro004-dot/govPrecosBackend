/**
 * Engine de layout para gerenciamento consistente de paginação em PDFs.
 * Responsável por calcular espaços, decidir quebras de página e garantir
 * que não existam páginas vazias ou com conteúdo mal distribuído.
 */
export class PDFLayoutEngine {
  // Constantes de layout
  private readonly MARGEM_TOPO = 50;
  private readonly MARGEM_RODAPE = 60;
  private readonly ALTURA_CABECALHO = 55; // Altura do cabeçalho padrão
  private readonly ESPACO_MINIMO_PARA_CONTEUDO = 100; // Espaço mínimo antes de criar nova página
  private readonly PERCENTUAL_MINIMO_PREENCHIMENTO = 0.2; // 20% mínimo de preenchimento de página

  /**
   * Calcula o espaço disponível na página atual.
   * @param doc Documento PDFKit
   * @param considerarCabecalho Se deve considerar espaço do cabeçalho (para páginas que terão cabeçalho)
   * @returns Espaço disponível em pontos
   */
  public calcularEspacoDisponivel(
    doc: PDFKit.PDFDocument,
    considerarCabecalho: boolean = false
  ): number {
    const alturaPagina = doc.page.height;
    const yAtual = doc.y;
    const espacoCabecalho = considerarCabecalho ? this.ALTURA_CABECALHO : 0;

    const espacoDisponivel = alturaPagina - yAtual - this.MARGEM_RODAPE - espacoCabecalho;
    return Math.max(0, espacoDisponivel);
  }

  /**
   * Verifica se há espaço suficiente para o conteúdo na página atual.
   * @param doc Documento PDFKit
   * @param alturaConteudo Altura necessária para o conteúdo em pontos
   * @param considerarCabecalho Se nova página terá cabeçalho
   * @returns true se há espaço suficiente, false caso contrário
   */
  public temEspacoSuficiente(
    doc: PDFKit.PDFDocument,
    alturaConteudo: number,
    considerarCabecalho: boolean = false
  ): boolean {
    const espacoDisponivel = this.calcularEspacoDisponivel(doc, considerarCabecalho);
    return espacoDisponivel >= alturaConteudo;
  }

  /**
   * Verifica se deve criar uma nova página baseado em regras inteligentes.
   * Evita criar páginas com muito pouco conteúdo.
   * @param doc Documento PDFKit
   * @param alturaConteudo Altura do conteúdo a ser adicionado
   * @param forcar Se deve forçar nova página independente das regras
   * @returns true se deve criar nova página
   */
  public deveCriarNovaPagina(
    doc: PDFKit.PDFDocument,
    alturaConteudo: number,
    forcar: boolean = false
  ): boolean {
    if (forcar) {
      return true;
    }

    const espacoDisponivel = this.calcularEspacoDisponivel(doc, true);

    // Não criar nova página se o espaço disponível for muito pequeno
    // E o conteúdo não cabe (deixar PDFKit gerenciar)
    if (espacoDisponivel < this.ESPACO_MINIMO_PARA_CONTEUDO) {
      return false;
    }

    // Criar nova página apenas se o conteúdo não cabe E há espaço razoável na página atual
    return espacoDisponivel < alturaConteudo && espacoDisponivel > this.ESPACO_MINIMO_PARA_CONTEUDO;
  }

  /**
   * Calcula a altura de uma linha de texto com quebras.
   * @param doc Documento PDFKit
   * @param texto Texto a ser medido
   * @param largura Largura máxima disponível
   * @param opcoes Opções de estilo (fontSize, lineGap, etc)
   * @returns Altura estimada em pontos
   */
  public calcularAlturaTexto(
    doc: PDFKit.PDFDocument,
    texto: string,
    largura: number,
    opcoes?: { fontSize?: number; lineGap?: number }
  ): number {
    const fontSize = opcoes?.fontSize ?? 10;
    const lineGap = opcoes?.lineGap ?? 0;

    // Calcular número de linhas (estimativa simples)
    const caracteresPorLinha = Math.floor(largura / (fontSize * 0.5)); // Estimativa
    const linhas = Math.ceil(texto.length / Math.max(1, caracteresPorLinha));

    return linhas * (fontSize + lineGap);
  }

  /**
   * Calcula a altura necessária para uma tabela.
   * @param numLinhas Número de linhas da tabela
   * @param alturaLinha Altura de cada linha
   * @param alturaHeader Altura do cabeçalho
   * @returns Altura total da tabela em pontos
   */
  public calcularAlturaTabel(
    numLinhas: number,
    alturaLinha: number = 25,
    alturaHeader: number = 25
  ): number {
    return alturaHeader + (numLinhas * alturaLinha) + 10; // +10 para margem
  }

  /**
   * Verifica se a página atual está muito vazia.
   * Útil para evitar criar páginas com pouco conteúdo.
   * @param doc Documento PDFKit
   * @returns true se a página está muito vazia (< 20% preenchida)
   */
  public paginaMuitoVazia(doc: PDFKit.PDFDocument): boolean {
    const alturaPagina = doc.page.height;
    const yAtual = doc.y;
    const alturaUtilizada = yAtual - this.MARGEM_TOPO;
    const alturaTotal = alturaPagina - this.MARGEM_TOPO - this.MARGEM_RODAPE;

    const percentualPreenchimento = alturaUtilizada / alturaTotal;
    return percentualPreenchimento < this.PERCENTUAL_MINIMO_PREENCHIMENTO;
  }

  /**
   * Calcula posição Y após adicionar cabeçalho.
   * @returns Posição Y inicial para conteúdo
   */
  public obterYAposCabecalho(): number {
    return this.MARGEM_TOPO + this.ALTURA_CABECALHO;
  }

  /**
   * Constantes públicas para uso externo
   */
  public get margemTopo(): number {
    return this.MARGEM_TOPO;
  }

  public get margemRodape(): number {
    return this.MARGEM_RODAPE;
  }

  public get alturaCabecalho(): number {
    return this.ALTURA_CABECALHO;
  }
}
