# Shalom — Um tempo de paz para ler

Aplicativo de leitura independente, baseado nos componentes originais de VERBO Livros.

## Situação

- **Prévia em desenvolvimento — NÃO publicar em produção sem aprovação.**
- Fonte original VERBO em `src/` permanece intacta. O Shalom é isolado em `apps/shalom/`.
- Banco: projeto Supabase **Verbo** (`uhuowymzlqstnaajcuta`), schema `shalom`.
- Login: Supabase Auth compartilhado com os futuros apps EBD e Sermões, no **mesmo projeto** Supabase.
- Arquivos: bucket privado `shalom-livros`, políticas de acesso por dono.
- Leitor reutilizado: `src/pages/LivroPage.jsx`, com destaques, notas, marcadores, busca, Bíblia (BLIVRE, ONBV) e dicionário.
- Formatos: PDF textual e EPUB, limite 50 MB por arquivo.
- Ads internos: tabela `shalom.promocoes`; começam **inativos**; quando ativados, aparecem no máximo uma vez por 24h, após 16s, apenas fora do leitor.
- Valor do plano: **R$ 4,99/mês via Pix Asaas** — no momento somente interface + estrutura de assinatura; **sem cobrança real**, segredo do Asaas não configurado.

## Pré-requisitos Supabase

1. Em **Project Settings > Data API > Exposed schemas**, manter o `public` e adicionar **`shalom`** (caso não esteja exposto); nunca expor `auth`.
2. Habilitar **Google OAuth** em Authentication > Providers para esse projeto, se desejado.
3. Adicionar o endereço de preview autorizado aos **Redirect URLs** de Authentication e configurar a página final de retorno.
4. Não migrar chaves de senha nem copiar usuários diretamente de outro Supabase: contas do projeto `Livros_ebd` estão em outro Auth; migração exige plano específico.

## Vercel Preview separado

Criar projeto **shalom-leitor** na mesma equipe, sem alterar o projeto **verbo-app**.

- Repositório `Dalton755/verbo-app`
- Framework `Vite`
- Install Command `npm ci`
- Build Command `npx vite build --config apps/shalom/vite.config.js`
- Output Directory `apps/shalom/dist`
- Build root: **raiz do repositório**
- Ambiente `VITE_SUPABASE_URL=https://uhuowymzlqstnaajcuta.supabase.co`
- Ambiente `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável `sb_publishable_...` do novo projeto.
- Branch de revisão `feature/shalom-leitor-preview`. Não conectar produção a essa branch.
- Roteamento SPA: se a Vercel não oferecer fallback para `/livros/:id`, configurar rewrite de rotas desconhecidas ao `/index.html`.

## Checklist antes de qualquer publicação final

- [ ] Deploy **somente de preview**; testar login, cadastro, Google, redirecionamento e troca de senha.
- [ ] Carregar PDF e EPUB reais, acompanhar progresso, notas, marcações e destaques.
- [ ] Testar no Android e PWA; abrir os links bíblicos e o dicionário.
- [ ] Testar acesso cruzado com **dois usuários** (RLS).
- [ ] Integrar Asaas servidor-a-servidor, validar webhook e idempotência, pagamento recebido, atraso e cancelamento, com segredo **exclusivamente no backend**.
- [ ] Implantar enforcement das assinaturas após validação de cobrança, definir política de teste e eventual migração dos clientes VERBO.
- [ ] Aprovar ads, cadência e links definitivos dos futuros apps.
- [ ] Obter autorização expressa de publicação em produção.
