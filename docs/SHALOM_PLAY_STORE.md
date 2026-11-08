# Shalom — preparação para Google Play (08/11/2026)

## Diagnóstico verificado
- Repositório `Dalton755/verbo-app`, app React/Vite independente em `apps/shalom`, branch-base `feature/shalom-leitor-preview`. **Não misturar com a produção VERBO da main.**
- Supabase Verbo `uhuowymzlqstnaajcuta`, schema `shalom`; Auth, biblioteca, estante, anotações, PDF/EPUB e assinatura Asaas Sandbox existentes.
- Preço atual web: **R$ 5,99/mês**. A estrutura Asaas não é Google Play Billing. Não há comprovação de pagamento real.
- PWA só tem SVG. Ainda não existe projeto Android/AAB assinado neste repositório.
- `https://shalom.nethanel.com.br` foi o domínio planejado; **não foi possível verificar se abre publicamente**.

## Identidade proposta
- Nome: **Shalom — Leitor de Livros**; desenvolvedor **Nethanel Tecnologia**.
- Categoria sugerida: **Livros e referências**; package proposto: `br.com.nethanel.shalom`.
- Produto Google Play proposto: `shalom_mensal` (mensal); **preço exibido deve vir da loja**, não do preço fixo do Asaas.
- Android: API de destino **36** para novo app em novembro/2026. Primeiro envio por **AAB assinado**, versionCode 1, com Play App Signing.

## Bloqueios obrigatórios
1. Publicar e comprovar o domínio web HTTPS e o manifest; gerar ícones PNG 192/512 e materiais reais da Play. Configurar `/.well-known/assetlinks.json` após obter impressão digital da chave Play.
2. Empacotar TWA Android (por exemplo, Bubblewrap), testar que inicia em `/?platform=googleplay`, sem redirecionar login OAuth para outro domínio. Gerar AAB com API 36; guardar senha da keystore exclusivamente fora do repositório.
3. Google Play Billing por Digital Goods API/Payment Request na TWA ou implementação nativa equivalente. SKU `shalom_mensal`. Capturar compra, restaurar, cancelar/expirar e informar preço/renovação fornecidos pela Google Play.
4. Backend seguro de confirmação pela Android Publisher API: token de compra, produto, package, estado, vencimento e vínculo único ao usuário; idempotência e reconhecimento (acknowledgment). Notificações RTDN para renovações/reembolsos e consulta server-to-server antes de alterar acesso.
5. Separar no banco as assinaturas por **canal** e manter clientes Asaas web sem confundir sandbox com transações Play. Nunca conceder acesso só pela query `?platform=googleplay`.
6. A branch atual faz **bloqueio temporário de Pix/Asaas** na interface Play. Ainda não oferece compra Play. Não publicar como versão comercial.
7. Criar e testar **solicitação de exclusão de conta dentro do app e por página pública**. Auth é compartilhado com futuros apps Nethanel; a exclusão precisa tratar dados Shalom e efeitos sobre outros serviços.
8. Política de privacidade pública, descrição de coleta (livros enviados, notas, conta e histórico de pagamentos), retenção, segurança, contato e exclusão. Preencher Segurança dos dados, classificação, conta de teste e demais formulários da Play.
9. Testes reais: dois usuários diferentes, Google OAuth, EPUB/PDF, marcadores, login/recuperação, assinatura Play, restauração, vencimento e compra duplicada. Teste interno antes de produção.

**Não houve publicação nem criação de app na Play Console.**

## Texto-base da loja
**Descrição curta:** Leia PDF e EPUB, organize livros, faça notas e retome sua leitura.

**Descrição completa:** Shalom é sua biblioteca pessoal para ler com tranquilidade. Importe livros PDF ou EPUB, organize sua estante, salve a última página e continue de onde parou. Utilize marcadores, destaques, anotações, dicionário e referências bíblicas para estudar com mais profundidade. Acesso completo por assinatura; preço, renovação e condições aparecem no Google Play antes da compra.

**Próxima ação:** confirmar o domínio da web e criar o app no Play Console. Na sequência, empacotamento Android, integração de compras, backend de validação e teste interno.
