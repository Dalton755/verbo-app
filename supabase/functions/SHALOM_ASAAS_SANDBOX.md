# Shalom · Asaas Sandbox (sem cobranças reais)

## Situação
- O projeto Vercel de desenvolvimento usa a branch `feature/shalom-leitor-preview`.
- A criação de assinatura está propositalmente bloqueada no app (`VITE_SHALOM_CHECKOUT_SANDBOX_ENABLED` não definido).
- As funções `shalom-checkout` e `shalom-asaas-webhook` estão versionadas aqui, mas **não são ativadas/implantadas automaticamente** por um deploy do Vercel.
- A API de checkout só chama `https://api-sandbox.asaas.com/v3`, com a variável secreta `ASAAS_API_KEY_SANDBOX` e com `SHALOM_CHECKOUT_SANDBOX_ENABLED=true`.
- CPF/CNPJ é recebido somente pelo backend e enviado diretamente ao Asaas; não guardar documentos no frontend, em logs ou em tabelas de negócio.
- O webhook valida `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN_SANDBOX` e chama a função SQL de idempotência `shalom.registrar_evento_pagamento_asaas`, acessível somente a `service_role`.

## Preparação manual na conta Asaas Sandbox
1. Criar conta independente em https://sandbox.asaas.com.
2. Gerar a API Key em Menu do usuário → Integrações → Chaves API.
3. No Supabase Verbo, configurar **Edge Function Secrets**:
   - `ASAAS_API_KEY_SANDBOX` = API Key do Sandbox
   - `SHALOM_CHECKOUT_SANDBOX_ENABLED` = `true`
   - `ASAAS_WEBHOOK_TOKEN_SANDBOX` = token forte (mínimo 32 caracteres), correspondente ao token do webhook configurado no Asaas.
4. Implantar as funções com essas configurações:
   - `shalom-checkout` com validação JWT ativada (`verify_jwt: true`);
   - `shalom-asaas-webhook` com validação JWT da plataforma desativada (`verify_jwt: false`), pois valida token próprio em header.
5. No Asaas Sandbox, configurar Webhook:
   - URL: `https://uhuowymzlqstnaajcuta.supabase.co/functions/v1/shalom-asaas-webhook`
   - Header configurado automaticamente pelo Asaas: `asaas-access-token`;
   - Eventos: `PAYMENT_CREATED`, `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`.
6. Só então definir `VITE_SHALOM_CHECKOUT_SANDBOX_ENABLED=true` **exclusivamente na prévia Vercel**, refazer o build da prévia e testar com dados fictícios válidos.

## Regras do produto
- Plano fixo de teste: R$ 4,99/mês, `billingType = PIX`, `cycle = MONTHLY`.
- Assinatura Asaas convencional **não debita automaticamente** o Pix: uma cobrança nova é gerada mensalmente e o cliente paga cada cobrança. Pix Automático exige autorização bancária específica.
- Criar assinatura não significa pagamento confirmado: ativação do benefício ocorre apenas com evento autenticado de pagamento.
- Repetir o mesmo `evento_id` não duplica o processamento. Eventos desconhecidos ou sem assinatura correspondente são ignorados.
- O uso de produção exige aprovação do titular, migração de credenciais, revisão de antifraude, conciliação e fluxo de cancelamento; não mudar as funções acima para produção sem nova revisão.
- Nesta etapa, **não aplicar paywall** sobre livros da prévia.

Documentação: https://docs.asaas.com/docs/assinaturas · https://docs.asaas.com/docs/webhook-para-cobrancas · https://docs.asaas.com/docs/sandbox
