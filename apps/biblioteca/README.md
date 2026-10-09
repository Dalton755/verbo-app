# VERBO — Biblioteca Cristã Gratuita

Catálogo livre para descobrir e baixar obras com autorização de distribuição. **Sem leitor** e sem cobrança. O app Shalom é sugerido somente após um download real.

## Situação atual — Etapa 2

- Tela pública (`index.html`): **mesmo design da prévia aprovada**, pesquisa, categorias, ficha bibliográfica e download autorizado.
- Painel (`admin.html`): login Supabase Auth, verificação de administrador, indicadores, importação em lote de PDF/EPUB, extração local de metadados, classificação inicial assistida, SHA-256, upload privado, fila de revisão e publicação com comprovação de licença.
- Backend Supabase Verbo `uhuowymzlqstnaajcuta`: schema `biblioteca` separado de `shalom`, com RLS. Views públicas de consulta + views administrativas separadas em `public`, ambas sob RLS (`security_invoker`).
- O **motor ML de fato NÃO está operacional**: a etapa atual usa heurísticas e metadados, e mantém a revisão humana obrigatória. Busca semântica/LLM integrações futuras.
- O painel **não concede acesso a ninguém por padrão**. O gestor atribui manualmente UUID de cada conta em `biblioteca.administradores`.
- **Não houve deploy Vercel nem merge**. Disponibilização somente depois de aprovação do usuário.

## Instruções

Leia `ADMIN-SETUP.md` para habilitar administrador e testar. Para desenvolvimento na raiz de `Dalton755/verbo-app` (dependências presentes):

```bash
npm ci
npx vite --config apps/biblioteca/vite.config.js
```

Rotas: `/` (biblioteca), `/admin.html` (painel).

Para gerar saída estática multipágina:

```bash
npx vite build --config apps/biblioteca/vite.config.js
```

## Segurança

- A chave `sb_publishable_...` é pública por design; nunca adicionar chave `service_role`/`sb_secret` ao frontend.
- O bucket `verbo-acervo` permanece privado, com até 50 MB por arquivo e RLS de leitura e de upload.
- Upload não publica. Materiais passam por rascunho e revisão, e só downloads com direitos comprovados são liberados.
- Duplicação detectada por SHA-256 antes de importar; se um upload falhar parcialmente, o rascunho deve ser inspecionado antes de repetir a operação.
- Links/autores editáveis passam por `textContent` ou campos input, nunca HTML não confiável.

## Limitações e etapas seguintes

1. Conectar e autorizar a primeira conta do gestor em Supabase Auth (veja ADMIN-SETUP.md).
2. Validar PDFs textuais e EPUB reais em Android e desktop com o app servido localmente ou em preview autorizado.
3. Implementar pipeline de ML/LLM servidor a servidor (nunca enviar chave de IA ao navegador), OCR opcional de PDFs escaneados, fila assíncrona e embeddings.
4. Integrar upload de capas, métricas de download, auditoria e paginação completa para milhares de registros.
5. Configurar URL oficial do Shalom depois de aprovada a sua implantação.

### Nota sobre prévia

`VERBO-Painel-Admin-Previa.html` é uma demonstração autocontida, com dados ilustrativos, sem autenticação ou gravação. O painel real está em `admin.html` e exige a configuração de autorização.