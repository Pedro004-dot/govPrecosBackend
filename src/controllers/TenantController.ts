import { Request, Response } from 'express';
import { TenantService } from '../services/TenantService';
import { StorageService } from '../services/StorageService';
import { TipoTenant } from '../domain/Tenant';

/**
 * Controller de tenants (prefeituras/câmaras)
 */
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly storageService?: StorageService
  ) {}

  /**
   * GET /api/tenants
   * Query: incluirInativos?
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const incluirInativos = req.query.incluirInativos === 'true';

      const tenants = await this.tenantService.listar(incluirInativos);

      res.status(200).json({
        success: true,
        tenants: tenants.map((t) => t.toJson()),
      });
    } catch (error) {
      console.error('[TenantController.listar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar tenants';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/tenants/:id
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const resultado = await this.tenantService.buscarPorIdComEstatisticas(id);

      if (!resultado) {
        res.status(404).json({ success: false, message: 'Tenant não encontrado' });
        return;
      }

      res.status(200).json({
        success: true,
        tenant: resultado.tenant.toJson(),
        estatisticas: resultado.estatisticas,
      });
    } catch (error) {
      console.error('[TenantController.buscarPorId] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar tenant';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/tenants
   * Body: { cnpj, nome, tipo }
   */
  public async criar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const { cnpj, nome, tipo } = req.body ?? {};

      if (!cnpj || !nome || !tipo) {
        res.status(400).json({
          success: false,
          message: 'cnpj, nome e tipo são obrigatórios',
        });
        return;
      }

      // Validar tipo
      const tiposValidos: TipoTenant[] = ['prefeitura', 'camara'];
      if (!tiposValidos.includes(tipo)) {
        res.status(400).json({
          success: false,
          message: `Tipo inválido. Valores válidos: ${tiposValidos.join(', ')}`,
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.criar(
        { cnpj, nome, tipo },
        usuario,
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        tenant: tenant.toJson(),
      });
    } catch (error) {
      console.error('[TenantController.criar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar tenant';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * PUT /api/tenants/:id
   * Body: { nome?, tipo?, ativo?, brasaoUrl? }
   */
  public async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const { nome, tipo, ativo, brasaoUrl } = req.body ?? {};

      // Validar tipo se fornecido
      if (tipo) {
        const tiposValidos: TipoTenant[] = ['prefeitura', 'camara'];
        if (!tiposValidos.includes(tipo)) {
          res.status(400).json({
            success: false,
            message: `Tipo inválido. Valores válidos: ${tiposValidos.join(', ')}`,
          });
          return;
        }
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.atualizar(
        id,
        { nome, tipo, ativo, brasaoUrl },
        usuario,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        tenant: tenant.toJson(),
      });
    } catch (error) {
      console.error('[TenantController.atualizar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar tenant';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/tenants/:id (desativa)
   */
  public async desativar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.desativar(id, usuario, ip, userAgent);

      res.status(200).json({
        success: true,
        tenant: tenant.toJson(),
        message: 'Tenant desativado com sucesso',
      });
    } catch (error) {
      console.error('[TenantController.desativar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao desativar tenant';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * POST /api/tenants/:id/ativar
   */
  public async ativar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.ativar(id, usuario, ip, userAgent);

      res.status(200).json({
        success: true,
        tenant: tenant.toJson(),
        message: 'Tenant ativado com sucesso',
      });
    } catch (error) {
      console.error('[TenantController.ativar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao ativar tenant';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * PUT /api/tenants/:id/brasao
   * Body: { brasaoUrl: string }
   * Atualiza apenas o brasão do tenant (qualquer usuário autenticado do tenant)
   */
  public async atualizarBrasao(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const { brasaoUrl } = req.body ?? {};

      // Validar se o usuário pertence ao tenant
      if (usuario.tenantId !== id && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Você não tem permissão para atualizar este tenant',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.atualizar(
        id,
        { brasaoUrl },
        usuario,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        tenant: tenant.toJson(),
        message: 'Brasão atualizado com sucesso',
      });
    } catch (error) {
      console.error('[TenantController.atualizarBrasao] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar brasão';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * POST /api/tenants/:id/brasao/upload
   * Faz upload do brasão do tenant
   * Espera arquivo via multipart/form-data (campo: brasao)
   */
  public async uploadBrasao(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (!this.storageService) {
        res.status(500).json({ success: false, message: 'Serviço de storage não disponível' });
        return;
      }

      const id = req.params.id;

      // Validar se o usuário pertence ao tenant
      if (usuario.tenantId !== id && !usuario.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Você não tem permissão para atualizar este tenant',
        });
        return;
      }

      // Validar se o arquivo foi enviado
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado',
        });
        return;
      }

      // Validar tipo de arquivo
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          message: 'Formato inválido. Use PNG, JPG ou SVG',
        });
        return;
      }

      // Validar tamanho (5 MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        res.status(400).json({
          success: false,
          message: 'Arquivo muito grande. Tamanho máximo: 5 MB',
        });
        return;
      }

      // Gerar nome único para o arquivo
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      // Upload para Supabase Storage
      const brasaoUrl = await this.storageService.uploadFile(
        'brasoes',
        filePath,
        file.buffer,
        file.mimetype
      );

      // Atualizar tenant
      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const tenant = await this.tenantService.atualizar(
        id,
        { brasaoUrl },
        usuario,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        tenant: tenant.toJson(),
        brasaoUrl,
        message: 'Brasão enviado com sucesso',
      });
    } catch (error) {
      console.error('[TenantController.uploadBrasao] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao fazer upload do brasão';
      res.status(500).json({ success: false, message });
    }
  }
}
