import axios from 'axios';

/**
 * Serviço para download de imagens via HTTP/HTTPS.
 * Usado principalmente para baixar brasões de prefeituras armazenados em URLs públicas.
 */
export class ImageDownloader {
  /**
   * Faz download de uma imagem via URL e retorna como Buffer.
   * @param url URL pública da imagem
   * @param timeoutMs Timeout em milissegundos (padrão: 5000ms)
   * @returns Buffer da imagem ou null se falhar
   */
  public static async baixarImagem(
    url: string,
    timeoutMs: number = 5000
  ): Promise<Buffer | null> {
    try {
      // Validar URL
      if (!url || !this.isValidImageUrl(url)) {
        console.warn('[ImageDownloader] URL inválida:', url);
        return null;
      }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'GovPrecos/1.0',
        },
        maxContentLength: 5 * 1024 * 1024, // Máximo 5MB
      });

      // Verificar se é uma imagem válida
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        console.warn('[ImageDownloader] Content-Type não é imagem:', contentType);
        return null;
      }

      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        console.error('[ImageDownloader] Timeout ao baixar imagem:', url);
      } else if (error.response) {
        console.error(
          `[ImageDownloader] Erro HTTP ${error.response.status} ao baixar imagem:`,
          url
        );
      } else {
        console.error('[ImageDownloader] Erro ao baixar imagem:', error.message);
      }
      return null;
    }
  }

  /**
   * Valida se a URL é uma URL de imagem válida.
   * @param url URL a ser validada
   * @returns true se válida
   */
  private static isValidImageUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Aceitar apenas HTTP/HTTPS
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      // Verificar se termina com extensão de imagem comum
      const extensoesValidas = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      const pathname = parsedUrl.pathname.toLowerCase();
      const temExtensaoValida = extensoesValidas.some(ext => pathname.endsWith(ext));

      // Aceitar URLs sem extensão (pode ser URL de storage que retorna imagem)
      // Ou URLs com extensão válida
      return true; // Permitir qualquer URL válida, verificação de tipo será no download
    } catch {
      return false;
    }
  }

  /**
   * Tenta baixar imagem com retry em caso de falha.
   * @param url URL da imagem
   * @param tentativas Número de tentativas (padrão: 2)
   * @returns Buffer da imagem ou null
   */
  public static async baixarImagemComRetry(
    url: string,
    tentativas: number = 2
  ): Promise<Buffer | null> {
    for (let i = 0; i < tentativas; i++) {
      const buffer = await this.baixarImagem(url);
      if (buffer) {
        return buffer;
      }

      // Aguardar 500ms antes de tentar novamente
      if (i < tentativas - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return null;
  }

  /**
   * Detecta o tipo de imagem baseado no buffer.
   * @param buffer Buffer da imagem
   * @returns Tipo da imagem ('PNG', 'JPEG', 'GIF', etc) ou 'UNKNOWN'
   */
  public static detectarTipoImagem(buffer: Buffer): string {
    if (buffer.length < 4) {
      return 'UNKNOWN';
    }

    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'PNG';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'JPEG';
    }

    // GIF: 47 49 46
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'GIF';
    }

    // SVG (texto): < s v g ou < ? x m l
    const inicio = buffer.toString('utf8', 0, Math.min(100, buffer.length));
    if (inicio.includes('<svg') || inicio.includes('<?xml')) {
      return 'SVG';
    }

    return 'UNKNOWN';
  }
}
