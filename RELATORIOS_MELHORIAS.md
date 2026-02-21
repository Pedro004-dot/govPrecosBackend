# Melhorias no Sistema de Geração de Relatórios

## Resumo das Alterações

Este documento descreve as melhorias implementadas no sistema de geração de relatórios da plataforma GovPreços.

---

## 🎯 Problemas Resolvidos

### 1. ✅ Sobreposição de Texto nas Tabelas

**Problema Original:**
- Textos longos (nomes de órgãos, descrições) sobrepunham valores nas colunas
- Não havia quebra de linha adequada (word-wrap)
- Altura das linhas era fixa, causando cortes no conteúdo

**Solução Implementada:**
- Refatoração completa do método `desenharTabela()` em `ProjetoRelatorioService.ts:1202-1289`
- Implementação de cálculo dinâmico de altura de linha
- Adição de word-wrap automático com `lineGap` e `ellipsis`
- Truncamento inteligente de textos extremamente longos (>100 caracteres)
- Altura mínima de 25px com expansão automática conforme necessário

**Código:**
```typescript
const calcularAlturaLinha = (cells: string[], isHeader: boolean = false): number => {
  let alturaMaxima = minRowHeight;
  const fontSize = isHeader ? 8.5 : 8;
  const lineHeight = fontSize * 1.2;

  cells.forEach((cell, i) => {
    const cellWidth = columnWidths[i] - 12;
    const caracteresEstimadosPorLinha = Math.floor(cellWidth / (fontSize * 0.5));
    const numLinhas = Math.ceil(cell.length / caracteresEstimadosPorLinha);
    const alturaTexto = numLinhas * lineHeight + 16;
    alturaMaxima = Math.max(alturaMaxima, alturaTexto);
  });

  return alturaMaxima;
};
```

---

### 2. ✅ Páginas Vazias

**Problema Original:**
- Lógica de paginação inconsistente (manual + automática do PDFKit)
- Páginas criadas desnecessariamente quando havia espaço disponível
- Método `verificarEspacoDisponivel()` não considerava altura do cabeçalho
- Critérios confusos para criar nova página

**Solução Implementada:**
- Criação de classe `PDFLayoutEngine` dedicada ao gerenciamento de layout
- Lógica centralizada e consistente para decisões de paginação
- Verificação de "página muito vazia" para evitar desperdício
- Cálculo preciso de espaço disponível considerando cabeçalhos e rodapés

**Arquivo:** `backend/src/services/PDFLayoutEngine.ts`

**Funcionalidades:**
```typescript
// Calcular espaço disponível
calcularEspacoDisponivel(doc, considerarCabecalho): number

// Verificar se há espaço suficiente
temEspacoSuficiente(doc, alturaConteudo): boolean

// Decidir inteligentemente sobre criar nova página
deveCriarNovaPagina(doc, alturaConteudo, forcar): boolean

// Detectar páginas muito vazias (< 20% preenchimento)
paginaMuitoVazia(doc): boolean

// Calcular altura de tabelas
calcularAlturaTabel(numLinhas, alturaLinha, alturaHeader): number
```

**Constantes:**
- `MARGEM_TOPO = 50`
- `MARGEM_RODAPE = 60`
- `ALTURA_CABECALHO = 55`
- `ESPACO_MINIMO_PARA_CONTEUDO = 100`
- `PERCENTUAL_MINIMO_PREENCHIMENTO = 0.2` (20%)

---

### 3. ✅ Brasão da Prefeitura

**Problema Original:**
- Campo `brasao_url` existia no banco (migração 003) mas não era utilizado
- Comentário no código indicava necessidade de implementação
- PDFKit não suporta URLs diretamente, precisa de buffer

**Solução Implementada:**
- Criação de classe `ImageDownloader` para download de imagens via HTTP/HTTPS
- Download automático do brasão ao gerar relatório
- Exibição do brasão em:
  - **Capa do relatório** (70px de altura, canto superior direito)
  - **Cabeçalho de todas as páginas** (30px de altura, canto direito)
- Tratamento de erros com fallback silencioso (relatório é gerado sem brasão se falhar)

**Arquivo:** `backend/src/services/ImageDownloader.ts`

**Funcionalidades:**
```typescript
// Download de imagem com timeout e validação
baixarImagem(url, timeoutMs): Promise<Buffer | null>

// Download com retry automático
baixarImagemComRetry(url, tentativas): Promise<Buffer | null>

// Detecção de tipo de imagem (PNG, JPEG, GIF, SVG)
detectarTipoImagem(buffer): string
```

**Segurança:**
- Aceita apenas protocolos HTTP/HTTPS
- Limite de tamanho: 5MB
- Timeout padrão: 5 segundos
- Validação de Content-Type

**Integração:**
```typescript
// Em ProjetoRelatorioService.ts:95-106
const tenant = await this.tenantRepository.buscarPorId(projeto.tenantId);
this.brasaoUrl = tenant?.brasaoUrl;

if (this.brasaoUrl) {
  this.brasaoBuffer = await ImageDownloader.baixarImagemComRetry(this.brasaoUrl, 2);
  if (!this.brasaoBuffer) {
    console.warn('Falha ao baixar brasão, relatório será gerado sem brasão');
  }
}
```

---

### 4. ✅ Validação de Dados

**Problema Original:**
- Nenhuma validação antes de gerar relatório
- Valores extremos ou inválidos causavam erros de renderização
- Nomes/descrições muito longas não eram tratadas
- Projetos sem itens não eram validados

**Solução Implementada:**
- Método `validarDadosRelatorio()` em `ProjetoRelatorioService.ts:64-156`
- Validações implementadas:
  - Projeto existe e tem nome válido
  - Projeto tem pelo menos 1 item
  - Todos os itens têm ID e nome válidos
  - Quantidades são números válidos (> 0)
  - Itens com < 3 fontes geram warning (não bloqueiam)
  - Truncamento automático de:
    - Nomes > 200 caracteres
    - Descrições > 500 caracteres

**Código:**
```typescript
private validarDadosRelatorio(projeto, itens, itensComFontes): void {
  // Validar projeto
  if (!projeto || !projeto.nome?.trim()) {
    throw new Error('Projeto sem nome válido');
  }

  // Validar itens
  if (!itens || itens.length === 0) {
    throw new Error('Projeto não possui itens para gerar relatório');
  }

  // Verificar itens sem fontes suficientes
  const itensComPoucasFontes = itensComFontes.filter(itemComFontes => {
    const fontesValidas = itemComFontes.fontes.filter(f => !f.ignoradoCalculo);
    return fontesValidas.length < 3;
  });

  if (itensComPoucasFontes.length > 0) {
    console.warn(`${itensComPoucasFontes.length} item(ns) com menos de 3 fontes válidas`);
  }

  // Truncar valores extremos
  itens.forEach(item => {
    if (item.nome?.length > 200) {
      item.nome = item.nome.substring(0, 197) + '...';
    }
  });
}
```

---

### 5. ✅ QR Code no Rodapé

**Status:** Já implementado anteriormente, mantido e otimizado

**Funcionalidade:**
- QR Code gerado no rodapé de todas as páginas (exceto capa)
- Tamanho: 35x35 pixels
- Texto abaixo: "Acesse online"
- Fallback para data se URL não fornecida

**Localização:** `ProjetoRelatorioService.ts:341-371`

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos

1. **`backend/src/services/PDFLayoutEngine.ts`** (175 linhas)
   - Engine de gerenciamento de layout para PDFs
   - Responsável por decisões inteligentes de paginação

2. **`backend/src/services/ImageDownloader.ts`** (134 linhas)
   - Serviço para download de imagens via HTTP/HTTPS
   - Validação, retry, detecção de tipo

3. **`backend/RELATORIOS_MELHORIAS.md`**
   - Este arquivo de documentação

### Arquivos Modificados

1. **`backend/src/services/ProjetoRelatorioService.ts`** (1.283 → ~1.400 linhas)
   - Adicionados imports: `PDFLayoutEngine`, `ImageDownloader`
   - Nova propriedade: `brasaoBuffer?: Buffer`
   - Novo método: `validarDadosRelatorio()`
   - Refatorado: `desenharTabela()` (linhas 1202-1289)
   - Refatorado: `novaPagina()` para usar LayoutEngine
   - Refatorado: `verificarEspacoDisponivel()` para usar LayoutEngine
   - Novo método: `temEspacoSuficiente()`
   - Melhorado: `adicionarCabecalho()` com brasão
   - Melhorado: `adicionarCapa()` com brasão
   - Melhorado: `gerarPDF()` com validação e download de brasão
   - Melhorado: `adicionarItem()` com lógica de paginação inteligente

---

## 🧪 Como Testar

### 1. Testar Relatório Completo

```bash
# Via API (necessita autenticação)
POST /api/projetos/{projetoId}/relatorio?tipo=completo
```

**Verificar:**
- ✅ Capa tem brasão da prefeitura (se configurado)
- ✅ Todas as páginas têm cabeçalho com brasão
- ✅ Não existem páginas vazias ou quase vazias
- ✅ Tabelas não têm texto sobreposto
- ✅ Nomes longos são truncados com "..."
- ✅ QR Code aparece no rodapé (se URL fornecida)
- ✅ Rodapé tem numeração de páginas correta

### 2. Testar Relatório Resumido

```bash
POST /api/projetos/{projetoId}/relatorio?tipo=resumido
```

**Verificar:**
- ✅ Mostra apenas 3 primeiras fontes por item
- ✅ Não tem seção de "Metodologia"
- ✅ Não tem seção de "Extrato de Fontes"
- ✅ Mantém brasão e QR code

### 3. Testar Relatório XLSX

```bash
POST /api/projetos/{projetoId}/relatorio?tipo=xlsx
```

**Verificar:**
- ✅ Arquivo Excel com 4 abas: Resumo, Itens, Fontes, Estatísticas
- ✅ Dados completos e formatados

### 4. Casos de Teste Específicos

#### Teste de Sobreposição (RESOLVIDO)

**Cenário:** Item com nome de órgão muito longo
```
Órgão: "Secretaria Municipal de Educação, Cultura, Esportes e Desenvolvimento Humano e Social"
```

**Resultado Esperado:**
- ✅ Texto quebra em múltiplas linhas
- ✅ Altura da linha aumenta automaticamente
- ✅ Não sobrepõe coluna de valor

#### Teste de Paginação (RESOLVIDO)

**Cenário:** Projeto com 50 itens, cada item com 10 fontes

**Resultado Esperado:**
- ✅ Sem páginas vazias
- ✅ Conteúdo distribuído uniformemente
- ✅ Mínimo 20% de preenchimento por página
- ✅ Quebras de página apenas quando necessário

#### Teste de Brasão (NOVO)

**Cenário 1:** Tenant com `brasao_url` válida
```sql
UPDATE tenants SET brasao_url = 'https://exemplo.com/brasao.png' WHERE id = '...';
```

**Resultado Esperado:**
- ✅ Brasão aparece na capa (70px, canto direito)
- ✅ Brasão aparece em todas as páginas (30px, cabeçalho direito)
- ✅ Log indica sucesso: "Brasão baixado com sucesso. Tipo: PNG"

**Cenário 2:** Tenant com `brasao_url` inválida/offline
```sql
UPDATE tenants SET brasao_url = 'https://url-invalida.com/brasao.png' WHERE id = '...';
```

**Resultado Esperado:**
- ✅ Relatório é gerado sem erro
- ✅ Brasão não aparece (fallback silencioso)
- ✅ Log indica: "Falha ao baixar brasão, relatório será gerado sem brasão"

#### Teste de Validação (NOVO)

**Cenário 1:** Projeto sem itens
```typescript
// Projeto criado mas sem itens adicionados
```

**Resultado Esperado:**
- ❌ Erro: "Projeto não possui itens para gerar relatório"

**Cenário 2:** Item com nome muito longo (300 caracteres)
```typescript
item.nome = "A".repeat(300);
```

**Resultado Esperado:**
- ✅ Nome truncado automaticamente para 200 caracteres
- ✅ Log: "Truncando nome do item: AAAA..."
- ✅ Relatório gerado com sucesso

---

## 📊 Tipos de Relatório

### 1. Relatório Completo (`tipo=completo`)

**Seções:**
1. Capa (com brasão)
2. Resumo Executivo (KPIs em cards)
3. **Metodologia** (Lei 14.133/2021, critérios, cálculo da mediana)
4. Itens e Fontes (detalhado)
   - Descrição completa
   - Quantidade e unidade
   - Estatísticas (média, mínimo, máximo)
   - Tabela com TODAS as fontes
   - Fontes excluídas com justificativa
5. Resumo Financeiro (totalizador)
6. **Extrato de Fontes Utilizadas** (disclaimer sobre PNCP)
7. Seção de Assinatura

**Uso:** Documentação oficial, auditoria, processo licitatório

---

### 2. Relatório Resumido (`tipo=resumido`)

**Seções:**
1. Capa (com brasão)
2. Resumo Executivo
3. Itens e Fontes (**resumido** - apenas 3 primeiras fontes)
4. Resumo Financeiro
5. Seção de Assinatura

**Diferenças do completo:**
- ❌ Sem seção "Metodologia"
- ❌ Sem seção "Extrato de Fontes"
- ⚠️ Tabelas mostram apenas 3 fontes por item
- ✅ Mais conciso, ideal para apresentações rápidas

**Uso:** Apresentações, reuniões, consultas rápidas

---

### 3. Relatório XLSX (`tipo=xlsx`)

**Abas:**
1. **Resumo** - Informações do projeto e KPIs
2. **Itens** - Lista de itens com preço unitário e total
3. **Fontes** - Todas as fontes PNCP utilizadas
4. **Estatísticas** - Média, mediana, mínimo, máximo, desvio padrão

**Uso:** Análise de dados, importação para outros sistemas, manipulação em planilhas

---

## 🎨 Identidade Visual

### Paleta de Cores

```typescript
cores = {
  navyEscuro: '#0A3D62',      // Azul navy (cabeçalhos, títulos)
  azulBrand: '#4D8EFF',       // Azul elétrico (destaques, links)
  verdeCheck: '#27AE60',      // Verde (indicadores positivos)
  cinzaEscuro: '#374151',     // Cinza escuro (textos)
  cinza: '#9ca3af',           // Cinza médio (labels)
  cinzaClaro: '#f3f4f6',      // Cinza claro (backgrounds zebrados)
  cinzaMedio: '#e5e7eb',      // Cinza médio (bordas)
  branco: '#ffffff',
};
```

### Tipografia

- **Títulos de seção:** Helvetica-Bold, 17pt, navy escuro
- **Subtítulos:** Helvetica-Bold, 11-12pt, navy escuro
- **Corpo:** Helvetica, 10pt, preto
- **Tabelas:** Helvetica, 8-8.5pt
- **Cabeçalho/Rodapé:** Helvetica, 7-8pt, cinza

### Layout

- **Margem superior:** 50px
- **Margem inferior:** 60px
- **Margem lateral:** 50px
- **Altura cabeçalho:** 55px
- **Tamanho página:** A4 (595 x 842 pontos)

---

## 🔧 Manutenção Futura

### Adicionar Novo Tipo de Relatório

1. Adicionar tipo em `TipoRelatorio` type:
```typescript
export type TipoRelatorio = 'completo' | 'resumido' | 'xlsx' | 'seu_novo_tipo';
```

2. Adicionar lógica em `gerarRelatorio()`:
```typescript
if (tipo === 'seu_novo_tipo') {
  return this.gerarSeuNovoTipo(projetoId);
}
```

3. Criar método `gerarSeuNovoTipo()`

### Modificar Estrutura de Tabelas

- Ajustar `columnWidths` nos métodos que chamam `desenharTabela()`
- Verificar que soma de larguras não exceda largura útil da página (495px com margens de 50)

### Adicionar Nova Seção

1. Criar método `adicionarSuaSecao(doc, dados)`
2. Chamar no fluxo de `gerarPDF()` na ordem desejada
3. Usar `this.novaPagina()` se precisar garantir nova página
4. Usar `this.temEspacoSuficiente()` antes de adicionar conteúdo grande

---

## 📝 Checklist de Requisitos

- [x] Brasão da prefeitura no relatório (capa + cabeçalho)
- [x] QR Code no relatório que acesse URL pública
- [x] Correção de sobreposição de texto
- [x] Eliminação de páginas vazias
- [x] Estrutura de dados adequada
- [x] Relatório detalhado (completo)
- [x] Relatório sucinto (resumido)
- [x] Relatório XLSX
- [x] Validação de dados antes de gerar
- [x] Tratamento de erros e fallbacks
- [x] Logs para debugging

---

## 🚀 Próximos Passos Sugeridos

1. **Testes com dados reais**
   - Testar com projetos reais da produção
   - Verificar performance com projetos grandes (100+ itens)

2. **Melhorias opcionais**
   - Cache de brasões baixados (evitar download a cada relatório)
   - Geração assíncrona de relatórios grandes (background jobs)
   - Preview de relatório antes de download final
   - Watermark para relatórios não finalizados

3. **Monitoramento**
   - Logs de tempo de geração
   - Logs de erros de download de brasão
   - Métricas de uso por tipo de relatório

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verificar logs do backend: `[ProjetoRelatorioService]`, `[ImageDownloader]`, `[PDFLayoutEngine]`
2. Revisar este documento
3. Consultar código-fonte com comentários inline

---

**Última atualização:** 2026-02-19
**Versão:** 2.0 (Refatoração completa)
