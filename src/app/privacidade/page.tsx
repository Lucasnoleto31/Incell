import type { Metadata } from "next";
import { Moldura } from "@/app/entrar/moldura";
import { NOME_DA_EMPRESA, titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Política de privacidade"),
  description: `Como a ${NOME_DA_EMPRESA} guarda e usa o que você manda pelo WhatsApp e pelo Instagram, e o que você pode pedir.`,
};

/**
 * A política de privacidade do atendimento, pública: a Meta exige a URL
 * dela no app para ligar o modo Ao vivo, e a LGPD, para quem escreve à loja.
 * Mesma moldura da tela de entrada e do /captura. Texto aceito não se
 * edita: mudança vira versão nova, com a data no rodapé (kit, bloco 4).
 *
 * Os dados da empresa são os do portfólio da Meta (Informações da empresa);
 * o contato é o próprio WhatsApp da loja, para não prometer um e-mail que
 * ninguém lê.
 */
export default function PrivacidadePage() {
  return (
    <Moldura
      titulo="Política de privacidade"
      descricao={`Como a ${NOME_DA_EMPRESA} guarda e usa o que você manda pelo WhatsApp e pelo Instagram, e o que você pode pedir.`}
      rodape="Versão 1, de 21 de outubro de 2026. Mudança nesta política vira versão nova nesta mesma página, com a data."
    >
      <div className="flex flex-col gap-4">
        <Secao titulo="Quem responde por estes dados">
          <P>
            IN CELL LTDA, CNPJ 24.806.240/0001-46, em Goiânia (GO), que atende
            pelo nome {NOME_DA_EMPRESA}. Para qualquer pedido sobre seus dados,
            escreva pelo mesmo WhatsApp em que você fala com a loja ou pelo
            site www.incellgo.com.br.
          </P>
        </Secao>

        <Secao titulo="O que a loja guarda">
          <P>Quando você escreve para a loja, ficam registrados:</P>
          <Lista>
            <li>
              seu nome e o número do WhatsApp, ou o nome de usuário do
              Instagram;
            </li>
            <li>
              as mensagens trocadas, com áudios, fotos e arquivos que você ou
              a loja enviaram, e a data e a hora de cada uma;
            </li>
            <li>quem da equipe atendeu.</li>
          </Lista>
          <P>
            Se você deixou seu contato num formulário ou num anúncio da loja,
            ficam o nome, o WhatsApp e de qual anúncio você veio. Se o
            atendimento vira orçamento, conserto ou venda, os dados do
            aparelho e da compra entram no mesmo cadastro.
          </P>
          <P>
            O WhatsApp não entrega sua foto de perfil à loja. No Instagram, a
            foto vem do seu perfil público.
          </P>
        </Secao>

        <Secao titulo="Para que a loja usa">
          <Lista>
            <li>responder você e acompanhar o conserto ou a venda;</li>
            <li>
              retomar uma conversa antiga quando você volta a escrever, sem
              pedir tudo de novo;
            </li>
            <li>
              cumprir o que a lei exige na venda e na garantia, como a nota
              fiscal.
            </li>
          </Lista>
          <P>
            A loja só começa uma conversa com você quando você pediu retorno
            ou aceitou receber avisos. Para parar, basta responder pedindo.
          </P>
        </Secao>

        <Secao titulo="Com quem os dados passam">
          <Lista>
            <li>
              Meta, dona do WhatsApp e do Instagram: a mensagem passa pelos
              servidores dela, nos termos da política de privacidade da Meta.
            </li>
            <li>
              Os serviços que hospedam o sistema de atendimento: o banco de
              dados fica em São Paulo (Supabase) e a aplicação roda na Vercel.
            </li>
            <li>
              Para resumir uma conversa longa ou sugerir uma resposta ao
              vendedor, o sistema pode enviar o texto da conversa ao serviço
              de inteligência artificial da Anthropic. A sugestão passa pelo
              vendedor antes de ser enviada.
            </li>
          </Lista>
          <P>
            A loja não vende sua lista de contatos nem a cede a outras
            empresas.
          </P>
        </Secao>

        <Secao titulo="Por quanto tempo">
          <P>
            Enquanto a loja precisar dos dados para atender você, cumprir a
            garantia e as obrigações fiscais. Você pode pedir a exclusão a
            qualquer momento. O que a lei obriga a manter, como a nota fiscal,
            fica pelo prazo legal.
          </P>
        </Secao>

        <Secao titulo="Como a loja protege">
          <P>
            Só a equipe da loja entra no sistema, cada pessoa com o próprio
            login, e cada acesso fica registrado. Cada atendente vê somente as
            conversas que precisa para o trabalho.
          </P>
        </Secao>

        <Secao titulo="O que você pode pedir">
          <P>
            Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode
            pedir à loja, a qualquer momento:
          </P>
          <Lista>
            <li>confirmar se tem dados seus e mostrar quais;</li>
            <li>corrigir um dado errado ou desatualizado;</li>
            <li>apagar seus dados, dentro do que a lei permite;</li>
            <li>receber uma cópia dos seus dados;</li>
            <li>deixar de receber avisos da loja.</li>
          </Lista>
          <P>A loja responde em até 15 dias.</P>
        </Secao>

        <Secao titulo="Cookies">
          <P>
            Esta página e o formulário de contato da loja não usam cookies de
            rastreamento. O sistema de atendimento usa cookies apenas para
            manter a sessão da equipe que atende.
          </P>
        </Secao>
      </div>
    </Moldura>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="tipo-titulo-3 text-tinta">{titulo}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="tipo-corpo text-tinta">{children}</p>;
}

function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="tipo-corpo flex list-disc flex-col gap-0.5 pl-4 text-tinta">
      {children}
    </ul>
  );
}
