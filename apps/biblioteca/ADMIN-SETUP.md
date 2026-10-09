# VERBO — Administração segura (etapa 2)

O catálogo público **não** exige login. Somente `/admin.html` exige autenticação e uma atribuição de administrador feita no servidor.

## 1. Infraestrutura

Já aplicada ao projeto Supabase `Verbo` (`uhuowymzlqstnaajcuta`) em 09/10/2026:

- `biblioteca.administradores` (ligação por UUID com `auth.users`).
- RLS administrativo nas tabelas `materiais`, `arquivos`, `categorias`, `materiais_categorias`, `classificacao_jobs` e `storage.objects` do bucket privado `verbo-acervo`.
- Views updatáveis `public.verbo_admin_materiais`, `public.verbo_admin_arquivos`, `public.verbo_admin_categorias`, `public.verbo_admin_vinculos`, `public.verbo_admin_jobs`, `public.verbo_admin_identidade`, com `security_invoker`.
- Restrição para publicação de arquivos sem direitos de distribuição confirmados.

Nenhum usuário obtém permissão administrativa por simplesmente criar conta. Nunca usar `service_role` ou `sb_secret` no navegador.

## 2. Administrador principal autorizado

A conta a conta administradora já autorizada já existe no projeto Supabase **Verbo**, tem e-mail confirmado e identidade vinculada a **Google**. A permissão administrativa da conta foi ativada no banco (`biblioteca.administradores`) e testada com SQL usando papel `authenticated` e transações revertidas.

**Entre com Google no painel.** Não é necessário criar outra conta, nem adicionar o UUID manualmente. É necessário adicionar a URL da prévia à lista de redirecionamentos permitidos do Supabase Auth antes de testar o OAuth naquele domínio.

Para uma futura segunda conta, a autorização é concedida individualmente pelo administrador do banco, nunca por autocadastro ou só por possuir uma conta Google.

## 3. Funcionamento

- O importador PDF usa PDF.js local para ler metadados e até 3 páginas. EPUB tenta usar metadados OPF e, quando indisponíveis, volta ao nome do arquivo.
- Identificação de tema e categoria: heurísticas locais; não é um modelo ML em operação. Cada sugestão fica sujeita à revisão humana.
- SHA-256 detecta arquivos idênticos antes do upload.
- Importação de vários arquivos ocorre de forma sequencial; cada um entra **como rascunho**, armazenado de forma privada e com download desabilitado.
- Ao revisar, o curador corrige metadados, informa direitos, fonte da autorização e só então publica.
- Arquivos com direitos pendentes permanecem privados e invisíveis no catálogo. Obra marcada `somente_catalogo` pode ser publicada como referência, sem arquivo baixável.
- O botão de download público só é habilitado para materiais publicados + direitos comprovados + arquivo liberado, com dupla checagem RLS.
- O Shalom continua em projeto/sistema separado, compartilha o Supabase Auth mas não recebe nem substitui dados do acervo.

## 4. Ambiente de desenvolvimento

Instalar as dependências na raiz do repositório (o `package.json` original já inclui React, Supabase e PDF.js):

```bash
npm ci
npx vite --config apps/biblioteca/vite.config.js
```

Abrir:
- Catálogo: `http://localhost:5173/`
- Gestão: `http://localhost:5173/admin.html`
- Prévia estática sem login: `VERBO-Painel-Admin-Previa.html` (arquivo anexo fora do bundle).

Build multipágina:

```bash
npx vite build --config apps/biblioteca/vite.config.js
```

**Atenção:** prévias Vercel podem ser disparadas automaticamente por commits se houver Git Integration. Não foi feito push, merge ou deploy nesta etapa.

## 5. O que ainda falta

- Configurar e validar uma primeira conta autorizada no Supabase Auth VERBO.
- Testar PDF e EPUB reais, upload, metadados e fluxo de publicação em navegador conectado.
- Implementar motor ML/LLM com modelo e chave de API sob controle do backend (não existe integração com modelo ainda).
- Implementar importação de capas e buscas semânticas via embeddings (infraestrutura de pgvector preparada).
- Adicionar paginação administrativa em catálogo grande; estatísticas usam contagem real, tabela lista até 100 recentes.
- Auditoria dos downloads em backend, fila de processamento e revisão de direitos por lote.
- Vercel: publicar somente após aprovação explícita.