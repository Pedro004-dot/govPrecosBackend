import { Router } from 'express';
import { FornecedorController } from '../controllers/FornecedorController';

/**
 * Rotas para fornecedores vencedores de licitações.
 */
export function createFornecedorRoutes(fornecedorController: FornecedorController): Router {
  const router = Router();

  // ============================================
  // ROTAS DE FORNECEDORES
  // ============================================

  // Listar fornecedores por tenant
  router.get('/', (req, res) => fornecedorController.listar(req, res));

  // Buscar fornecedor por ID
  router.get('/:id', (req, res) => fornecedorController.buscarPorId(req, res));

  return router;
}

/**
 * Rotas para vincular fornecedores a itens de licitação.
 */
export function createItemLicitacaoFornecedorRoutes(fornecedorController: FornecedorController): Router {
  const router = Router();

  // ============================================
  // ROTAS DE VINCULAÇÃO
  // ============================================

  // Buscar e vincular fornecedor a um item de licitação
  // POST /api/itens-licitacao/:id/vincular-fornecedor
  router.post('/:id/vincular-fornecedor', (req, res) => fornecedorController.vincularFornecedor(req, res));

  return router;
}
