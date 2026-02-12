import { GovernoApiGateway } from '../gateways/GovernoApiGateway';
import { LicitacaoRepository } from '../repositories/LicitacaoRepository';
import { EnriquecedorItemService } from './EnriquecedorItemService';
import { Licitacao } from '../domain/Licitacao';

const CODIGO_MODALIDADE_DEFAULT = 8; // Dispensa

export interface ResultadoSincronizacao {
  totalProcessadas: number;
  totalSalvas: number;
  totalItensEnriquecidos: number;
  erros: string[];
}

/**
 * Serviço que orquestra a captura de licitações das APIs 1 e 2 do PNCP,
 * filtra por valorTotalHomologado > 1, persiste e enriquece itens (API 3).
 */
export class SincronizadorGovernoService {
  constructor(
    private readonly gateway: GovernoApiGateway,
    private readonly licitacaoRepository: LicitacaoRepository,
    private readonly enriquecedorItemService: EnriquecedorItemService
  ) {}

  /**
   * Sincroniza histórico (API 1): percorre todas as páginas, filtra homologadas, upsert e enriquece itens.
   */
  public async sincronizarHistorico(
    dataInicial: Date,
    dataFinal: Date,
    codigoModalidadeContratacao: number = CODIGO_MODALIDADE_DEFAULT
  ): Promise<ResultadoSincronizacao> {
    return this.executarSincronizacao(
      (pagina) =>
        this.gateway.buscarHistorico(
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao,
          pagina
        )
    );
  }

  /**
   * Sincroniza atualizações (API 2): mesma lógica usando a API de atualização.
   */
  public async sincronizarAtualizacoes(
    dataInicial: Date,
    dataFinal: Date,
    codigoModalidadeContratacao: number = CODIGO_MODALIDADE_DEFAULT
  ): Promise<ResultadoSincronizacao> {
    return this.executarSincronizacao(
      (pagina) =>
        this.gateway.buscarAtualizacoesSemanais(
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao,
          pagina
        )
    );
  }

  /**
   * Executa o fluxo comum: paginar, filtrar valorTotalHomologado > 1, upsert, enriquecer itens.
   */
  private async executarSincronizacao(
    buscarPagina: (pagina: number) => Promise<{
      licitacoes: Licitacao[];
      totalPaginas: number;
      totalRegistros: number;
    }>
  ): Promise<ResultadoSincronizacao> {
    const resultado: ResultadoSincronizacao = {
      totalProcessadas: 0,
      totalSalvas: 0,
      totalItensEnriquecidos: 0,
      erros: [],
    };

    let pagina = 1;
    let totalPaginas = 1;

    console.log('[Sync] Início da sincronização (aguardando primeira página)...');

    do {
      try {
        console.log(`[Sync] Página ${pagina}/${pagina === 1 ? '?' : totalPaginas} — buscando...`);
        const { licitacoes, totalPaginas: total } = await buscarPagina(pagina);
        totalPaginas = total;

        if (pagina === 1) {
          console.log(`[Sync] Total de páginas: ${totalPaginas}`);
        }

        const homologadas = licitacoes.filter((l) => (l.valorTotalHomologado ?? 0) > 1);
        console.log(
          `[Sync] Página ${pagina}: ${licitacoes.length} licitações recebidas, ${homologadas.length} homologadas (valorTotalHomologado > 1)`
        );

        for (let i = 0; i < homologadas.length; i++) {
          const licitacao = homologadas[i];
          try {
            const salva = await this.licitacaoRepository.upsert(licitacao);
            resultado.totalSalvas += 1;

            const qtdItens = await this.enriquecedorItemService.enriquecer(salva);
            resultado.totalItensEnriquecidos += qtdItens;

            if ((i + 1) % 5 === 0 || i === homologadas.length - 1) {
              console.log(
                `[Sync] Página ${pagina}: ${i + 1}/${homologadas.length} licitações processadas (última: ${licitacao.numeroControlePNCP}, ${qtdItens} itens)`
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultado.erros.push(`Licitação ${licitacao.numeroControlePNCP}: ${msg}`);
            console.error(`[Sync] Erro ao processar licitação ${licitacao.numeroControlePNCP}:`, msg);
          }
        }

        resultado.totalProcessadas += licitacoes.length;
        pagina += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resultado.erros.push(`Página ${pagina}: ${msg}`);
        console.error(`[Sync] Erro na página ${pagina}:`, msg);
        pagina += 1;
      }
    } while (pagina <= totalPaginas);

    console.log('[Sync] Sincronização finalizada', {
      totalProcessadas: resultado.totalProcessadas,
      totalSalvas: resultado.totalSalvas,
      totalItensEnriquecidos: resultado.totalItensEnriquecidos,
      erros: resultado.erros.length,
    });

    return resultado;
  }
}
