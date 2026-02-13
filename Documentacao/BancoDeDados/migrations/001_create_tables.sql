-- Migração 001: Criação das tabelas principais
-- Projeto: GovPrecos
-- Banco: PostgreSQL (Supabase)

-- ============================================
-- 1. TENANTS
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(500) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('prefeitura', 'camara')),
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenants_cnpj ON tenants(cnpj);

-- ============================================
-- 2. USUARIOS
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('admin', 'operador', 'auditor')),
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ============================================
-- 3. LICITACOES
-- ============================================
CREATE TABLE IF NOT EXISTS licitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_controle_pncp VARCHAR(100) UNIQUE NOT NULL,
    cnpj_orgao VARCHAR(14) NOT NULL,
    razao_social_orgao VARCHAR(500),
    poder_id CHAR(1),
    esfera_id CHAR(1),
    ano_compra INTEGER NOT NULL,
    sequencial_compra INTEGER NOT NULL,
    numero_compra VARCHAR(50),
    processo VARCHAR(200),
    objeto_compra TEXT,
    modalidade_id INTEGER,
    modalidade_nome VARCHAR(200),
    situacao_compra_id INTEGER,
    situacao_compra_nome VARCHAR(200) NOT NULL,
    valor_total_estimado DECIMAL(15,2),
    valor_total_homologado DECIMAL(15,2),
    data_publicacao_pncp TIMESTAMP WITH TIME ZONE NOT NULL,
    data_inclusao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao_global TIMESTAMP WITH TIME ZONE,
    codigo_unidade VARCHAR(50),
    nome_unidade VARCHAR(500),
    uf_sigla CHAR(2),
    municipio_nome VARCHAR(200),
    codigo_ibge VARCHAR(10),
    amparo_legal_codigo INTEGER,
    amparo_legal_nome VARCHAR(500),
    amparo_legal_descricao TEXT,
    link_processo_eletronico VARCHAR(500),
    link_sistema_origem VARCHAR(500),
    informacao_complementar TEXT,
    justificativa_presencial TEXT,
    srp BOOLEAN DEFAULT false,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_licitacoes_cnpj_ano_seq ON licitacoes(cnpj_orgao, ano_compra, sequencial_compra);
CREATE INDEX idx_licitacoes_data_publicacao ON licitacoes(data_publicacao_pncp);

-- ============================================
-- 4. ITENS_LICITACAO
-- ============================================
CREATE TABLE IF NOT EXISTS itens_licitacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    licitacao_id UUID NOT NULL REFERENCES licitacoes(id) ON DELETE CASCADE,
    numero_item INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    material_ou_servico CHAR(1),
    material_ou_servico_nome VARCHAR(50),
    valor_unitario_estimado DECIMAL(15,4),
    valor_total DECIMAL(15,2),
    quantidade DECIMAL(15,4),
    unidade_medida VARCHAR(20),
    situacao_compra_item INTEGER,
    situacao_compra_item_nome VARCHAR(200) NOT NULL,
    criterio_julgamento_id INTEGER,
    criterio_julgamento_nome VARCHAR(200),
    item_categoria_id INTEGER,
    item_categoria_nome VARCHAR(200),
    ncm_nbs_codigo VARCHAR(20),
    ncm_nbs_descricao VARCHAR(500),
    catalogo_codigo_item VARCHAR(100),
    informacao_complementar TEXT,
    orcamento_sigiloso BOOLEAN DEFAULT false,
    tem_resultado BOOLEAN DEFAULT false,
    data_inclusao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_itens_licitacao_id ON itens_licitacao(licitacao_id);

-- Índice Full-Text Search para busca textual em português, usado na busca por descrição na tela de cotação
CREATE INDEX idx_itens_descricao_fts ON itens_licitacao 
USING GIN (to_tsvector('portuguese', descricao));

-- ============================================
-- 5. PESQUISAS_PRECO
-- ============================================
CREATE TABLE IF NOT EXISTS pesquisas_preco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizada', 'cancelada')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pesquisas_tenant ON pesquisas_preco(tenant_id);
CREATE INDEX idx_pesquisas_usuario ON pesquisas_preco(usuario_id);

-- ============================================
-- 6. PESQUISA_ITENS
-- ============================================
CREATE TABLE IF NOT EXISTS pesquisa_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id UUID NOT NULL REFERENCES pesquisas_preco(id) ON DELETE CASCADE,
    item_licitacao_id UUID NOT NULL REFERENCES itens_licitacao(id) ON DELETE CASCADE,
    ordem INTEGER,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pesquisa_id, item_licitacao_id)
);

CREATE INDEX idx_pesquisa_itens_pesquisa ON pesquisa_itens(pesquisa_id);
CREATE INDEX idx_pesquisa_itens_item ON pesquisa_itens(item_licitacao_id);

-- ============================================
-- 7. RELATORIOS
-- ============================================
CREATE TABLE IF NOT EXISTS relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id UUID NOT NULL REFERENCES pesquisas_preco(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('pdf', 'word')),
    caminho_arquivo VARCHAR(500),
    url_acesso VARCHAR(500),
    qr_code_data TEXT,
    hash_arquivo VARCHAR(64),
    tamanho_bytes BIGINT,
    gerado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_relatorios_pesquisa ON relatorios(pesquisa_id);
CREATE INDEX idx_relatorios_tenant ON relatorios(tenant_id);

-- ============================================
-- TRIGGERS para atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licitacoes_updated_at BEFORE UPDATE ON licitacoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itens_licitacao_updated_at BEFORE UPDATE ON itens_licitacao
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pesquisas_preco_updated_at BEFORE UPDATE ON pesquisas_preco
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
