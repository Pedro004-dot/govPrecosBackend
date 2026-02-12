import { Router } from 'express';
import { ProjetoController } from '../controllers/ProjetoController';
import { ProjetoItemController } from '../controllers/ProjetoItemController';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Rotas para projetos de pesquisa de preços (Lei 14.133/2021).
 * Substitui o sistema antigo de pesquisas_preco com estrutura hierárquica Projeto → Itens → Fontes.
 * TODAS as rotas requerem autenticação.
 */
export function createProjetoRoutes(
  projetoController: ProjetoController,
  itemController: ProjetoItemController
): Router {
  const router = Router();

  // Aplicar autenticação em todas as rotas
  router.use(authMiddleware);

  // ============================================
  // ROTAS DE PROJETOS
  // ============================================

  // Criar projeto
  router.post('/', (req, res) => projetoController.criar(req, res));

  // Listar projetos por tenant
  router.get('/', (req, res) => projetoController.listar(req, res));

  // Buscar projeto por ID (com itens)
  router.get('/:id', (req, res) => projetoController.buscarPorId(req, res));

  // Atualizar projeto
  router.put('/:id', (req, res) => projetoController.atualizar(req, res));

  // Deletar projeto
  router.delete('/:id', (req, res) => projetoController.deletar(req, res));

  // Validar projeto (compliance Lei 14.133/2021)
  router.get('/:id/validar', (req, res) => projetoController.validar(req, res));

  // Finalizar projeto (marca como 'finalizado', valida 3+ fontes por item)
  router.post('/:id/finalizar', (req, res) => projetoController.finalizar(req, res));

  // Gerar relatório PDF do projeto
  router.post('/:id/relatorio', (req, res) => projetoController.gerarRelatorio(req, res));

  // ============================================
  // ROTAS DE ITENS
  // ============================================

  // Criar item em um projeto
  router.post('/:projetoId/itens', (req, res) => itemController.criar(req, res));

  // Listar itens de um projeto
  router.get('/:projetoId/itens', (req, res) => itemController.listar(req, res));

  return router;
}

/**
 * Rotas para gerenciar itens e fontes individualmente.
 * Separadas em /api/itens para melhor organização.
 * TODAS as rotas requerem autenticação.
 */
export function createItemRoutes(itemController: ProjetoItemController): Router {
  const router = Router();

  // Aplicar autenticação em todas as rotas
  router.use(authMiddleware);

  // ============================================
  // ROTAS DE ITEM
  // ============================================

  // Buscar item por ID (com fontes)
  router.get('/:id', (req, res) => itemController.buscarPorId(req, res));

  // Atualizar item
  router.put('/:id', (req, res) => itemController.atualizar(req, res));

  // Deletar item
  router.delete('/:id', (req, res) => itemController.deletar(req, res));

  // Recalcular mediana de um item
  router.post('/:id/recalcular', (req, res) => itemController.recalcularMediana(req, res));

  // ============================================
  // ROTAS DE FONTES
  // ============================================

  // Adicionar fonte PNCP a um item
  router.post('/:id/fontes', (req, res) => itemController.adicionarFonte(req, res));

  // Remover fonte de um item
  router.delete('/:id/fontes/:fonteId', (req, res) => itemController.removerFonte(req, res));

  return router;
}

/**
 * Rotas para gerenciar fontes individualmente.
 * Separadas em /api/fontes para operações diretas em fontes.
 * TODAS as rotas requerem autenticação.
 */
export function createFonteRoutes(itemController: ProjetoItemController): Router {
  const router = Router();

  // Aplicar autenticação em todas as rotas
  router.use(authMiddleware);

  // Marcar fonte como ignorada (outlier)
  router.put('/:id/ignorar', (req, res) => itemController.marcarFonteIgnorada(req, res));

  // Desmarcar fonte como ignorada (incluir no cálculo)
  router.put('/:id/incluir', (req, res) => itemController.desmarcarFonteIgnorada(req, res));

  return router;
}
