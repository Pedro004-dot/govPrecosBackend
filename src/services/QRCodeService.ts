import QRCode from 'qrcode';

/**
 * Serviço para geração de QR codes
 */
export class QRCodeService {
  /**
   * Gera um QR code como imagem PNG a partir de uma URL
   * @param url URL para codificar no QR code
   * @param tamanho Tamanho da imagem em pixels (padrão: 200)
   * @returns Buffer contendo a imagem PNG do QR code
   */
  public static async gerarQRCode(url: string, tamanho: number = 200): Promise<Buffer> {
    try {
      const qrCodeBuffer = await QRCode.toBuffer(url, {
        type: 'png',
        width: tamanho,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrCodeBuffer;
    } catch (error) {
      console.error('[QRCodeService] Erro ao gerar QR code:', error);
      throw new Error(`Falha ao gerar QR code: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
}
