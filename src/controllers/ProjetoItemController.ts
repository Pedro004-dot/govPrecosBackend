import { Request, Response } from 'express';
import { ProjetoItemRepository } from '../repositories/ProjetoItemRepository';
import { ItemFonteRepository } from '../repositories/ItemFonteRepository';
import { ProjetoRepository } from '../repositories/ProjetoRepository';
import { ProjetoValidacaoService } from '../services/ProjetoValidacaoService';
import { ProjetoItem } from '../domain/ProjetoItem';

/**
 * Controller para itens de projeto e suas fontes PNCP.
 */
export class ProjetoItemController {
  constructor(
    private readonly itemRepository: ProjetoItemRepository,
    private readonly fonteRepository: ItemFonteRepository,
    private readonly validacaoService: ProjetoValidacaoService,
    private readonly projetoRepository: ProjetoRepository
  ) {}

  /**
   * Valida se o usuário tem acesso ao projeto
   */
  private async validarAcessoProjeto(projetoId: string, req: Request, res: Response): Promise<boolean> {
    const usuario = req.usuario!;
    const projeto = await this.projetoRepository.buscarPorId(projetoId);

    if (!projeto) {
      res.status(404).json({ success: false, message: 'Projeto não encontrado' });
      return false;
    }

    if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
      res.status(403).json({ success: false, message: 'Sem permissão para acessar este projeto' });
      return false;
    }

    return true;
  }

  /**
   * Valida se o usuário tem acesso ao item (via projeto)
   */
  private async validarAcessoItem(itemId: string, req: Request, res: Response): Promise<ProjetoItem | null> {
    const item = await this.itemRepository.buscarPorId(itemId);
    if (!item) {
      res.status(404).json({ success: false, message: 'Item não encontrado' });
      return null;
    }

    const temAcesso = await this.validarAcessoProjeto(item.projetoId, req, res);
    if (!temAcesso) {
      return null;
    }

    return item;
  }

  /**
   * POST /api/projetos/:projetoId/itens
   * Body: { nome, quantidade, unidadeMedida, descricao?, ordem?, observacoes? }
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async criar(req: Request, res: Response): Promise<void> {
    try {
      const projetoId = req.params.projetoId;
      const { nome, quantidade, unidadeMedida, descricao, ordem, observacoes } = req.body ?? {};

      // Validar acesso ao projeto
      const temAcesso = await this.validarAcessoProjeto(projetoId, req, res);
      if (!temAcesso) return;

      if (!nome || !quantidade || !unidadeMedida) {
        res.status(400).json({
          success: false,
          message: 'nome, quantidade e unidadeMedida são obrigatórios',
        });
        return;
      }

      if (quantidade <= 0) {
        res.status(400).json({
          success: false,
          message: 'quantidade deve ser maior que 0',
        });
        return;
      }

      const item = await this.itemRepository.criar(
        projetoId,
        String(nome).trim(),
        parseFloat(quantidade),
        String(unidadeMedida).trim(),
        descricao ? String(descricao).trim() : undefined,
        ordem !== undefined ? parseInt(ordem) : undefined,
        observacoes ? String(observacoes).trim() : undefined
      );

      console.log(`[ProjetoItemController.criar] Item criado: ${item.id}`);
      res.status(201).json({
        success: true,
        item: this.toJson(item),
      });
    } catch (error) {
      console.error('[ProjetoItemController.criar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar item';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/projetos/:projetoId/itens
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const projetoId = req.params.projetoId;

      // Validar acesso ao projeto
      const temAcesso = await this.validarAcessoProjeto(projetoId, req, res);
      if (!temAcesso) return;

      const itens = await this.itemRepository.listarPorProjeto(projetoId);

      res.status(200).json({
        success: true,
        itens: itens.map((item) => this.toJson(item)),
      });
    } catch (error) {
      console.error('[ProjetoItemController.listar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar itens';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/itens/:id
   * Retorna item com suas fontes detalhadas
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(id, req, res);
      if (!item) return;

      const fontes = await this.fonteRepository.listarFontesPorItem(id);

      res.status(200).json({
        success: true,
        item: this.toJson(item),
        fontes: fontes.map((fonte) => ({
          id: fonte.id,
          projetoItemId: fonte.projetoItemId,
          itemLicitacaoId: fonte.itemLicitacaoId,
          valorUnitario: fonte.valorUnitario,
          ignoradoCalculo: fonte.ignoradoCalculo,
          justificativaExclusao: fonte.justificativaExclusao,
          dataLicitacao: fonte.dataLicitacao,
          // Dados do PNCP
          descricaoPNCP: fonte.descricaoPNCP,
          quantidadePNCP: fonte.quantidadePNCP,
          unidadeMedidaPNCP: fonte.unidadeMedidaPNCP,
          numeroControlePNCP: fonte.numeroControlePNCP,
          razaoSocialOrgao: fonte.razaoSocialOrgao,
          municipioNome: fonte.municipioNome,
          ufSigla: fonte.ufSigla,
          numeroCompra: fonte.numeroCompra,
          criadoEm: fonte.criadoEm,
        })),
      });
    } catch (error) {
      console.error('[ProjetoItemController.buscarPorId] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar item';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * PUT /api/itens/:id
   * Body: { nome?, descricao?, quantidade?, unidadeMedida?, ordem?, observacoes? }
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { nome, descricao, quantidade, unidadeMedida, ordem, observacoes } = req.body ?? {};

      // Validar acesso ao item (via projeto)
      const itemExistente = await this.validarAcessoItem(id, req, res);
      if (!itemExistente) return;

      if (quantidade !== undefined && quantidade <= 0) {
        res.status(400).json({
          success: false,
          message: 'quantidade deve ser maior que 0',
        });
        return;
      }

      const item = await this.itemRepository.atualizar(id, {
        nome: nome ? String(nome).trim() : undefined,
        descricao: descricao !== undefined ? String(descricao).trim() : undefined,
        quantidade: quantidade !== undefined ? parseFloat(quantidade) : undefined,
        unidadeMedida: unidadeMedida ? String(unidadeMedida).trim() : undefined,
        ordem: ordem !== undefined ? parseInt(ordem) : undefined,
        observacoes: observacoes !== undefined ? String(observacoes).trim() : undefined,
      });

      res.status(200).json({
        success: true,
        item: this.toJson(item),
      });
    } catch (error) {
      console.error('[ProjetoItemController.atualizar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar item';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/itens/:id
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async deletar(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(id, req, res);
      if (!item) return;

      await this.itemRepository.deletar(id);

      console.log(`[ProjetoItemController.deletar] Item deletado: ${id}`);
      res.status(200).json({
        success: true,
        message: 'Item deletado com sucesso',
      });
    } catch (error) {
      console.error('[ProjetoItemController.deletar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao deletar item';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/itens/:id/fontes
   * Body: { itemLicitacaoId }
   * Adiciona uma fonte PNCP ao item
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async adicionarFonte(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.id;
      const { itemLicitacaoId } = req.body ?? {};

      if (!itemLicitacaoId) {
        res.status(400).json({
          success: false,
          message: 'itemLicitacaoId é obrigatório',
        });
        return;
      }

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(itemId, req, res);
      if (!item) return;

      const fonte = await this.fonteRepository.adicionarFonte(itemId, itemLicitacaoId);

      // Recalcular mediana automaticamente
      const novaMediana = await this.itemRepository.recalcularMediana(itemId);

      console.log(`[ProjetoItemController.adicionarFonte] Fonte adicionada ao item ${itemId}, nova mediana: ${novaMediana}`);
      res.status(201).json({
        success: true,
        fonte: {
          id: fonte.id,
          projetoItemId: fonte.projetoItemId,
          itemLicitacaoId: fonte.itemLicitacaoId,
          valorUnitario: fonte.valorUnitario,
          ignoradoCalculo: fonte.ignoradoCalculo,
          dataLicitacao: fonte.dataLicitacao,
        },
        medianaAtualizada: novaMediana,
      });
    } catch (error) {
      console.error('[ProjetoItemController.adicionarFonte] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao adicionar fonte';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/itens/:id/fontes/:fonteId
   * Remove uma fonte do item
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async removerFonte(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.id;
      const fonteId = req.params.fonteId;

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(itemId, req, res);
      if (!item) return;

      const fonte = await this.fonteRepository.buscarPorId(fonteId);
      if (!fonte) {
        res.status(404).json({ success: false, message: 'Fonte não encontrada' });
        return;
      }

      if (fonte.projetoItemId !== itemId) {
        res.status(400).json({
          success: false,
          message: 'Fonte não pertence a este item',
        });
        return;
      }

      await this.fonteRepository.removerFonte(fonteId);

      // Recalcular mediana automaticamente
      const novaMediana = await this.itemRepository.recalcularMediana(itemId);

      console.log(`[ProjetoItemController.removerFonte] Fonte removida do item ${itemId}, nova mediana: ${novaMediana}`);
      res.status(200).json({
        success: true,
        message: 'Fonte removida com sucesso',
        medianaAtualizada: novaMediana,
      });
    } catch (error) {
      console.error('[ProjetoItemController.removerFonte] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao remover fonte';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * PUT /api/fontes/:id/ignorar
   * Body: { justificativa }
   * Marca uma fonte como ignorada (outlier)
   * IMPORTANTE: Valida que a fonte pertence ao tenant do usuário
   */
  public async marcarFonteIgnorada(req: Request, res: Response): Promise<void> {
    try {
      const fonteId = req.params.id;
      const { justificativa } = req.body ?? {};

      if (!justificativa || String(justificativa).trim().length < 10) {
        res.status(400).json({
          success: false,
          message: 'justificativa é obrigatória (mínimo 10 caracteres)',
        });
        return;
      }

      const fonteExistente = await this.fonteRepository.buscarPorId(fonteId);
      if (!fonteExistente) {
        res.status(404).json({ success: false, message: 'Fonte não encontrada' });
        return;
      }

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(fonteExistente.projetoItemId, req, res);
      if (!item) return;

      const fonte = await this.fonteRepository.marcarIgnorada(fonteId, String(justificativa).trim());

      // Recalcular mediana automaticamente
      const novaMediana = await this.itemRepository.recalcularMediana(fonte.projetoItemId);

      console.log(`[ProjetoItemController.marcarFonteIgnorada] Fonte ${fonteId} ignorada, nova mediana: ${novaMediana}`);
      res.status(200).json({
        success: true,
        fonte: {
          id: fonte.id,
          projetoItemId: fonte.projetoItemId,
          ignoradoCalculo: fonte.ignoradoCalculo,
          justificativaExclusao: fonte.justificativaExclusao,
        },
        medianaAtualizada: novaMediana,
      });
    } catch (error) {
      console.error('[ProjetoItemController.marcarFonteIgnorada] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao marcar fonte como ignorada';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * PUT /api/fontes/:id/incluir
   * Desmarca uma fonte como ignorada (inclui no cálculo novamente)
   * IMPORTANTE: Valida que a fonte pertence ao tenant do usuário
   */
  public async desmarcarFonteIgnorada(req: Request, res: Response): Promise<void> {
    try {
      const fonteId = req.params.id;

      const fonteExistente = await this.fonteRepository.buscarPorId(fonteId);
      if (!fonteExistente) {
        res.status(404).json({ success: false, message: 'Fonte não encontrada' });
        return;
      }

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(fonteExistente.projetoItemId, req, res);
      if (!item) return;

      const fonte = await this.fonteRepository.desmarcarIgnorada(fonteId);

      // Recalcular mediana automaticamente
      const novaMediana = await this.itemRepository.recalcularMediana(fonte.projetoItemId);

      console.log(`[ProjetoItemController.desmarcarFonteIgnorada] Fonte ${fonteId} incluída, nova mediana: ${novaMediana}`);
      res.status(200).json({
        success: true,
        fonte: {
          id: fonte.id,
          projetoItemId: fonte.projetoItemId,
          ignoradoCalculo: fonte.ignoradoCalculo,
          justificativaExclusao: fonte.justificativaExclusao,
        },
        medianaAtualizada: novaMediana,
      });
    } catch (error) {
      console.error('[ProjetoItemController.desmarcarFonteIgnorada] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao desmarcar fonte como ignorada';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/itens/:id/recalcular
   * Força recálculo da mediana de um item
   * IMPORTANTE: Valida que o item pertence ao tenant do usuário
   */
  public async recalcularMediana(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.id;

      // Validar acesso ao item (via projeto)
      const item = await this.validarAcessoItem(itemId, req, res);
      if (!item) return;

      const mediana = await this.itemRepository.recalcularMediana(itemId);

      res.status(200).json({
        success: true,
        mediana,
        message: mediana !== null ? 'Mediana recalculada' : 'Item não possui fontes válidas para cálculo',
      });
    } catch (error) {
      console.error('[ProjetoItemController.recalcularMediana] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao recalcular mediana';
      res.status(500).json({ success: false, message });
    }
  }

  private toJson(item: ProjetoItem) {
    return {
      id: item.id,
      projetoId: item.projetoId,
      nome: item.nome,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidadeMedida: item.unidadeMedida,
      ordem: item.ordem,
      medianaCalculada: item.medianaCalculada,
      quantidadeFontes: item.quantidadeFontes,
      observacoes: item.observacoes,
      criadoEm: item.criadoEm,
      atualizadoEm: item.atualizadoEm,
    };
  }
}
