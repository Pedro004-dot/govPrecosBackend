Contexto da empresa
A empresa desenvolve uma plataforma SaaS 100% web focada em atender Prefeituras e Câmaras Municipais , automatizando a pesquisa de preços e a estruturação da fase interna de licitações em conformidade com a Lei nº 14.133/2021. O software centraliza a coleta de dados através da integração com bases públicas (como PNCP e TCE), importação de planilhas e cadastros manuais , utilizando inteligência estatística para realizar cálculos automáticos de média, mediana e menor preço, além de identificar automaticamente outliers e preços inexequíveis . A solução visa garantir rastreabilidade, padronização documental e segurança jurídica para auditorias dos Tribunais de Contas, culminando na geração automática de relatórios oficiais com QR Code e integração futura com o Termo de Referência (TR)

📂 Arquitetura do Projeto 
1.  Routes: Define os pontos de entrada baseados nas Telas Essenciais do sistema.

pesquisa.routes.ts: Endpoints para criar e gerenciar pesquisas de preços (Dashboard).

item.routes.ts: Endpoints para coleta, filtros de itens e consolidação.

relatorio.routes.ts: Endpoints para geração de PDF/Word e QR Code.

admin.routes.ts: Gatilhos manuais para sincronização com o governo.

2. Controllers: Sua responsabilidade é receber o HTTP Request, validar dados e chamar o Service.


PesquisaController: Gerencia o fluxo da "Nova Pesquisa de Preços".

SincronizacaoController: Aciona os serviços de busca de licitações externas.


ConsolidacaoController: Recebe comandos para calcular médias e tratar outliers .

3.  Services (Business Logic) Aqui completamos a lógica detalhada para os seus serviços principais:

A. SincronizadorGovernoService
Goal: Orquestrar a captura de licitações (Cabeçalho) das APIs 1 e 2.

Step 1: Chama GovernoApiGateway.buscarHistorico() (API 1) ou buscarAtualizacoesSemanais() (API 2).


Step 2: Filtra licitações para garantir conformidade com a Lei nº 14.133/2021.

Step 3: Utiliza o LicitacaoRepository para realizar um Upsert (evitando duplicatas).

Step 4: Para cada licitação nova/atualizada, despacha o identificador (numeroControlePNCP) para o EnriquecedorItemService (preferencialmente via fila/background job para não travar a aplicação).

B. EnriquecedorItemService
Goal: Capturar e filtrar os itens detalhados (API 3).

Step 1: Recebe os parâmetros de identificação da licitação.

Step 2: Chama GovernoApiGateway.buscarDetalhesItem().

Step 3: Filtro Crítico: Itera sobre a lista de itens e valida se situacaoCompraItemNome === "Homologado".

Step 4: Salva os itens vinculados ao ID da licitação pai através do ItemLicitacaoRepository.

C. CalculadoraEstatisticaService

Goal: Inteligência sobre o 1M de registros.

Step 1: Recebe a lista de preços coletados.


Step 2: Aplica fórmulas de Média, Mediana e identifica o Menor Preço Válido .


Step 3: Marca visualmente os Outliers (preços inexequíveis ou excessivos) para o frontend.

4. 🗄️ Repositories (Data Access)
Gerenciam a persistência e consultas de alta performance.

LicitacaoRepository: Métodos para salvar e buscar o "Cabeçalho" da compra.

ItemLicitacaoRepository: Implementa a Busca Textual (Full-Text Search). É aqui que lidamos com o volume de 1M de dados usando índices otimizados no banco de dados.


PesquisaPrecoRepository: Salva as pesquisas criadas pelos usuários e seus vínculos com os itens selecionados.

5. Gateways (External Integrations)
A "Capa de Isolamento" contra mudanças nas APIs do Governo.

GovernoApiGateway: Interface/Classe que conhece as URLs, Tokens e formatos de JSON das 3 APIs do governo. Ela traduz o retorno bruto para nossas Entidades de Domínio.

6.  Domain (Entities & Value Objects)
Onde definimos como os dados "nascem" no sistema.

Licitacao.ts: Entidade com campos como objetoCompra, orgao e numeroControlePNCP.


ItemLicitacao.ts: Entidade com valorUnitario, quantidade e descricao.

Cnpj.ts: Value Object para validar e formatar o CNPJ do órgão.