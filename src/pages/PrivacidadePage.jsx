import { Link } from "react-router-dom";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function PrivacidadePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#172033",
      }}
    >
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "18px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <Link to="/">
            <img
              src={verboLogoHorizontal}
              alt="VERBO"
              style={{
                height: "38px",
                width: "auto",
              }}
            />
          </Link>

          <Link
            to="/"
            style={{
              textDecoration: "none",
              color: "#4f46e5",
              fontWeight: 700,
            }}
          >
            Voltar ao VERBO
          </Link>
        </div>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontWeight: 700,
            color: "#6366f1",
          }}
        >
          VERBO — Nethanel Tecnologia
        </p>

        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            margin: "0 0 12px",
          }}
        >
          Política de Privacidade
        </h1>

        <p
          style={{
            color: "#64748b",
            marginBottom: "40px",
          }}
        >
          Última atualização: 20 de setembro de 2026
        </p>

        <section style={{ lineHeight: 1.75 }}>
          <h2>1. Sobre esta Política</h2>

          <p>
            Esta Política de Privacidade descreve como o
            aplicativo VERBO, desenvolvido e mantido pela
            Nethanel Tecnologia, coleta, utiliza, armazena e
            protege informações de seus usuários.
          </p>

          <p>
            O VERBO é uma plataforma voltada à organização de
            conteúdos cristãos, incluindo Escola Bíblica
            Dominical, sermões, livros, PDFs, anotações,
            apresentações e outros materiais relacionados.
          </p>

          <h2>2. Dados que podemos coletar</h2>

          <p>
            Podemos tratar dados fornecidos diretamente pelo
            usuário ou disponibilizados por serviços utilizados
            para autenticação e funcionamento do aplicativo.
          </p>

          <p>
            Entre esses dados podem estar:
          </p>

          <ul>
            <li>nome;</li>
            <li>endereço de e-mail;</li>
            <li>identificador da conta;</li>
            <li>informações básicas fornecidas pelo Google durante o login;</li>
            <li>informações sobre sessão e dispositivo;</li>
            <li>preferências de módulos do VERBO;</li>
            <li>dados de uso e armazenamento;</li>
            <li>arquivos enviados pelo próprio usuário;</li>
            <li>informações necessárias para contratação de armazenamento ou serviços pagos.</li>
          </ul>

          <h2>3. Login com Google</h2>

          <p>
            O VERBO permite autenticação por meio da conta
            Google. Ao escolher “Continuar com Google”, o usuário
            autoriza o Google a fornecer ao VERBO informações
            básicas necessárias para identificação e criação ou
            acesso à conta.
          </p>

          <p>
            O VERBO não solicita acesso à senha da conta Google.
            A autenticação é realizada pelos mecanismos oficiais
            do Google e do provedor de autenticação utilizado pelo
            aplicativo.
          </p>

          <p>
            Atualmente, o VERBO utiliza as informações da conta
            Google essencialmente para autenticação, identificação
            do usuário e funcionamento da conta dentro da
            plataforma.
          </p>

          <h2>4. Finalidades do tratamento</h2>

          <p>
            Os dados podem ser utilizados para:
          </p>

          <ul>
            <li>criar e autenticar a conta do usuário;</li>
            <li>manter a sessão ativa;</li>
            <li>proteger o acesso à conta;</li>
            <li>personalizar os módulos exibidos no aplicativo;</li>
            <li>armazenar conteúdos enviados pelo usuário;</li>
            <li>controlar limites e consumo de armazenamento;</li>
            <li>processar solicitações de contratação ou pagamento;</li>
            <li>prestar suporte;</li>
            <li>prevenir fraudes, abusos e uso indevido;</li>
            <li>melhorar a experiência e a estabilidade do VERBO.</li>
          </ul>

          <h2>5. Arquivos e conteúdos enviados pelo usuário</h2>

          <p>
            O VERBO permite que o usuário envie seus próprios
            arquivos, como PDFs, apresentações, livros, sermões,
            aulas, anotações e outros materiais.
          </p>

          <p>
            Esses conteúdos permanecem vinculados à conta do
            usuário e são utilizados para fornecer as
            funcionalidades solicitadas dentro da plataforma.
          </p>

          <p>
            O usuário é responsável pelos conteúdos que envia e
            deve possuir os direitos, autorizações ou permissões
            necessários para utilizá-los.
          </p>

          <h2>6. Armazenamento e infraestrutura</h2>

          <p>
            O VERBO utiliza serviços de terceiros para
            autenticação, banco de dados, armazenamento,
            hospedagem e execução da aplicação.
          </p>

          <p>
            Entre os fornecedores atualmente utilizados podem
            estar:
          </p>

          <ul>
            <li>Supabase, para autenticação, banco de dados e armazenamento;</li>
            <li>Vercel, para hospedagem e distribuição da aplicação;</li>
            <li>Google, para autenticação OAuth;</li>
            <li>Mercado Pago, quando aplicável, para processamento de pagamentos.</li>
          </ul>

          <p>
            Esses fornecedores possuem suas próprias políticas e
            práticas de segurança e privacidade.
          </p>

          <h2>7. Pagamentos</h2>

          <p>
            Quando o usuário contratar armazenamento ou outro
            recurso pago, poderão ser solicitadas informações
            adicionais necessárias para a operação.
          </p>

          <p>
            O processamento financeiro é realizado por provedor
            de pagamento especializado. O VERBO não pretende
            armazenar dados completos de cartão de crédito.
          </p>

          <h2>8. Cookies e armazenamento local</h2>

          <p>
            O VERBO pode utilizar armazenamento local do
            navegador e tecnologias similares para manter
            informações necessárias ao funcionamento do
            aplicativo, incluindo sessão, preferências, origem de
            acesso e configurações.
          </p>

          <h2>9. Compartilhamento de dados</h2>

          <p>
            O VERBO não comercializa dados pessoais de seus
            usuários.
          </p>

          <p>
            Informações poderão ser compartilhadas apenas quando
            necessário para:
          </p>

          <ul>
            <li>funcionamento dos serviços contratados;</li>
            <li>processamento de pagamentos;</li>
            <li>segurança da plataforma;</li>
            <li>cumprimento de obrigação legal ou ordem de autoridade competente.</li>
          </ul>

          <h2>10. Segurança</h2>

          <p>
            São adotadas medidas técnicas e organizacionais
            razoáveis para proteger dados e conteúdos contra
            acesso não autorizado, perda, alteração ou uso
            indevido.
          </p>

          <p>
            Nenhum sistema conectado à internet pode oferecer
            garantia absoluta de segurança.
          </p>

          <h2>11. Retenção de dados</h2>

          <p>
            Os dados poderão ser mantidos enquanto a conta estiver
            ativa ou enquanto forem necessários para o
            funcionamento do serviço, cumprimento de obrigações
            legais, prevenção de fraude e exercício regular de
            direitos.
          </p>

          <h2>12. Direitos do titular</h2>

          <p>
            Nos termos da legislação brasileira aplicável,
            incluindo a Lei Geral de Proteção de Dados Pessoais
            (LGPD), o usuário poderá solicitar, quando aplicável:
          </p>

          <ul>
            <li>confirmação da existência de tratamento;</li>
            <li>acesso aos seus dados;</li>
            <li>correção de dados incompletos ou incorretos;</li>
            <li>eliminação de dados quando cabível;</li>
            <li>informações sobre compartilhamento;</li>
            <li>revogação de consentimento, quando o tratamento depender dele.</li>
          </ul>

          <h2>13. Exclusão da conta</h2>

          <p>
            O usuário poderá solicitar a exclusão da conta e dos
            dados associados por meio do canal de contato
            informado nesta Política.
          </p>

          <p>
            Alguns registros poderão ser preservados quando houver
            obrigação legal, necessidade de prevenção de fraude ou
            exercício regular de direitos.
          </p>

          <h2>14. Alterações nesta Política</h2>

          <p>
            Esta Política poderá ser atualizada conforme o VERBO
            evolua, novos recursos sejam adicionados ou ocorram
            alterações legais e operacionais.
          </p>

          <p>
            A versão mais recente estará sempre disponível nesta
            página.
          </p>

          <h2>15. Contato</h2>

          <p>
            Para questões relacionadas à privacidade, proteção de
            dados ou uso do VERBO:
          </p>

          <p>
            <strong>Nethanel Tecnologia</strong>
            <br />
            E-mail: rochadalton00@gmail.com
            <br />
            Site: https://nethanel.com.br
          </p>
        </section>
      </main>
    </div>
  );
}

export default PrivacidadePage;
