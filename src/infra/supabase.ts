import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cliente Supabase para operações de autenticação
 */
export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não configurado no .env');
    }

    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY não configurado no .env');
    }

    if (!supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado no .env');
    }

    // Cliente público (para operações do usuário)
    this.client = createClient(supabaseUrl, supabaseAnonKey);

    // Cliente admin (para operações privilegiadas)
    this.adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Retorna o cliente público do Supabase
   */
  public getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Retorna o cliente admin do Supabase (service role)
   */
  public getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Verifica um JWT e retorna os dados do usuário auth
   */
  public async verifyToken(token: string) {
    const { data, error } = await this.adminClient.auth.getUser(token);

    if (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }

    return data.user;
  }

  /**
   * Login com email e senha
   */
  public async signInWithPassword(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Logout (invalida refresh token)
   */
  public async signOut(accessToken: string) {
    // Usar o token do usuário para fazer logout
    const { error } = await this.adminClient.auth.admin.signOut(accessToken);

    if (error) {
      console.warn('[SupabaseService.signOut] Aviso:', error.message);
    }
  }

  /**
   * Cria um novo usuário no auth.users
   */
  public async createUser(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Marca email como confirmado
      user_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  }

  /**
   * Atualiza senha de um usuário
   */
  public async updateUserPassword(userId: string, newPassword: string) {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Deleta um usuário do auth.users
   */
  public async deleteUser(userId: string) {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Atualiza email de um usuário
   */
  public async updateUserEmail(userId: string, newEmail: string) {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}
