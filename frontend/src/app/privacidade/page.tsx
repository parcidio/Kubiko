import type { Metadata } from "next";
import { Logo } from "@/components/bz/brand";
import { Callout } from "@/components/bz/ui";
import { whatsappLink } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Política de Privacidade · Beeznoo",
  description: "Que dados pessoais a Beeznoo recolhe, para quê, com quem os partilha e como exerces os teus direitos.",
};

const UPDATED = "17 de novembro de 2026";

/**
 * Rascunho escrito a partir do que a app recolhe de facto (decisoes-produto.md 2026-11-15).
 * A rever por jurista antes da abertura ao público: Lei n.º 22/11 (Proteção de Dados Pessoais) e notificação/autorização
 * da Agência de Proteção de Dados (APD), incluindo a transferência para fornecedores fora de Angola.
 */
export default function PrivacidadePage() {
  return (
    <div className="app min-h-dvh bg-areia text-texto-corpo">
      <header className="border-b border-borda bg-branco px-4 py-4 md:px-12">
        <Logo href="/" />
      </header>
      <main className="mx-auto grid max-w-3xl gap-8 px-4 py-10 text-[15px] leading-7 md:py-14">
        <div className="grid gap-2">
          <h1 className="font-titulo text-3xl font-extrabold text-verde md:text-4xl">Política de Privacidade</h1>
          <p className="text-sm text-cinza">Última atualização: {UPDATED}</p>
        </div>

        <Callout tone="warn" title="Versão provisória">
          Este texto está em revisão jurídica e pode mudar antes de a Beeznoo abrir ao público. Se mudar de forma relevante, avisamos-te na app.
        </Callout>

        <Section title="1. Quem somos">
          A Beeznoo é uma plataforma, em Luanda, que põe em contacto quem quer alugar equipamento (fotografia, vídeo, eventos) com quem o tem.
          Somos os responsáveis pelo tratamento dos dados pessoais que nos dás quando usas a app e o site beeznoo.ao. Os dados pessoais são tratados
          nos termos da Lei n.º 22/11, de 17 de junho, da Proteção de Dados Pessoais.
        </Section>

        <Section title="2. Que dados recolhemos">
          <ul className="grid list-disc gap-2 pl-5">
            <li><b>Conta:</b> nome, número de telefone (confirmado com um código por WhatsApp ou SMS), email, palavra-passe (guardada cifrada, nunca em texto), cidade e tipo de conta. Se entrares com o Google, recebemos o teu nome, email e um identificador da conta Google.</li>
            <li><b>Verificação de identidade:</b> fotografias da frente e do verso do Bilhete de Identidade e uma selfie com o BI. Para empresas, o documento do NIF e a certidão ou alvará.</li>
            <li><b>Equipamento e reservas:</b> o que publicas (descrição, preço, fotos), os pedidos de reserva, datas, mensagens entre as partes, o contrato aceite e quando foi aceite.</li>
            <li><b>Entrega, devolução e problemas:</b> fotos e notas das checklists e dos problemas reportados.</li>
            <li><b>Pagamentos:</b> o valor, o meio usado (numerário, transferência ou Multicaixa Express) e quem confirmou. O pagamento é feito diretamente ao dono: não recebemos nem guardamos dados de cartões ou contas bancárias.</li>
            <li><b>Localização aproximada:</b> só se autorizares no browser. Ver a secção 3A.</li>
            <li><b>Segurança:</b> registos de entrada na conta e de ações sensíveis, com data, hora e endereço IP, para proteger as contas e investigar abusos.</li>
          </ul>
        </Section>

        <Section title="3. Para que os usamos">
          <ul className="grid list-disc gap-2 pl-5">
            <li>Criar e proteger a tua conta e confirmar o teu telefone e email.</li>
            <li>Confirmar a tua identidade antes de pedires reservas ou publicares equipamento, para que cada parte saiba com quem está a lidar. A verificação é feita à mão pela equipa Beeznoo.</li>
            <li>Registar a reserva, o contrato, o pagamento, a entrega, a devolução e a caução, e emitir comprovativos.</li>
            <li>Analisar problemas reportados e mediar desacordos entre as partes, com base nas fotos e registos.</li>
            <li>Enviar avisos sobre as tuas reservas (na app, por WhatsApp ou SMS e por email).</li>
            <li>Cumprir obrigações legais e responder a pedidos de autoridades competentes.</li>
          </ul>
          <p className="mt-3">Não vendemos os teus dados nem os usamos para publicidade de terceiros.</p>
        </Section>

        <Section id="localizacao" title="3A. Localização">
          <ul className="grid list-disc gap-2 pl-5">
            <li><b>O quê:</b> a tua posição aproximada, pedida ao browser do telemóvel ou do computador. Arredondamo-la logo no teu aparelho a cerca de 1 km (duas casas decimais) e só essa versão chega até nós. Nunca guardamos a morada nem a posição exata.</li>
            <li><b>Quando:</b> ao criar conta, ao enviar a verificação de identidade e ao abrir a app (opcional, podes recusar sem perder nada), e ao publicar ou reativar equipamento (obrigatório).</li>
            <li><b>Porquê:</b> durante o piloto a Beeznoo só funciona em Luanda. A localização diz-nos se já estamos na tua zona e, de forma agregada, onde abrir a seguir. Para publicar equipamento confirmamos que estás numa zona aberta.</li>
            <li><b>Mapa agregado:</b> a equipa vê um mapa com contagens por zonas de cerca de 5 km, e só zonas com 3 ou mais pessoas. O mapa não mostra pessoas, nomes nem posições individuais. Ninguém fora da equipa Beeznoo vê a tua localização.</li>
            <li><b>Consentimento e como retirar:</b> o browser pergunta-te antes de partilhar. Podes retirar a autorização a qualquer momento nas definições do browser (no telemóvel: Definições do site › Localização; no computador: o cadeado ao lado do endereço). Sem localização continuas a poder usar a conta e a pedir reservas; só não consegues publicar.</li>
            <li><b>Quanto tempo:</b> guardamos a última localização aproximada enquanto tiveres conta e o histórico de pedidos de localização até 12 meses, para estatísticas agregadas. Podes pedir que a apaguemos.</li>
          </ul>
        </Section>

        <Section id="mensagens" title="3B. Mensagens da equipa">
          A equipa Beeznoo pode mandar-te mensagens por WhatsApp, SMS ou email sobre a tua conta e as tuas reservas (por exemplo, uma verificação
          por concluir ou um pedido por aceitar) e, ocasionalmente, novidades do serviço. Para isso usamos o teu número de telefone e o teu email,
          através dos fornecedores de envio indicados na secção 4. Guardamos o registo de cada envio (data, canal, estado da entrega) para saber
          se chegou. As mensagens são só de saída: para responder, fala connosco no WhatsApp. Se não quiseres receber novidades, diz-nos e
          deixamos de as mandar; os avisos sobre reservas em curso continuam.
        </Section>

        <Section title="4. Quem vê os teus dados">
          <ul className="grid list-disc gap-2 pl-5">
            <li><b>A outra parte da reserva</b> vê o teu nome, o selo &quot;Verificado&quot; e o que for preciso para combinar a entrega. Nunca vê os teus documentos de identidade.</li>
            <li><b>A equipa Beeznoo</b> vê os documentos de identidade só para os verificar, através de links que expiram em 5 minutos. Cada consulta fica registada.</li>
            <li>
              <b>Fornecedores que nos ajudam a operar a app</b>, que só tratam os dados por nossa conta: alojamento da aplicação e da base de dados, armazenamento privado de ficheiros, envio de emails, de mensagens de WhatsApp e de SMS, e o login com Google.
              Alguns destes fornecedores estão fora de Angola (por exemplo, nos Estados Unidos ou na União Europeia).
            </li>
          </ul>
        </Section>

        <Section title="5. Quanto tempo os guardamos">
          Guardamos os dados enquanto tiveres conta e, depois disso, só o tempo necessário para resolver litígios, cumprir obrigações legais e
          provar o que foi acordado numa reserva (contratos, comprovativos, checklists e registos de auditoria). Os documentos de identidade de uma
          verificação recusada podem ser apagados a teu pedido.
        </Section>

        <Section title="6. Como os protegemos">
          Os documentos e as fotos ficam em armazenamento privado, nunca públicos, e só se abrem com links temporários. As ligações são cifradas
          (HTTPS), as palavras-passe são guardadas cifradas e as ações sensíveis da equipa ficam num registo que não pode ser alterado.
        </Section>

        <Section title="7. Os teus direitos">
          Podes pedir acesso aos teus dados, a correção do que estiver errado, a eliminação da conta e dos dados que não tenhamos de guardar por
          lei, e opor-te a tratamentos que não sejam necessários. Podes também apresentar reclamação à Agência de Proteção de Dados (APD).
          Corrige o nome, o email e a cidade em Conta; para o resto,{" "}
          <a href={whatsappLink("Olá Beeznoo! Quero fazer um pedido sobre os meus dados pessoais.")} target="_blank" rel="noreferrer" className="font-medium text-mel-texto underline">
            fala connosco no WhatsApp
          </a>
          .
        </Section>

        <Section title="8. Cookies e armazenamento no browser">
          Usamos um cookie essencial para manter a sessão iniciada e o armazenamento local do browser para guardar a sessão, o rascunho de um
          equipamento por publicar e preferências como o tema. Não usamos cookies de publicidade.
        </Section>

        <Section title="9. Alterações">
          Se mudarmos esta política, publicamos aqui a nova versão com a data de atualização e, se a mudança for relevante, avisamos-te na app.
        </Section>
      </main>
    </div>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-2">
      <h2 className="font-titulo text-xl font-bold text-verde">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
