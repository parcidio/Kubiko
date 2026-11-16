import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "Quanto custa alugar na Beeznoo?",
    a: "Pagas o aluguer definido pelo dono e uma taxa de serviço de 8% sobre esse valor. Vês o total, com a caução à parte, antes de enviares o pedido.",
  },
  {
    q: "O que é a caução e quando a recebo de volta?",
    a: "É um valor reembolsável que entregas ao dono junto com o pagamento. Depois da devolução, o dono devolve-ta ou retém uma parte com motivo, e fica registado na app. Se não concordares, contestas até 7 dias depois e a nossa equipa medeia.",
  },
  {
    q: "Como é que pago?",
    a: "Diretamente ao dono, no momento da entrega e depois de conferires o equipamento: em numerário, transferência ou Multicaixa Express. Nunca pagues antes do encontro. O dono confirma na app e recebes o comprovativo.",
  },
  {
    q: "Porque tenho de verificar a minha conta?",
    a: "Para que os dois lados saibam com quem estão a lidar. Particulares enviam o BI e uma selfie; empresas, o NIF. Os documentos ficam privados e a verificação é feita à mão pela nossa equipa. Podes explorar sem conta: só pedimos a verificação quando reservas ou publicas.",
  },
  {
    q: "E se alguma coisa correr mal?",
    a: "Reportas o problema na própria reserva, com fotos. A nossa equipa analisa o caso e medeia entre ti e a outra parte. Para tudo o resto, falas connosco no WhatsApp.",
  },
];

/** Perguntas frequentes: acordeão nativo (<details>/<summary>), acessível por teclado sem JS. */
export default function LandingFaq() {
  return (
    <section id="faq" className="lp-sec" style={{ paddingTop: 40 }} aria-labelledby="lp-faq-title">
      <div className="lp-wrap lp-faq-grid">
        <div className="lp-rv">
          <div className="lp-eyebrow">Perguntas frequentes</div>
          <h2 id="lp-faq-title" className="lp-sg lp-h2">
            Tudo o que queres saber antes de alugar.
          </h2>
        </div>
        <div className="lp-faq lp-rv">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                <span className="lp-sg">{f.q}</span>
                <span className="lp-chev" aria-hidden="true">
                  <ChevronDown size={18} strokeWidth={1.8} />
                </span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
