import { FornecedorRepository } from '../repositories/FornecedorRepository';
import { ItemLicitacaoRepository } from '../repositories/ItemLicitacaoRepository';
import { LicitacaoRepository } from '../repositories/LicitacaoRepository';
import { PNCPResultadoGateway } from '../gateways/PNCPResultadoGateway';
import { ReceitaWSGateway } from '../gateways/ReceitaWSGateway';
import { Fornecedor } from '../domain/Fornecedor';

/**
 * Service para gerenciar fornecedores vencedores de licitações.
 * Implementa cache e otimizações para evitar chamadas duplicadas nas APIs externas.
 */
export class FornecedorService {
  constructor(
    private readonly fornecedorRepo: FornecedorRepository,
    private readonly itemLicitacaoRepo: ItemLicitacaoRepository,
    private readonly licitacaoRepo: LicitacaoRepository,
    private readonly pncpGateway: PNCPResultadoGateway,
    private readonly receitaWsGateway: ReceitaWSGateway
  ) {}

  /**
   * Busca ou cria um fornecedor para um item de licitação.
   * Fluxo completo com otimizações:
   * 1. Verifica se item já tem fornecedor vinculado (cache)
   * 2. Busca resultado na API PNCP
   * 3. Verifica se fornecedor já existe no banco (por CNPJ)
   * 4. Busca dados completos na ReceitaWS (se necessário)
   * 5. Cria/atualiza fornecedor
   * 6. Vincula ao item de licitação
   *
   * @param itemLicitacaoId ID do item de licitação
   * @param tenantId ID do tenant
   * @returns Fornecedor encontrado ou criado
   */
  public async buscarOuCriarFornecedor(
    itemLicitacaoId: string,
    tenantId: string
  ): Promise<Fornecedor> {
    console.log(`[FornecedorService.buscarOuCriarFornecedor] Iniciando para item ${itemLicitacaoId}`);

    // 1. Verificar se item já tem fornecedor vinculado (cache)
    const fornecedorCacheado = await this.fornecedorRepo.buscarPorItemLicitacao(itemLicitacaoId);
    if (fornecedorCacheado) {
      console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor já vinculado (cache): ${fornecedorCacheado.id}`);
      return fornecedorCacheado;
    }

    // 2. Buscar dados do item de licitação
    const itemLicitacao = await this.itemLicitacaoRepo.buscarPorId(itemLicitacaoId);
    if (!itemLicitacao) {
      throw new Error(`Item de licitação ${itemLicitacaoId} não encontrado`);
    }

    // Verificar se item tem flag indicando que possui resultado
    if (!itemLicitacao.temResultado) {
      console.log(`[FornecedorService.buscarOuCriarFornecedor] Item não possui resultado homologado (tem_resultado=false)`);
      throw new Error('Este item de licitação não possui resultado homologado');
    }

    // Buscar dados da licitação (para obter CNPJ do órgão, ano, sequencial)
    const licitacao = await this.licitacaoRepo.buscarPorId(itemLicitacao.licitacaoId);
    if (!licitacao) {
      throw new Error('Licitação não encontrada para o item');
    }

    // 3. Buscar resultado na API PNCP
    console.log(`[FornecedorService.buscarOuCriarFornecedor] Buscando resultado no PNCP...`);
    const resultado = await this.pncpGateway.buscarResultadoItem(
      licitacao.cnpjOrgao,
      licitacao.anoCompra,
      licitacao.sequencialCompra,
      itemLicitacao.numeroItem
    );

    if (!resultado || !resultado.niFornecedor) {
      throw new Error('Fornecedor não encontrado no resultado da licitação (PNCP)');
    }

    console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor PNCP: ${resultado.nomeRazaoSocialFornecedor} (${resultado.niFornecedor})`);

    // 4. Verificar se fornecedor já existe no banco (por CNPJ)
    let fornecedor = await this.fornecedorRepo.buscarPorCnpj(resultado.niFornecedor, tenantId);

    if (fornecedor) {
      console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor já existe no banco: ${fornecedor.id}`);

      // Se não tem dados completos, buscar e atualizar
      if (!fornecedor.dadosCompletos) {
        console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor sem dados completos, buscando na ReceitaWS...`);
        fornecedor = await this.atualizarDadosCompletos(fornecedor.id!, resultado.niFornecedor);
      }
    } else {
      // 5. Buscar dados completos na ReceitaWS e criar fornecedor
      console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor novo, buscando dados completos na ReceitaWS...`);
      fornecedor = await this.criarFornecedorCompleto(
        tenantId,
        resultado.niFornecedor,
        resultado.tipoPessoa,
        resultado.nomeRazaoSocialFornecedor
      );
    }

    // 6. Vincular fornecedor ao item de licitação
    await this.fornecedorRepo.vincularAoItemLicitacao(itemLicitacaoId, fornecedor.id!);
    console.log(`[FornecedorService.buscarOuCriarFornecedor] Fornecedor vinculado ao item ${itemLicitacaoId}`);

    return fornecedor;
  }

  /**
   * Cria um fornecedor com dados completos (PNCP + ReceitaWS).
   */
  private async criarFornecedorCompleto(
    tenantId: string,
    cnpj: string,
    tipoPessoa: 'PJ' | 'PF',
    razaoSocialPNCP: string
  ): Promise<Fornecedor> {
    try {
      // Buscar dados completos na ReceitaWS
      const dadosReceita = await this.receitaWsGateway.buscarCnpj(cnpj);

      // Criar fornecedor com dados completos
      return await this.fornecedorRepo.criar({
        tenantId,
        cnpj: dadosReceita.cnpj, // CNPJ formatado da ReceitaWS
        tipoPessoa,
        razaoSocial: dadosReceita.nome,
        nomeFantasia: dadosReceita.fantasia || undefined,
        porte: dadosReceita.porte || undefined,
        naturezaJuridica: dadosReceita.natureza_juridica || undefined,
        situacao: dadosReceita.situacao || undefined,
        dataAbertura: this.receitaWsGateway.parseDataBrasileira(dadosReceita.abertura),
        logradouro: dadosReceita.logradouro || undefined,
        numero: dadosReceita.numero || undefined,
        complemento: dadosReceita.complemento || undefined,
        bairro: dadosReceita.bairro || undefined,
        municipio: dadosReceita.municipio || undefined,
        uf: dadosReceita.uf || undefined,
        cep: dadosReceita.cep || undefined,
        email: dadosReceita.email || undefined,
        telefone: dadosReceita.telefone || undefined,
        atividadePrincipal: dadosReceita.atividade_principal?.[0] || undefined,
        atividadesSecundarias: dadosReceita.atividades_secundarias || undefined,
        dadosCompletos: true,
      });
    } catch (error: any) {
      console.error(`[FornecedorService.criarFornecedorCompleto] Erro ao buscar ReceitaWS:`, error.message);

      // Fallback: criar fornecedor apenas com dados básicos do PNCP
      console.log(`[FornecedorService.criarFornecedorCompleto] Criando fornecedor com dados básicos do PNCP`);
      return await this.fornecedorRepo.criar({
        tenantId,
        cnpj,
        tipoPessoa,
        razaoSocial: razaoSocialPNCP,
        dadosCompletos: false,
      });
    }
  }

  /**
   * Atualiza um fornecedor com dados completos da ReceitaWS.
   */
  private async atualizarDadosCompletos(
    fornecedorId: string,
    cnpj: string
  ): Promise<Fornecedor> {
    try {
      const dadosReceita = await this.receitaWsGateway.buscarCnpj(cnpj);

      return await this.fornecedorRepo.atualizar(fornecedorId, {
        nomeFantasia: dadosReceita.fantasia || undefined,
        porte: dadosReceita.porte || undefined,
        naturezaJuridica: dadosReceita.natureza_juridica || undefined,
        situacao: dadosReceita.situacao || undefined,
        dataAbertura: this.receitaWsGateway.parseDataBrasileira(dadosReceita.abertura),
        logradouro: dadosReceita.logradouro || undefined,
        numero: dadosReceita.numero || undefined,
        complemento: dadosReceita.complemento || undefined,
        bairro: dadosReceita.bairro || undefined,
        municipio: dadosReceita.municipio || undefined,
        uf: dadosReceita.uf || undefined,
        cep: dadosReceita.cep || undefined,
        email: dadosReceita.email || undefined,
        telefone: dadosReceita.telefone || undefined,
        atividadePrincipal: dadosReceita.atividade_principal?.[0] || undefined,
        atividadesSecundarias: dadosReceita.atividades_secundarias || undefined,
        dadosCompletos: true,
      });
    } catch (error: any) {
      console.error(`[FornecedorService.atualizarDadosCompletos] Erro ao buscar ReceitaWS:`, error.message);
      // Retorna fornecedor sem atualização (dados básicos do PNCP permanecem)
      const fornecedor = await this.fornecedorRepo.buscarPorId(fornecedorId);
      if (!fornecedor) throw new Error('Fornecedor não encontrado');
      return fornecedor;
    }
  }

  /**
   * Busca um fornecedor por ID.
   */
  public async buscarPorId(id: string, tenantId: string): Promise<Fornecedor | null> {
    const fornecedor = await this.fornecedorRepo.buscarPorId(id);
    if (!fornecedor || fornecedor.tenantId !== tenantId) {
      return null;
    }
    return fornecedor;
  }

  /**
   * Lista todos os fornecedores de um tenant.
   */
  public async listarPorTenant(tenantId: string): Promise<Fornecedor[]> {
    return await this.fornecedorRepo.listarPorTenant(tenantId);
  }
}
