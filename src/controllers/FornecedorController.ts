import { Request, Response } from 'express';
import { FornecedorService } from '../services/FornecedorService';
import { Fornecedor } from '../domain/Fornecedor';

/**
 * Controller para gerenciar fornecedores vencedores de licitações.
 */
export class FornecedorController {
  constructor(private readonly fornecedorService: FornecedorService) {}

  /**
   * GET /api/fornecedores/:id
   * Busca fornecedor por ID.
   * Query: tenantId (obrigatório)
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
        return;
      }

      const fornecedor = await this.fornecedorService.buscarPorId(id, tenantId);

      if (!fornecedor) {
        res.status(404).json({
          success: false,
          message: 'Fornecedor não encontrado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        fornecedor: this.toJson(fornecedor),
      });
    } catch (error) {
      console.error('[FornecedorController.buscarPorId] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar fornecedor';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/fornecedores
   * Lista todos os fornecedores de um tenant.
   * Query: tenantId (obrigatório)
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
        return;
      }

      const fornecedores = await this.fornecedorService.listarPorTenant(tenantId);

      res.status(200).json({
        success: true,
        fornecedores: fornecedores.map((f) => this.toJson(f)),
        total: fornecedores.length,
      });
    } catch (error) {
      console.error('[FornecedorController.listar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar fornecedores';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/itens-licitacao/:id/vincular-fornecedor
   * Busca e vincula fornecedor ao item de licitação.
   * Body: { tenantId }
   *
   * Este endpoint:
   * 1. Verifica se item já tem fornecedor (cache)
   * 2. Busca resultado na API PNCP
   * 3. Busca ou cria fornecedor (com dados da ReceitaWS)
   * 4. Vincula fornecedor ao item
   */
  public async vincularFornecedor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; // itemLicitacaoId
      const { tenantId } = req.body;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
        return;
      }

      console.log(`[FornecedorController.vincularFornecedor] Iniciando para item ${id}`);

      const fornecedor = await this.fornecedorService.buscarOuCriarFornecedor(id, tenantId);

      console.log(`[FornecedorController.vincularFornecedor] Fornecedor vinculado: ${fornecedor.id}`);

      res.status(200).json({
        success: true,
        fornecedor: this.toJson(fornecedor),
        message: 'Fornecedor vinculado com sucesso',
      });
    } catch (error: any) {
      console.error('[FornecedorController.vincularFornecedor] Erro:', error);

      // Tratamento de erros específicos
      let statusCode = 500;
      let message = 'Erro ao vincular fornecedor';

      if (error.message.includes('não encontrado')) {
        statusCode = 404;
        message = error.message;
      } else if (error.message.includes('não possui resultado homologado')) {
        statusCode = 400;
        message = error.message;
      } else if (error.message.includes('ReceitaWS')) {
        statusCode = 503; // Service Unavailable
        message = `Erro ao buscar dados do fornecedor: ${error.message}`;
      } else if (error instanceof Error) {
        message = error.message;
      }

      res.status(statusCode).json({ success: false, message });
    }
  }

  /**
   * Serializa um Fornecedor para JSON.
   */
  private toJson(f: Fornecedor) {
    return {
      id: f.id,
      tenantId: f.tenantId,
      cnpj: f.cnpj,
      cnpjFormatado: f.getCnpjFormatado(),
      tipoPessoa: f.tipoPessoa,
      razaoSocial: f.razaoSocial,
      nomeFantasia: f.nomeFantasia,
      nomeExibicao: f.getNomeExibicao(),
      porte: f.porte,
      naturezaJuridica: f.naturezaJuridica,
      situacao: f.situacao,
      dataAbertura: f.dataAbertura,
      logradouro: f.logradouro,
      numero: f.numero,
      complemento: f.complemento,
      bairro: f.bairro,
      municipio: f.municipio,
      uf: f.uf,
      cep: f.cep,
      email: f.email,
      telefone: f.telefone,
      atividadePrincipal: f.atividadePrincipal,
      atividadesSecundarias: f.atividadesSecundarias,
      dadosCompletos: f.dadosCompletos,
      isAtivo: f.isAtivo(),
      ultimaAtualizacaoReceita: f.ultimaAtualizacaoReceita,
      criadoEm: f.criadoEm,
      atualizadoEm: f.atualizadoEm,
    };
  }
}
