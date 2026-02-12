import { Request, Response } from 'express';
import { PesquisaPrecoRepository } from '../repositories/PesquisaPrecoRepository';

/**
 * Controller para pesquisas de preço (criar, listar, detalhe, adicionar itens).
 */
export class PesquisaController {
  constructor(private readonly pesquisaRepository: PesquisaPrecoRepository) { }

  /**
   * POST /api/pesquisas — body: { nome, descricao?, tenantId, usuarioId, itemLicitacaoIds? }
   * Se itemLicitacaoIds for enviado, a cotação é criada já com os itens selecionados.
   */
  public async criar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, descricao, tenantId, usuarioId, itemLicitacaoIds } = req.body ?? {};
      if (!nome || !tenantId || !usuarioId) {
        res.status(400).json({
          success: false,
          message: 'nome, tenantId e usuarioId são obrigatórios',
        });
        return;
      }

      const pesquisa = await this.pesquisaRepository.criar(
        tenantId,
        usuarioId,
        String(nome).trim(),
        descricao ? String(descricao).trim() : undefined
      );

      let itensAdicionados = 0;
      if (Array.isArray(itemLicitacaoIds) && itemLicitacaoIds.length > 0) {
        const ids = itemLicitacaoIds.filter((x: unknown) => typeof x === 'string');
        await this.pesquisaRepository.adicionarItens(pesquisa.id!, ids);
        itensAdicionados = ids.length;
      }

      console.log(`[PesquisaController.criar] Pesquisa criada com sucesso: ${pesquisa.id}, itens: ${itensAdicionados}`);
      res.status(201).json({
        success: true,
        pesquisa: this.toJson(pesquisa),
        ...(itensAdicionados > 0 && { itensAdicionados }),
      });
    } catch (error) {
      console.error('[PesquisaController.criar] Erro ao criar pesquisa:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar pesquisa';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/pesquisas?tenantId=...
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = String(req.query.tenantId ?? '').trim();
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'tenantId é obrigatório' });
        return;
      }

      const pesquisas = await this.pesquisaRepository.listarPorTenant(tenantId);
      res.status(200).json({
        success: true,
        pesquisas: pesquisas.map((p) => this.toJson(p)),
      });
    } catch (error) {
      console.error('[PesquisaController.listar] Erro ao listar pesquisas:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar pesquisas';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/pesquisas/:id — detalhe da pesquisa + itens
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const pesquisa = await this.pesquisaRepository.buscarPorId(id);
      if (!pesquisa) {
        res.status(404).json({ success: false, message: 'Pesquisa não encontrada' });
        return;
      }

      const itens = await this.pesquisaRepository.buscarItensDaPesquisa(id);
      res.status(200).json({
        success: true,
        pesquisa: this.toJson(pesquisa),
        itens: itens.map((item) => ({
          id: item.id,
          licitacaoId: item.licitacaoId,
          numeroItem: item.numeroItem,
          descricao: item.descricao,
          valorUnitarioEstimado: item.valorUnitarioEstimado,
          valorTotal: item.valorTotal,
          quantidade: item.quantidade,
          unidadeMedida: item.unidadeMedida,
        })),
      });
    } catch (error) {
      console.error('[PesquisaController.buscarPorId] Erro ao buscar pesquisa:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar pesquisa';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/pesquisas/:id/itens — body: { itemLicitacaoIds: string[] }
   */
  public async adicionarItens(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { itemLicitacaoIds } = req.body ?? {};
      if (!Array.isArray(itemLicitacaoIds)) {
        res.status(400).json({
          success: false,
          message: 'itemLicitacaoIds deve ser um array',
        });
        return;
      }

      const pesquisa = await this.pesquisaRepository.buscarPorId(id);
      if (!pesquisa) {
        res.status(404).json({ success: false, message: 'Pesquisa não encontrada' });
        return;
      }

      const ids = itemLicitacaoIds.filter((x: unknown) => typeof x === 'string');
      await this.pesquisaRepository.adicionarItens(id, ids);

      res.status(200).json({
        success: true,
        message: `${ids.length} itens adicionados`,
      });
    } catch (error) {
      console.error('[PesquisaController.adicionarItens] Erro ao adicionar itens:', error);
      const message = error instanceof Error ? error.message : 'Erro ao adicionar itens';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/pesquisas/:id/itens — body: { itemLicitacaoIds: string[] }
   */
  public async removerItens(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { itemLicitacaoIds } = req.body ?? {};
      if (!Array.isArray(itemLicitacaoIds)) {
        res.status(400).json({
          success: false,
          message: 'itemLicitacaoIds deve ser um array',
        });
        return;
      }

      const pesquisa = await this.pesquisaRepository.buscarPorId(id);
      if (!pesquisa) {
        res.status(404).json({ success: false, message: 'Pesquisa não encontrada' });
        return;
      }

      const ids = itemLicitacaoIds.filter((x: unknown) => typeof x === 'string');
      if (ids.length === 0) {
        res.status(200).json({ success: true, message: 'Nenhum item para remover' });
        return;
      }

      await this.pesquisaRepository.removerItens(id, ids);
      res.status(200).json({
        success: true,
        message: `${ids.length} itens removidos`,
      });
    } catch (error) {
      console.error('[PesquisaController.removerItens] Erro ao remover itens:', error);
      const message = error instanceof Error ? error.message : 'Erro ao remover itens';
      res.status(500).json({ success: false, message });
    }
  }

  private toJson(p: { id?: string; tenantId: string; usuarioId: string; nome: string; descricao?: string; status: string; criadoEm?: Date; atualizadoEm?: Date }) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      usuarioId: p.usuarioId,
      nome: p.nome,
      descricao: p.descricao,
      status: p.status,
      criadoEm: p.criadoEm,
      atualizadoEm: p.atualizadoEm,
    };
  }
}
