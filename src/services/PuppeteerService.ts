import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Serviço para conversão de HTML em PDF usando Puppeteer.
 * Implementa padrão singleton para reutilizar instância do navegador.
 */
export class PuppeteerService {
  private static instance: PuppeteerService | null = null;
  private browser: Browser | null = null;

  private constructor() {}

  /**
   * Retorna instância singleton do serviço
   */
  public static getInstance(): PuppeteerService {
    if (!PuppeteerService.instance) {
      PuppeteerService.instance = new PuppeteerService();
    }
    return PuppeteerService.instance;
  }

  /**
   * Inicializa o navegador Puppeteer (singleton)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log('[PuppeteerService] Inicializando navegador Chromium...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Reduz uso de memória
          '--disable-gpu',
        ],
      });
      console.log('[PuppeteerService] Navegador inicializado com sucesso');
    }
    return this.browser;
  }

  /**
   * Converte HTML em PDF usando Puppeteer
   * @param html String HTML completa a ser convertida
   * @returns Buffer do PDF gerado
   */
  public async htmlParaPDF(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      console.log('[PuppeteerService] Carregando HTML na página...');

      // load = DOM e recursos (imagens) carregaram. Evita timeout de networkidle0 se algo externo falhar.
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 30000,
      });

      console.log('[PuppeteerService] HTML carregado, gerando PDF...');

      // Gerar PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true, // Imprimir backgrounds coloridos
        margin: {
          top: '50px',
          right: '50px',
          bottom: '60px', // Mais espaço para rodapé
          left: '50px',
        },
        displayHeaderFooter: false, // Usaremos CSS para cabeçalho/rodapé
        preferCSSPageSize: true, // Respeita @page CSS
      });

      console.log('[PuppeteerService] PDF gerado com sucesso');

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('[PuppeteerService] Erro ao gerar PDF:', error);
      throw new Error(`Erro ao converter HTML para PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Fecha o navegador (cleanup)
   * Útil para testes ou shutdown da aplicação
   */
  public async close(): Promise<void> {
    if (this.browser) {
      console.log('[PuppeteerService] Fechando navegador...');
      await this.browser.close();
      this.browser = null;
      console.log('[PuppeteerService] Navegador fechado');
    }
  }

  /**
   * Verifica se o navegador está ativo
   */
  public isActive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}
