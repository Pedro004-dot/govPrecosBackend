/**
 * Entidade de Domínio: Fornecedor
 * Representa um fornecedor vencedor de licitação conforme dados do PNCP e ReceitaWS.
 */
export class Fornecedor {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly cnpj: string;
  public readonly tipoPessoa: 'PJ' | 'PF';
  public readonly razaoSocial: string;
  public readonly nomeFantasia?: string;
  public readonly porte?: string;
  public readonly naturezaJuridica?: string;
  public readonly situacao?: string;
  public readonly dataAbertura?: Date;

  // Endereço
  public readonly logradouro?: string;
  public readonly numero?: string;
  public readonly complemento?: string;
  public readonly bairro?: string;
  public readonly municipio?: string;
  public readonly uf?: string;
  public readonly cep?: string;

  // Contato
  public readonly email?: string;
  public readonly telefone?: string;

  // Atividades (JSON)
  public readonly atividadePrincipal?: { code: string; text: string };
  public readonly atividadesSecundarias?: Array<{ code: string; text: string }>;

  // Controle
  public readonly dadosCompletos: boolean;
  public readonly ultimaAtualizacaoReceita?: Date;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    tenantId: string;
    cnpj: string;
    tipoPessoa?: 'PJ' | 'PF';
    razaoSocial: string;
    nomeFantasia?: string;
    porte?: string;
    naturezaJuridica?: string;
    situacao?: string;
    dataAbertura?: Date;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    email?: string;
    telefone?: string;
    atividadePrincipal?: { code: string; text: string };
    atividadesSecundarias?: Array<{ code: string; text: string }>;
    dadosCompletos?: boolean;
    ultimaAtualizacaoReceita?: Date;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.cnpj = data.cnpj;
    this.tipoPessoa = data.tipoPessoa ?? 'PJ';
    this.razaoSocial = data.razaoSocial;
    this.nomeFantasia = data.nomeFantasia;
    this.porte = data.porte;
    this.naturezaJuridica = data.naturezaJuridica;
    this.situacao = data.situacao;
    this.dataAbertura = data.dataAbertura;
    this.logradouro = data.logradouro;
    this.numero = data.numero;
    this.complemento = data.complemento;
    this.bairro = data.bairro;
    this.municipio = data.municipio;
    this.uf = data.uf;
    this.cep = data.cep;
    this.email = data.email;
    this.telefone = data.telefone;
    this.atividadePrincipal = data.atividadePrincipal;
    this.atividadesSecundarias = data.atividadesSecundarias;
    this.dadosCompletos = data.dadosCompletos ?? false;
    this.ultimaAtualizacaoReceita = data.ultimaAtualizacaoReceita;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }

  /**
   * Verifica se o fornecedor possui dados completos da ReceitaWS.
   */
  public temDadosCompletos(): boolean {
    return this.dadosCompletos;
  }

  /**
   * Verifica se o fornecedor está ativo.
   */
  public isAtivo(): boolean {
    return this.situacao === 'ATIVA' || this.situacao === 'ativa';
  }

  /**
   * Retorna o nome para exibição (fantasia se existir, senão razão social).
   */
  public getNomeExibicao(): string {
    return this.nomeFantasia || this.razaoSocial;
  }

  /**
   * Formata o CNPJ para exibição (00.000.000/0000-00).
   */
  public getCnpjFormatado(): string {
    const cnpjLimpo = this.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return this.cnpj;

    return cnpjLimpo.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  /**
   * Remove formatação do CNPJ.
   */
  public static limparCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }
}
