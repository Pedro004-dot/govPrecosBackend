import { ItemLicitacaoRepository } from '../repositories/ItemLicitacaoRepository';
import { MunicipioRepository } from '../repositories/MunicipioRepository';
import { calcularDistanciaKm } from '../infra/haversine';
import { ItemLicitacao } from '../domain/ItemLicitacao';

export interface ItemParaCotacao {
  item: ItemLicitacao;
  distanciaKm?: number;
  municipioNome?: string | null;
  ufSigla?: string | null;
  /**
   * Número de controle PNCP da licitação (ex: 04215147000150-1-000412/2025)
   */
  numeroControlePNCP?: string | null;
  /**
   * Data de publicação da licitação (denormalizada de licitações.data_publicacao_pncp)
   */
  dataLicitacao?: string | null;
}

export interface BuscarItensParaCotacaoResult {
  itens: ItemParaCotacao[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Serviço de cotação: busca itens por descrição e aplica filtro geográfico por raio.
 */
export class ItemService {
  constructor(
    private readonly itemRepository: ItemLicitacaoRepository,
    private readonly municipioRepository: MunicipioRepository
  ) {}

  /**
   * Busca itens por termo; se lat/lng/raioKm forem informados, filtra por distância.
   */
  public async buscarItensParaCotacao(
    q: string,
    latUsuario?: number,
    lngUsuario?: number,
    raioKm?: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<BuscarItensParaCotacaoResult> {
    const fetchLimit = raioKm != null && raioKm > 0 ? Math.min(limit * 3, 500) : limit;
    const rows = await this.itemRepository.searchByDescricaoWithLicitacao(q, fetchLimit, offset);

    if (latUsuario == null || lngUsuario == null || raioKm == null || raioKm <= 0) {
      const itens: ItemParaCotacao[] = rows.slice(0, limit).map((r) => ({
        item: r.item,
        municipioNome: r.municipioNome,
        ufSigla: r.ufSigla,
        numeroControlePNCP: r.numeroControlePNCP,
        dataLicitacao: r.dataLicitacao,
      }));
      return { itens, total: itens.length, limit, offset };
    }

    const codigosUnicos = [...new Set(rows.map((r) => r.codigoIbge).filter(Boolean))] as string[];
    const coordsMap = await this.municipioRepository.findLatLongByCodigos(codigosUnicos);

    const resultado: ItemParaCotacao[] = [];
    for (const row of rows) {
      const codigoIbge = row.codigoIbge;
      if (!codigoIbge) {
        resultado.push({
          item: row.item,
          municipioNome: row.municipioNome,
          ufSigla: row.ufSigla,
          numeroControlePNCP: row.numeroControlePNCP,
          dataLicitacao: row.dataLicitacao,
        });
        continue;
      }
      const coords = coordsMap.get(codigoIbge);
      if (!coords) continue;
      const distanciaKm = calcularDistanciaKm(
        latUsuario,
        lngUsuario,
        coords.latitude,
        coords.longitude
      );
      if (distanciaKm > raioKm) continue;
      resultado.push({
        item: row.item,
        distanciaKm: Math.round(distanciaKm * 100) / 100,
        municipioNome: row.municipioNome,
        ufSigla: row.ufSigla,
        numeroControlePNCP: row.numeroControlePNCP,
        dataLicitacao: row.dataLicitacao,
      });
    }

    resultado.sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0));
    const paginated = resultado.slice(0, limit);
    return { itens: paginated, total: paginated.length, limit, offset };
  }
}
