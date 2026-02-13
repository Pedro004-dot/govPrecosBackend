import express, { Request, Response } from 'express';
import cors from 'cors';
import { Database } from './infra/db';
import { LicitacaoRepository } from './repositories/LicitacaoRepository';
import { ItemLicitacaoRepository } from './repositories/ItemLicitacaoRepository';
import { MunicipioRepository } from './repositories/MunicipioRepository';
import { PesquisaPrecoRepository } from './repositories/PesquisaPrecoRepository';
import { RelatorioRepository } from './repositories/RelatorioRepository';
import { GovernoApiGateway } from './gateways/GovernoApiGateway';
import { EnriquecedorItemService } from './services/EnriquecedorItemService';
import { SincronizadorGovernoService } from './services/SincronizadorGovernoService';
import { ItemService } from './services/ItemService';
import { PlanilhaCotacaoService } from './services/PlanilhaCotacaoService';
import { CalculadoraEstatisticaService } from './services/CalculadoraEstatisticaService';
import { RelatorioService } from './services/RelatorioService';
import { SincronizacaoController } from './controllers/SincronizacaoController';
import { ItemController } from './controllers/ItemController';
import { PesquisaController } from './controllers/PesquisaController';
import { ConsolidacaoController } from './controllers/ConsolidacaoController';
import { RelatorioController } from './controllers/RelatorioController';
import { createAdminRoutes } from './routes/admin.routes';
import { createItemRoutes } from './routes/item.routes';
import { createPesquisaRoutes } from './routes/pesquisa.routes';
import { createProjetoRoutes, createItemRoutes as createProjetoItemRoutes, createFonteRoutes } from './routes/projeto.routes';
import { createFornecedorRoutes, createItemLicitacaoFornecedorRoutes } from './routes/fornecedor.routes';
import { ProjetoRepository } from './repositories/ProjetoRepository';
import { ProjetoItemRepository } from './repositories/ProjetoItemRepository';
import { ItemFonteRepository } from './repositories/ItemFonteRepository';
import { ProjetoValidacaoService } from './services/ProjetoValidacaoService';
import { ProjetoRelatorioService } from './services/ProjetoRelatorioService';
import { ProjetoController } from './controllers/ProjetoController';
import { ProjetoItemController } from './controllers/ProjetoItemController';
import { FornecedorRepository } from './repositories/FornecedorRepository';
import { PNCPResultadoGateway } from './gateways/PNCPResultadoGateway';
import { ReceitaWSGateway } from './gateways/ReceitaWSGateway';
import { FornecedorService } from './services/FornecedorService';
import { FornecedorController } from './controllers/FornecedorController';

// ============================================
// SISTEMA DE AUTENTICAÇÃO
// ============================================
import { UsuarioRepository } from './repositories/UsuarioRepository';
import { PasswordResetRepository } from './repositories/PasswordResetRepository';
import { TenantRepository } from './repositories/TenantRepository';
import { AuditService } from './services/AuditService';
import { AuthService } from './services/AuthService';
import { UserService } from './services/UserService';
import { TenantService } from './services/TenantService';
import { AuthController } from './controllers/AuthController';
import { UserController } from './controllers/UserController';
import { TenantController } from './controllers/TenantController';
import { createAuthRoutes } from './routes/auth.routes';
import { createUserRoutes } from './routes/user.routes';
import { createTenantRoutes } from './routes/tenant.routes';
import { MunicipioController } from './controllers/MunicipioController';
import { createMunicipioRoutes } from './routes/municipio.routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

const db = Database.getInstance();
const licitacaoRepository = new LicitacaoRepository(db);
const itemLicitacaoRepository = new ItemLicitacaoRepository(db);
const municipioRepository = new MunicipioRepository(db);
const governoApiGateway = new GovernoApiGateway(30000);
const enriquecedorItemService = new EnriquecedorItemService(
  governoApiGateway,
  itemLicitacaoRepository
);
const sincronizadorGovernoService = new SincronizadorGovernoService(
  governoApiGateway,
  licitacaoRepository,
  enriquecedorItemService
);
const sincronizacaoController = new SincronizacaoController(sincronizadorGovernoService);
const itemService = new ItemService(itemLicitacaoRepository, municipioRepository);
const planilhaCotacaoService = new PlanilhaCotacaoService(itemLicitacaoRepository);
const itemController = new ItemController(itemService, planilhaCotacaoService);
const pesquisaPrecoRepository = new PesquisaPrecoRepository(db);
const pesquisaController = new PesquisaController(pesquisaPrecoRepository);
const calculadoraEstatistica = new CalculadoraEstatisticaService();
const consolidacaoController = new ConsolidacaoController(
  pesquisaPrecoRepository,
  calculadoraEstatistica
);
const relatorioRepository = new RelatorioRepository(db);
const relatorioService = new RelatorioService(pesquisaPrecoRepository, relatorioRepository);
const relatorioController = new RelatorioController(relatorioService);

// ============================================
// NOVO SISTEMA: Projetos (Lei 14.133/2021)
// ============================================
const projetoRepository = new ProjetoRepository(db);
const projetoItemRepository = new ProjetoItemRepository(db);
const itemFonteRepository = new ItemFonteRepository(db);
const projetoValidacaoService = new ProjetoValidacaoService(
  projetoRepository,
  projetoItemRepository,
  itemFonteRepository,
  calculadoraEstatistica
);
const projetoRelatorioService = new ProjetoRelatorioService(
  projetoRepository,
  projetoItemRepository,
  itemFonteRepository
);
const projetoController = new ProjetoController(
  projetoRepository,
  projetoItemRepository,
  projetoValidacaoService,
  projetoRelatorioService
);
const projetoItemController = new ProjetoItemController(
  projetoItemRepository,
  itemFonteRepository,
  projetoValidacaoService,
  projetoRepository
);

// ============================================
// FORNECEDORES (PNCP + ReceitaWS)
// ============================================
const fornecedorRepository = new FornecedorRepository(db);
const pncpResultadoGateway = new PNCPResultadoGateway(30000);
const receitaWsGateway = new ReceitaWSGateway(30000);
const fornecedorService = new FornecedorService(
  fornecedorRepository,
  itemLicitacaoRepository,
  licitacaoRepository,
  pncpResultadoGateway,
  receitaWsGateway
);
const fornecedorController = new FornecedorController(fornecedorService);

// ============================================
// SISTEMA DE AUTENTICAÇÃO
// ============================================
const usuarioRepository = new UsuarioRepository(db);
const passwordResetRepository = new PasswordResetRepository(db);
const tenantRepository = new TenantRepository(db);
const auditService = new AuditService(db);
const authService = new AuthService(
  usuarioRepository,
  passwordResetRepository,
  auditService
);
const userService = new UserService(usuarioRepository, auditService);
const tenantService = new TenantService(tenantRepository, auditService);
const authController = new AuthController(authService, db);
const userController = new UserController(userService);
const tenantController = new TenantController(tenantService);
const municipioController = new MunicipioController(municipioRepository);

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      message: 'Banca de Preços API',
      database: 'connected',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erro ao conectar com o banco de dados',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
app.use(cors({
  origin: 'https://gov-precos.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use('/api/admin', createAdminRoutes(sincronizacaoController));
app.use('/api/itens-licitacao', createItemRoutes(itemController)); // Renomeado para evitar conflito
app.use(
  '/api/pesquisas',
  createPesquisaRoutes(pesquisaController, consolidacaoController, relatorioController)
);

// ============================================
// NOVAS ROTAS: Projetos (Lei 14.133/2021)
// ============================================
app.use('/api/projetos', createProjetoRoutes(projetoController, projetoItemController));
app.use('/api/itens', createProjetoItemRoutes(projetoItemController)); // Rota principal de itens
app.use('/api/fontes', createFonteRoutes(projetoItemController));

// ============================================
// ROTAS: Fornecedores (PNCP + ReceitaWS)
// ============================================
app.use('/api/fornecedores', createFornecedorRoutes(fornecedorController));
app.use('/api/itens-licitacao', createItemLicitacaoFornecedorRoutes(fornecedorController)); // POST /:id/vincular-fornecedor

// ============================================
// ROTAS: Sistema de Autenticação
// ============================================
app.use('/api/auth', createAuthRoutes(authController));
app.use('/api/users', createUserRoutes(userController));
app.use('/api/tenants', createTenantRoutes(tenantController));

// ============================================
// ROTAS: Municípios (autocomplete para filtro geográfico)
// ============================================
app.use('/api/municipios', createMunicipioRoutes(municipioController));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('Encerrando conexões...');
  
});
