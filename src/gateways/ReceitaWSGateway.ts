import axios, { AxiosInstance } from 'axios';

/**
 * Interface para os dados retornados pela API ReceitaWS.
 */
export interface ReceitaWSRaw {
  abertura: string; // dd/mm/yyyy
  situacao: string;
  tipo: string;
  nome: string; // Razão social
  fantasia: string; // Nome fantasia
  porte: string;
  natureza_juridica: string;
  atividade_principal: Array<{
    code: string;
    text: string;
  }>;
  atividades_secundarias: Array<{
    code: string;
    text: string;
  }>;
  qsa: Array<{
    nome: string;
    qual: string;
  }>;
  logradouro: string;
  numero: string;
  complemento: string;
  municipio: string;
  bairro: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  data_situacao: string; // dd/mm/yyyy
  cnpj: string; // Formatado: 00.000.000/0000-00
  ultima_atualizacao: string; // ISO 8601
  status: string; // "OK" ou "ERROR"
  efr: string;
  motivo_situacao: string;
  situacao_especial: string;
  data_situacao_especial: string;
  capital_social: string;
  simples?: {
    optante: boolean;
    data_opcao: string | null;
    data_exclusao: string | null;
    ultima_atualizacao: string;
  };
  simei?: {
    optante: boolean;
    data_opcao: string | null;
    data_exclusao: string | null;
    ultima_atualizacao: string;
  };
  extra: any;
  billing: {
    free: boolean;
    database: boolean;
  };
  message?: string; // Em caso de erro
}

/**
 * Gateway para buscar dados de CNPJ na API ReceitaWS.
 * IMPORTANTE: API gratuita com limite de ~3 requisições/minuto.
 */
export class ReceitaWSGateway {
  private client: AxiosInstance;
  private baseUrl = 'https://www.receitaws.com.br/v1';

  constructor(timeoutMs: number = 30000) {
    this.client = axios.create({
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  /**
   * Busca dados completos de um CNPJ na ReceitaWS.
   *
   * @param cnpj CNPJ do fornecedor (com ou sem formatação)
   * @returns Dados do CNPJ ou null se não encontrado
   *
   * URL: /cnpj/{cnpj}
   * Exemplo: /cnpj/22525517000137
   *
   * ATENÇÃO: API gratuita tem limite de requisições. Considere:
   * - Retry com backoff exponencial
   * - Cache agressivo (TTL de 6 meses)
   * - Fila/queue para batch processing
   */
  public async buscarCnpj(cnpj: string): Promise<ReceitaWSRaw> {
    try {
      const cnpjLimpo = this.limparCnpj(cnpj);
      const url = `${this.baseUrl}/cnpj/${cnpjLimpo}`;

      console.log(`[ReceitaWSGateway.buscarCnpj] GET ${url}`);

      const response = await this.client.get<ReceitaWSRaw>(url);

      // ReceitaWS retorna status: "ERROR" em caso de erro
      if (response.data.status === 'ERROR') {
        const message = response.data.message || 'Erro desconhecido na ReceitaWS';
        console.error(`[ReceitaWSGateway.buscarCnpj] Erro: ${message}`);
        throw new Error(`ReceitaWS: ${message}`);
      }

      console.log(`[ReceitaWSGateway.buscarCnpj] CNPJ ${cnpjLimpo} encontrado: ${response.data.nome}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error(`[ReceitaWSGateway.buscarCnpj] Rate limit excedido (429 Too Many Requests)`);
        throw new Error('ReceitaWS: Limite de requisições excedido. Tente novamente em alguns minutos.');
      }

      if (error.response?.status === 404) {
        console.error(`[ReceitaWSGateway.buscarCnpj] CNPJ não encontrado (404)`);
        throw new Error(`CNPJ ${cnpj} não encontrado na Receita Federal`);
      }

      const message = error.message || 'Erro ao buscar CNPJ';
      console.error(`[ReceitaWSGateway.buscarCnpj] Erro:`, error.message);
      throw new Error(`Erro ao buscar CNPJ na ReceitaWS: ${message}`);
    }
  }

  /**
   * Converte data DD/MM/YYYY para Date.
   */
  public parseDataBrasileira(data: string): Date | undefined {
    if (!data) return undefined;
    const partes = data.split('/');
    if (partes.length !== 3) return undefined;

    const [dia, mes, ano] = partes;
    const date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Remove formatação do CNPJ (deixa apenas números).
   */
  private limparCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }
}
