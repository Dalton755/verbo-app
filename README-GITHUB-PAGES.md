# VERBO Biblioteca - Preview sem Vercel via GitHub Pages

Este pacote contém a versão Etapa 7 da Biblioteca e um workflow do GitHub Pages para o repositório **Dalton755/verbo-app**.

## O que será publicado

- Homepage de biblioteca em `https://dalton755.github.io/verbo-app/`
- Painel administrativo em `https://dalton755.github.io/verbo-app/admin.html`
- `?preview=1` pode habilitar demonstração, sem downloads.
- Dados reais vêm do Supabase Verbo com as permissões RLS existentes. O painel autentica por Google.

**O URL só estará disponível quando o workflow executar após habilitar GitHub Pages.**

## Configurar uma única vez

1. No repositório GitHub, **Settings > Pages > Build and deployment > Source > GitHub Actions**.
2. Habilite o site GitHub Pages para o repositório.
3. Adicione a URL exata `https://dalton755.github.io/verbo-app/admin.html` à allow-list do Supabase em Authentication > URL Configuration > Redirect URLs; não altere Site URL.
4. Publique o código **na branch feature/verbo-biblioteca-preview** e o workflow em `.github/workflows/verbo-biblioteca-pages.yml`.
5. Em GitHub > Actions, consulte o resultado de `VERBO Biblioteca - previa GitHub Pages` e o endereço do Pages.

## Cuidados

- O repositório é **público**. A página também será publicamente acessível; não colocar secrets, service_role, arquivos pessoais ou PDFs sem licença no Git.
- A **tela administrativa** pode ser vista publicamente, mas os dados e funções de gravação ficam protegidos pela autenticação e políticas RLS do Supabase.
- O Pages oferece hospedagem estática gratuita para o projeto público, não executa back-end Node nem funções serverless. O cliente se conecta ao Supabase.
- Este workflow não usa Vercel. Entretanto, **um push de branch do GitHub pode disparar automaticamente um deploy de preview na Vercel, pois o repositório atual está integrado a esse serviço.** O arquivo `vercel.json` desta branch contém `git.deploymentEnabled` desativado especificamente para `feature/verbo-biblioteca-preview`. Não afeta os deploys do `main` nem de outras branches. Ainda assim, confirme na Vercel após o primeiro push se ela respeitou a exclusão. Evite modificar `main`.
- As configurações de Supabase Auth e os serviços Vercel originais não são alterados por este pacote.

## Portabilidade do build

A opção `--base=/verbo-app/` é aplicada **somente** durante o workflow GitHub Pages. A configuração padrão do Vite continua com `base:'/'` e o build do Vercel permanece intacto.

## Testes

Os testes incluem `node --test tests/*.test.mjs`. Nenhum PDF de terceiros é incorporado a este pacote.