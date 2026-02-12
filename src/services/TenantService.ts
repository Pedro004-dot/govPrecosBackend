import { TenantRepository } from '../repositories/TenantRepository';
import { AuditService } from './AuditService';
import { Tenant, TipoTenant } from '../domain/Tenant';
import { UsuarioAutenticado } from '../domain/Usuario';

export interface CreateTenantInput {
  cnpj: string;
  nome: string;
  tipo: TipoTenant;
}

export interface UpdateTenantInput {
  nome?: string;
  tipo?: TipoTenant;
  ativo?: boolean;
}

/**
 * Serviço para gerenciamento de tenants (prefeituras/câmaras)
 */
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Cria um novo tenant
   */
  public async criar(
    input: CreateTenantInput,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Tenant> {
    // Validar CNPJ
    if (!this.validarCnpj(input.cnpj)) {
      throw new Error('CNPJ inválido');
    }

    // Verificar se CNPJ já existe
    const cnpjEmUso = await this.tenantRepository.cnpjEmUso(input.cnpj);
    if (cnpjEmUso) {
      throw new Error('CNPJ já cadastrado');
    }

    // Formatar CNPJ
    const cnpjFormatado = this.formatarCnpj(input.cnpj);

    const tenant = await this.tenantRepository.criar(cnpjFormatado, input.nome, input.tipo);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'create',
      entidade: 'tenants',
      entidadeId: tenant.id,
      dadosDepois: {
        id: tenant.id,
        cnpj: tenant.cnpj,
        nome: tenant.nome,
        tipo: tenant.tipo,
      },
      ip,
      userAgent,
    });

    console.log(`[TenantService.criar] Tenant criado: ${tenant.id}`);
    return tenant;
  }

  /**
   * Atualiza um tenant
   */
  public async atualizar(
    id: string,
    input: UpdateTenantInput,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Tenant> {
    const tenantAntes = await this.tenantRepository.buscarPorId(id);
    if (!tenantAntes) {
      throw new Error('Tenant não encontrado');
    }

    const tenant = await this.tenantRepository.atualizar(id, input);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'update',
      entidade: 'tenants',
      entidadeId: tenant.id,
      dadosAntes: {
        nome: tenantAntes.nome,
        tipo: tenantAntes.tipo,
        ativo: tenantAntes.ativo,
      },
      dadosDepois: {
        nome: tenant.nome,
        tipo: tenant.tipo,
        ativo: tenant.ativo,
      },
      ip,
      userAgent,
    });

    console.log(`[TenantService.atualizar] Tenant atualizado: ${tenant.id}`);
    return tenant;
  }

  /**
   * Desativa um tenant
   */
  public async desativar(
    id: string,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Tenant> {
    const tenant = await this.tenantRepository.desativar(id);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'deactivate',
      entidade: 'tenants',
      entidadeId: tenant.id,
      dadosAntes: { ativo: true },
      dadosDepois: { ativo: false },
      ip,
      userAgent,
    });

    console.log(`[TenantService.desativar] Tenant desativado: ${tenant.id}`);
    return tenant;
  }

  /**
   * Ativa um tenant
   */
  public async ativar(
    id: string,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Tenant> {
    const tenant = await this.tenantRepository.ativar(id);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'activate',
      entidade: 'tenants',
      entidadeId: tenant.id,
      dadosAntes: { ativo: false },
      dadosDepois: { ativo: true },
      ip,
      userAgent,
    });

    console.log(`[TenantService.ativar] Tenant ativado: ${tenant.id}`);
    return tenant;
  }

  /**
   * Lista todos os tenants
   */
  public async listar(incluirInativos: boolean = false): Promise<Tenant[]> {
    return this.tenantRepository.listarTodos(incluirInativos);
  }

  /**
   * Busca tenant por ID
   */
  public async buscarPorId(id: string): Promise<Tenant | null> {
    return this.tenantRepository.buscarPorId(id);
  }

  /**
   * Busca tenant por ID com estatísticas
   */
  public async buscarPorIdComEstatisticas(id: string): Promise<{
    tenant: Tenant;
    estatisticas: {
      usuarios: number;
      projetos: number;
      projetosFinalizados: number;
    };
  } | null> {
    const tenant = await this.tenantRepository.buscarPorId(id);
    if (!tenant) {
      return null;
    }

    const estatisticas = await this.tenantRepository.buscarEstatisticas(id);

    return { tenant, estatisticas };
  }

  /**
   * Valida CNPJ
   */
  private validarCnpj(cnpj: string): boolean {
    // Remover formatação
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

    if (cnpjLimpo.length !== 14) {
      return false;
    }

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpjLimpo)) {
      return false;
    }

    // Validar dígitos verificadores
    let tamanho = cnpjLimpo.length - 2;
    let numeros = cnpjLimpo.substring(0, tamanho);
    const digitos = cnpjLimpo.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) {
      return false;
    }

    tamanho = tamanho + 1;
    numeros = cnpjLimpo.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1), 10)) {
      return false;
    }

    return true;
  }

  /**
   * Formata CNPJ
   */
  private formatarCnpj(cnpj: string): string {
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
    return cnpjLimpo.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }
}
