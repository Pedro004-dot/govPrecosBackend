import { Request, Response } from 'express';
import { ProjetoRepository } from '../repositories/ProjetoRepository';
import { ProjetoItemRepository } from '../repositories/ProjetoItemRepository';
import { ProjetoValidacaoService } from '../services/ProjetoValidacaoService';
import { ProjetoRelatorioService, TipoRelatorio } from '../services/ProjetoRelatorioService';
import { SupabaseStorageService } from '../services/SupabaseStorageService';
import { RelatorioRepository } from '../repositories/RelatorioRepository';
import { Projeto } from '../domain/Projeto';
import crypto from 'crypto';

/**
 * Controller para projetos de pesquisa de preços (Lei 14.133/2021).
 */
export class ProjetoController {
  private readonly storageService: SupabaseStorageService;

  constructor(
    private readonly projetoRepository: ProjetoRepository,
    private readonly itemRepository: ProjetoItemRepository,
    private readonly validacaoService: ProjetoValidacaoService,
    private readonly relatorioService: ProjetoRelatorioService,
    private readonly relatorioRepository: RelatorioRepository
  ) {
    this.storageService = new SupabaseStorageService();
  }

  /**
   * POST /api/projetos
   * Body: { nome, descricao?, numeroProcesso?, objeto? }
   * IMPORTANTE: tenantId e usuarioId são obtidos do usuário autenticado
   */
  public async criar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const { nome, descricao, numeroProcesso, objeto } = req.body ?? {};

      if (!nome) {
        res.status(400).json({
          success: false,
          message: 'nome é obrigatório',
        });
        return;
      }

      if (!usuario.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Usuário não está associado a uma prefeitura',
        });
        return;
      }

      const projeto = await this.projetoRepository.criar(
        usuario.tenantId,
        usuario.id,
        String(nome).trim(),
        descricao ? String(descricao).trim() : undefined,
        numeroProcesso ? String(numeroProcesso).trim() : undefined,
        objeto ? String(objeto).trim() : undefined
      );

      console.log(`[ProjetoController.criar] Projeto criado: ${projeto.id}`);
      res.status(201).json({
        success: true,
        projeto: this.toJson(projeto),
      });
    } catch (error) {
      console.error('[ProjetoController.criar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/projetos?incluirArquivados=false
   * IMPORTANTE: tenantId é obtido do usuário autenticado
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const incluirArquivados = req.query.incluirArquivados === 'true';

      if (!usuario.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Usuário não está associado a uma prefeitura'
        });
        return;
      }

      const projetos = await this.projetoRepository.listarPorTenant(usuario.tenantId, incluirArquivados);
      res.status(200).json({
        success: true,
        projetos: projetos.map((p) => this.toJson(p)),
      });
    } catch (error) {
      console.error('[ProjetoController.listar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar projetos';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/projetos/:id
   * Retorna projeto com lista de itens
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;
      const projeto = await this.projetoRepository.buscarPorId(id);

      if (!projeto) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para acessar este projeto'
        });
        return;
      }

      const itens = await this.itemRepository.listarPorProjeto(id);

      res.status(200).json({
        success: true,
        projeto: this.toJson(projeto),
        itens: itens.map((item) => ({
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
        })),
      });
    } catch (error) {
      console.error('[ProjetoController.buscarPorId] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * PUT /api/projetos/:id
   * Body: { nome?, descricao?, numeroProcesso?, objeto?, status? }
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;
      const { nome, descricao, numeroProcesso, objeto, status } = req.body ?? {};

      const projetoExistente = await this.projetoRepository.buscarPorId(id);
      if (!projetoExistente) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projetoExistente.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para atualizar este projeto'
        });
        return;
      }

      const projeto = await this.projetoRepository.atualizar(id, {
        nome: nome ? String(nome).trim() : undefined,
        descricao: descricao !== undefined ? String(descricao).trim() : undefined,
        numeroProcesso: numeroProcesso !== undefined ? String(numeroProcesso).trim() : undefined,
        objeto: objeto !== undefined ? String(objeto).trim() : undefined,
        status: status,
      });

      res.status(200).json({
        success: true,
        projeto: this.toJson(projeto),
      });
    } catch (error) {
      console.error('[ProjetoController.atualizar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/projetos/:id/finalizar
   * Finaliza o projeto (valida 3+ fontes por item, marca como 'finalizado')
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async finalizar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;
      const { justificativaOverride } = req.body ?? {};

      const projeto = await this.projetoRepository.buscarPorId(id);
      if (!projeto) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para finalizar este projeto'
        });
        return;
      }

      if (!projeto.podeSerFinalizado()) {
        res.status(400).json({
          success: false,
          message: `Projeto com status '${projeto.status}' não pode ser finalizado`,
        });
        return;
      }

      // Validar integridade (mínimo 3 fontes por item)
      const validacao = await this.projetoRepository.validarIntegridade(id);

      if (!validacao.valido && !justificativaOverride) {
        res.status(400).json({
          success: false,
          message: validacao.mensagem,
          validacao,
          hint: 'Para sobrescrever esta validação, forneça justificativaOverride no body (admin apenas)',
        });
        return;
      }

      // Finalizar projeto
      const projetoFinalizado = await this.projetoRepository.finalizarProjeto(id);

      console.log(`[ProjetoController.finalizar] Projeto finalizado: ${id}`);
      res.status(200).json({
        success: true,
        projeto: this.toJson(projetoFinalizado),
        validacao,
        ...(justificativaOverride && { override: justificativaOverride }),
      });
    } catch (error) {
      console.error('[ProjetoController.finalizar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao finalizar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/projetos/:id/validar
   * Retorna resultado de validação do projeto (3+ fontes, recência, outliers)
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async validar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;

      const projeto = await this.projetoRepository.buscarPorId(id);
      if (!projeto) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para validar este projeto'
        });
        return;
      }

      const resultado = await this.validacaoService.validarProjeto(id);

      res.status(200).json({
        success: true,
        validacao: resultado,
      });
    } catch (error) {
      console.error('[ProjetoController.validar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao validar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/projetos/:id
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async deletar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;

      const projeto = await this.projetoRepository.buscarPorId(id);
      if (!projeto) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para deletar este projeto'
        });
        return;
      }

      if (projeto.isFinalizado()) {
        res.status(400).json({
          success: false,
          message: 'Não é possível deletar um projeto finalizado',
        });
        return;
      }

      await this.projetoRepository.deletar(id);

      console.log(`[ProjetoController.deletar] Projeto deletado: ${id}`);
      res.status(200).json({
        success: true,
        message: 'Projeto deletado com sucesso',
      });
    } catch (error) {
      console.error('[ProjetoController.deletar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao deletar projeto';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/projetos/:id/relatorio?tipo=completo|resumido|xlsx
   * Gera relatório PDF ou XLSX do projeto
   * IMPORTANTE: Valida que o projeto pertence ao tenant do usuário
   */
  public async gerarRelatorio(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario!;
      const id = req.params.id;
      const tipoParam = (req.query.tipo as string) || 'completo';
      const tipo: TipoRelatorio = ['completo', 'resumido', 'xlsx'].includes(tipoParam)
        ? (tipoParam as TipoRelatorio)
        : 'completo';

      const projeto = await this.projetoRepository.buscarPorId(id);
      if (!projeto) {
        res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return;
      }

      // Validar que o projeto pertence ao tenant do usuário
      if (projeto.tenantId !== usuario.tenantId && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para gerar relatório deste projeto'
        });
        return;
      }

      // Para PDF: gerar versão temporária, fazer upload para obter URL, depois regenerar com QR code
      // Para XLSX: gerar direto e fazer upload
      let buffer: Buffer;
      let urlPublica: string | undefined;

      if (tipo === 'xlsx') {
        // XLSX não precisa de QR code, gerar e fazer upload direto
        buffer = await this.relatorioService.gerarRelatorio(id, tipo);
        try {
          urlPublica = await this.storageService.uploadRelatorio(
            id,
            projeto.tenantId,
            buffer,
            tipo
          );
        } catch (storageError) {
          console.error('[ProjetoController.gerarRelatorio] Erro no upload XLSX:', storageError);
        }
      } else {
        // PDF: gerar versão temporária, upload, regenerar com QR code, upload final
        try {
          // 1. Gerar PDF temporário sem QR code
          const bufferTemp = await this.relatorioService.gerarRelatorio(id, tipo);
          
          // 2. Fazer upload temporário para obter URL pública
          urlPublica = await this.storageService.uploadRelatorio(
            id,
            projeto.tenantId,
            bufferTemp,
            tipo
          );

          // 3. Regenerar PDF COM QR code usando a URL pública
          buffer = await this.relatorioService.gerarRelatorio(id, tipo, urlPublica);

          // 4. Fazer upload final do PDF com QR code (sobrescrever o anterior)
          urlPublica = await this.storageService.uploadRelatorio(
            id,
            projeto.tenantId,
            buffer,
            tipo
          );
        } catch (storageError) {
          console.error('[ProjetoController.gerarRelatorio] Erro no upload PDF:', storageError);
          // Se upload falhar, gerar PDF sem QR code
          buffer = await this.relatorioService.gerarRelatorio(id, tipo);
        }
      }

      // Não criar registro na tabela relatorios (ela tem FK para pesquisas_preco, não projetos)
      // A tabela relatorios é do sistema antigo. Em futura versão, criar tabela projeto_relatorios se necessário

      // Configurar headers para download
      const extensao = tipo === 'xlsx' ? 'xlsx' : 'pdf';
      const contentType = tipo === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Relatorio_${projeto.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${extensao}"`
      );
      res.setHeader('Content-Length', buffer.length);

      // Enviar arquivo
      res.send(buffer);

      console.log(`[ProjetoController.gerarRelatorio] Relatório ${tipo} gerado para projeto: ${id}${urlPublica ? ` (URL: ${urlPublica})` : ''}`);
    } catch (error) {
      console.error('[ProjetoController.gerarRelatorio] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      res.status(500).json({ success: false, message });
    }
  }

  private toJson(p: Projeto) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      usuarioId: p.usuarioId,
      nome: p.nome,
      descricao: p.descricao,
      numeroProcesso: p.numeroProcesso,
      objeto: p.objeto,
      status: p.status,
      dataFinalizacao: p.dataFinalizacao,
      criadoEm: p.criadoEm,
      atualizadoEm: p.atualizadoEm,
    };
  }
}
