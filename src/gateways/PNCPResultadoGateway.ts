import axios, { AxiosInstance } from 'axios';

/**
 * Interface para o resultado de um item de licitação retornado pela API do PNCP.
 */
export interface PNCPResultadoRaw {
  numeroControlePNCPCompra: string;
  dataAtualizacao: string;
  niFornecedor: string;
  tipoPessoa: 'PJ' | 'PF';
  dataInclusao: string;
  numeroItem: number;
  valorTotalHomologado: number;
  timezoneCotacaoMoedaEstrangeira: string | null;
  moedaEstrangeira: string | null;
  valorNominalMoedaEstrangeira: number | null;
  dataCotacaoMoedaEstrangeira: string | null;
  nomeRazaoSocialFornecedor: string;
  codigoPais: string;
  porteFornecedorId: number;
  quantidadeHomologada: number;
  valorUnitarioHomologado: number;
  percentualDesconto: number;
  amparoLegalMargemPreferencia: string | null;
  amparoLegalCriterioDesempate: string | null;
  paisOrigemProdutoServico: string | null;
  indicadorSubcontratacao: boolean;
  ordemClassificacaoSrp: number;
  dataResultado: string;
  motivoCancelamento: string | null;
  dataCancelamento: string | null;
  situacaoCompraItemResultadoId: number;
  situacaoCompraItemResultadoNome: string;
  porteFornecedorNome: string;
  sequencialResultado: number;
  naturezaJuridicaNome: string | null;
  aplicacaoMargemPreferencia: boolean;
  aplicacaoBeneficioMeEpp: boolean;
  aplicacaoCriterioDesempate: boolean;
  naturezaJuridicaId: number | null;
}

/**
 * Gateway para buscar resultados de itens de licitação no PNCP.
 * Usado para descobrir o fornecedor vencedor de um item específico.
 */
export class PNCPResultadoGateway {
  private client: AxiosInstance;
  private baseUrl = 'https://pncp.gov.br/api/pncp/v1';

  constructor(timeoutMs: number = 30000) {
    this.client = axios.create({
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Busca o resultado (fornecedor vencedor) de um item específico de licitação.
   *
   * @param cnpjOrgao CNPJ do órgão (com ou sem formatação)
   * @param anoCompra Ano da compra
   * @param sequencialCompra Número sequencial da compra
   * @param numeroItem Número do item na licitação
   * @returns Dados do resultado (fornecedor vencedor) ou null se não encontrado
   *
   * URL: /orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numeroItem}/resultados
   * Exemplo: /orgaos/83102277000152/compras/2025/34/itens/2/resultados
   */
  public async buscarResultadoItem(
    cnpjOrgao: string,
    anoCompra: number,
    sequencialCompra: number,
    numeroItem: number
  ): Promise<PNCPResultadoRaw | null> {
    try {
      const cnpjLimpo = this.limparCnpj(cnpjOrgao);
      const url = `${this.baseUrl}/orgaos/${cnpjLimpo}/compras/${anoCompra}/${sequencialCompra}/itens/${numeroItem}/resultados`;

      console.log(`[PNCPResultadoGateway.buscarResultadoItem] GET ${url}`);

      const response = await this.client.get<PNCPResultadoRaw[]>(url);

      // A API retorna array; pegamos o primeiro (vencedor)
      if (!response.data || response.data.length === 0) {
        console.log(`[PNCPResultadoGateway.buscarResultadoItem] Nenhum resultado encontrado para item ${numeroItem}`);
        return null;
      }

      return response.data[0];
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`[PNCPResultadoGateway.buscarResultadoItem] Item ${numeroItem} não possui resultado (404)`);
        return null;
      }

      console.error(`[PNCPResultadoGateway.buscarResultadoItem] Erro ao buscar resultado:`, error.message);
      throw new Error(`Erro ao buscar resultado do item no PNCP: ${error.message}`);
    }
  }

  /**
   * Remove formatação do CNPJ (deixa apenas números).
   */
  private limparCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }
}
