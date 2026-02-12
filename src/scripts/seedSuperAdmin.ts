/**
 * Script para criar o super admin inicial
 * Execute com: npx ts-node src/scripts/seedSuperAdmin.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { SupabaseService } from '../infra/supabase';
import { Database } from '../infra/db';

async function seedSuperAdmin() {
  const email = 'govprecos@gmail.com';
  const password = 'Precos@2026';
  const nome = 'Super Admin GovPreços';

  console.log('Criando super admin...');
  console.log('Email:', email);

  const db = Database.getInstance();

  try {
    // Verificar se já existe
    const existingUser = await db.queryOne<any>(
      'SELECT id FROM public.usuarios WHERE email = $1',
      [email]
    );

    if (existingUser) {
      console.log('Super admin já existe!');
      process.exit(0);
    }

    // Criar usuário no Supabase Auth via Admin API
    const supabase = SupabaseService.getInstance();
    const authUser = await supabase.createUser(email, password, { nome });

    console.log('Usuário criado no Supabase Auth:', authUser.id);

    // Criar usuário na tabela public.usuarios
    await db.query(
      `INSERT INTO public.usuarios (
        auth_id, tenant_id, email, nome, perfil, is_super_admin, ativo
      ) VALUES ($1, NULL, $2, $3, 'super_admin', true, true)`,
      [authUser.id, email, nome]
    );

    console.log('Super admin criado com sucesso!');
    console.log('');
    console.log('Credenciais:');
    console.log('  Email:', email);
    console.log('  Senha:', password);

    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar super admin:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
