#!/usr/bin/env node
/**
 * Copia src/templates para dist/templates após o build (tsc).
 * Necessário para ProjetoRelatorioService encontrar os templates em produção.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'templates');
const dest = path.join(__dirname, '..', 'dist', 'templates');

if (!fs.existsSync(src)) {
  console.warn('[copy-templates] src/templates não encontrado, ignorando.');
  process.exit(0);
}

try {
  fs.cpSync(src, dest, { recursive: true });
  console.log('[copy-templates] Templates copiados para dist/templates');
} catch (err) {
  console.error('[copy-templates] Erro ao copiar templates:', err.message);
  process.exit(1);
}
