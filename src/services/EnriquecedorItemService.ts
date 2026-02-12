import { GovernoApiGateway } from '../gateways/GovernoApiGateway';
import { ItemLicitacaoRepository } from '../repositories/ItemLicitacaoRepository';
import { Licitacao } from '../domain/Licitacao';
import { ItemLicitacao } from '../domain/ItemLicitacao';

/**
 * Serviço que busca itens detalhados (API 3) e persiste vinculados à licitação.
 */
export class EnriquecedorItemService {
  constructor(
    private readonly gateway: GovernoApiGateway,
    private readonly itemRepository: ItemLicitacaoRepository
  ) {}

  /**
   * Busca itens da API 3 e salva na base vinculados à licitação.
   * @param licitacao Licitação já persistida (com id)
   * @returns Quantidade de itens salvos
   */
  public async enriquecer(licitacao: Licitacao): Promise<number> {
    if (!licitacao.id) {
      throw new Error('Licitacao deve possuir id para enriquecer itens');
    }

    const itens = await this.gateway.buscarDetalhesItem(
      licitacao.cnpjOrgao,
      licitacao.anoCompra,
      licitacao.sequencialCompra,
      licitacao.id
    );

    if (itens.length === 0) {
      console.log(`[Enriquecedor] ${licitacao.numeroControlePNCP}: 0 itens retornados pela API`);
      return 0;
    }

    await this.itemRepository.saveMany(itens);
    console.log(`[Enriquecedor] ${licitacao.numeroControlePNCP}: ${itens.length} itens salvos`);
    return itens.length;
  }
}
