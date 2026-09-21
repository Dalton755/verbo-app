import { Link } from "react-router-dom";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function TermosPage() {
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
          Termos de Serviço
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
          <h2>1. Aceitação dos Termos</h2>

          <p>
            Ao criar uma conta, acessar ou utilizar o VERBO, o
            usuário declara ter lido e aceitado estes Termos de
            Serviço e a Política de Privacidade.
          </p>

          <p>
            Caso não concorde com estes termos, o usuário deverá
            deixar de utilizar o serviço.
          </p>

          <h2>2. Sobre o VERBO</h2>

          <p>
            O VERBO é uma plataforma digital desenvolvida pela
            Nethanel Tecnologia para organização, estudo,
            preparação e apresentação de conteúdos cristãos.
          </p>

          <p>
            O aplicativo pode disponibilizar módulos como:
          </p>

          <ul>
            <li>VERBO EBD;</li>
            <li>VERBO Sermões;</li>
            <li>VERBO Livros;</li>
            <li>armazenamento de arquivos;</li>
            <li>leitura e apresentação de PDFs;</li>
            <li>anotações, marcações e outros recursos relacionados.</li>
          </ul>

          <h2>3. Conta do usuário</h2>

          <p>
            O acesso poderá ser realizado por meio de conta Google
            ou outros métodos disponibilizados pelo VERBO.
          </p>

          <p>
            O usuário é responsável por manter a segurança de sua
            conta e por todas as atividades realizadas por meio
            dela.
          </p>

          <h2>4. Uso permitido</h2>

          <p>
            O VERBO deve ser utilizado de forma lícita e de acordo
            com sua finalidade.
          </p>

          <p>
            É proibido utilizar a plataforma para:
          </p>

          <ul>
            <li>praticar atos ilícitos;</li>
            <li>tentar obter acesso não autorizado a contas ou sistemas;</li>
            <li>interferir no funcionamento da plataforma;</li>
            <li>distribuir malware ou código malicioso;</li>
            <li>violar direitos autorais, marcas ou outros direitos de terceiros;</li>
            <li>utilizar o serviço de forma abusiva ou fraudulenta.</li>
          </ul>

          <h2>5. Conteúdo enviado pelo usuário</h2>

          <p>
            O usuário mantém a responsabilidade pelos arquivos,
            textos, livros, PDFs, apresentações, sermões,
            anotações e demais materiais enviados ao VERBO.
          </p>

          <p>
            O envio de um conteúdo ao VERBO não transfere sua
            propriedade para a Nethanel Tecnologia.
          </p>

          <p>
            O usuário declara possuir os direitos ou autorizações
            necessários para armazenar e utilizar o conteúdo
            enviado.
          </p>

          <h2>6. Direitos autorais</h2>

          <p>
            O VERBO não concede ao usuário direitos sobre obras de
            terceiros.
          </p>

          <p>
            O usuário é responsável por observar a legislação de
            direitos autorais aplicável aos livros, PDFs,
            apresentações, imagens, textos e outros materiais que
            utilizar dentro da plataforma.
          </p>

          <h2>7. Módulos do VERBO</h2>

          <p>
            O VERBO poderá disponibilizar diferentes módulos para
            organização de EBD, sermões e livros.
          </p>

          <p>
            O usuário poderá ativar ou desativar módulos conforme
            os recursos disponíveis em sua conta.
          </p>

          <p>
            Desativar um módulo poderá apenas ocultá-lo da
            interface, sem necessariamente excluir o conteúdo
            armazenado.
          </p>

          <h2>8. Testes, promoções e benefícios</h2>

          <p>
            O VERBO poderá oferecer períodos gratuitos, condições
            promocionais, benefícios temporários ou acesso a
            determinados recursos.
          </p>

          <p>
            A duração, limites e condições dessas ofertas serão
            apresentados no próprio aplicativo ou na página da
            oferta correspondente.
          </p>

          <h2>9. Armazenamento</h2>

          <p>
            O VERBO poderá disponibilizar determinada capacidade
            de armazenamento incluída no acesso ou contratada
            separadamente.
          </p>

          <p>
            Planos, limites, preços e condições de armazenamento
            serão apresentados no aplicativo no momento da
            contratação.
          </p>

          <p>
            Caso o limite contratado seja atingido, determinadas
            operações de upload poderão ser temporariamente
            bloqueadas até que haja espaço disponível ou
            contratação de capacidade adicional.
          </p>

          <h2>10. Pagamentos</h2>

          <p>
            Recursos pagos poderão ser processados por parceiros
            especializados, incluindo o Mercado Pago ou outro
            provedor informado no momento da contratação.
          </p>

          <p>
            Preços, periodicidade, condições de cobrança,
            renovação e cancelamento serão apresentados antes da
            confirmação da compra.
          </p>

          <h2>11. Cancelamentos</h2>

          <p>
            Quando houver serviço recorrente, o usuário poderá
            solicitar o cancelamento de acordo com as condições
            apresentadas no momento da contratação.
          </p>

          <p>
            O cancelamento poderá interromper cobranças futuras,
            sem necessariamente gerar reembolso de períodos já
            utilizados, salvo quando exigido pela legislação
            aplicável.
          </p>

          <h2>12. Disponibilidade do serviço</h2>

          <p>
            A Nethanel Tecnologia busca manter o VERBO disponível
            e funcional, mas não garante operação ininterrupta ou
            livre de falhas.
          </p>

          <p>
            Manutenções, problemas de internet, fornecedores
            externos, atualizações ou eventos fora do controle da
            plataforma podem causar indisponibilidades temporárias.
          </p>

          <h2>13. Alterações e evolução do produto</h2>

          <p>
            O VERBO está em constante evolução.
          </p>

          <p>
            Recursos poderão ser adicionados, modificados,
            reorganizados ou removidos para melhorar o produto,
            segurança, desempenho ou adequação legal.
          </p>

          <h2>14. Suspensão de acesso</h2>

          <p>
            O acesso poderá ser suspenso ou encerrado em casos de
            fraude, abuso, violação destes Termos, risco à
            segurança ou uso ilegal da plataforma.
          </p>

          <h2>15. Limitação de responsabilidade</h2>

          <p>
            O VERBO é uma ferramenta de organização e apoio ao
            estudo, ensino, leitura e preparação de conteúdos.
          </p>

          <p>
            A Nethanel Tecnologia não se responsabiliza por
            decisões, interpretações, ensinamentos ou usos feitos
            pelo usuário com base nos conteúdos armazenados ou
            apresentados na plataforma.
          </p>

          <p>
            Também não se responsabiliza por conteúdos de
            terceiros enviados pelo próprio usuário.
          </p>

          <h2>16. Privacidade</h2>

          <p>
            O tratamento de dados pessoais é descrito na Política
            de Privacidade do VERBO.
          </p>

          <p>
            <Link to="/privacidade">
              Consulte a Política de Privacidade.
            </Link>
          </p>

          <h2>17. Alterações destes Termos</h2>

          <p>
            Estes Termos poderão ser atualizados periodicamente.
            A versão vigente estará disponível nesta página.
          </p>

          <h2>18. Legislação aplicável</h2>

          <p>
            Estes Termos são regidos pelas leis da República
            Federativa do Brasil, observados os direitos
            garantidos pela legislação aplicável ao consumidor e
            à proteção de dados pessoais.
          </p>

          <h2>19. Contato</h2>

          <p>
            Em caso de dúvidas, solicitações ou suporte:
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

export default TermosPage;
