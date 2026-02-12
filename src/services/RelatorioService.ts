import { PesquisaPrecoRepository } from '../repositories/PesquisaPrecoRepository';
import { RelatorioRepository } from '../repositories/RelatorioRepository';

export interface ResultadoGeracaoRelatorio {
  urlOuCaminho: string;
  hash?: string;
  relatorioId: string;
}

/**
 * Serviço de relatórios (esqueleto).
 * Por enquanto apenas cria registro em relatorios e retorna placeholder.
 * Geração real de PDF (pdfkit/puppeteer) e QR Code em etapa futura.
 */
export class RelatorioService {
  constructor(
    private readonly pesquisaRepository: PesquisaPrecoRepository,
    private readonly relatorioRepository: RelatorioRepository
  ) {}

  /**
   * Gera relatório para a pesquisa: cria registro e retorna placeholder.
   * @param pesquisaId ID da pesquisa
   * @param tipo 'pdf' | 'word'
   */
  public async gerar(
    pesquisaId: string,
    tipo: 'pdf' | 'word' = 'pdf'
  ): Promise<ResultadoGeracaoRelatorio> {
    const pesquisa = await this.pesquisaRepository.buscarPorId(pesquisaId);
    if (!pesquisa) {
      throw new Error('Pesquisa não encontrada');
    }

    const placeholderUrl = `/api/relatorios/placeholder/${pesquisaId}.${tipo}`;
    const placeholderHash = `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const row = await this.relatorioRepository.criar(
      pesquisaId,
      pesquisa.tenantId,
      tipo,
      placeholderUrl,
      placeholderHash
    );

    return {
      urlOuCaminho: row.url_acesso ?? placeholderUrl,
      hash: row.hash_arquivo ?? undefined,
      relatorioId: row.id,
    };
  }
}
