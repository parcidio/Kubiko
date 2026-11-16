"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Info, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/booking";
import { WAITLIST_ROLE_EVENT, type Objetivo } from "./WaitlistLink";

type Perfil = "particular" | "empresa";

// Google Apps Script que recebe as inscrições (uma folha por objetivo). Não mudar sem mudar o script.
const ALUGAR_URL =
  "https://script.google.com/macros/s/AKfycbwYGqstk6NtZnME7H-rhsTZUjboKK6WrjTX5PFJn6kEseXmp1eWZROZRtfLyH49vBn-gg/exec";
const DISPONIBILIZAR_URL =
  "https://script.google.com/macros/s/AKfycbwsUyEPmMN2zXCRRqZY9a56VB1kc_xvM3kMf9dMAsS7VrNesmJMBeNTQuAZ5-OJjrM4/exec";

const PROVINCIAS = [
  "Luanda", "Benguela", "Huambo", "Bié", "Cabinda", "Cuando Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene",
  "Huíla", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Namibe", "Uíge", "Zaire", "Bengo",
];

const OBJETIVOS: { v: Objetivo; label: string }[] = [
  { v: "alugar", label: "Quero alugar" },
  { v: "disponibilizar", label: "Quero disponibilizar" },
  { v: "ambos", label: "Os dois" },
];

const SHARE = `https://wa.me/?text=${encodeURIComponent("Entrei na lista de espera da Beeznoo: https://beeznoo.ao")}`;

/** Lista de espera (secção própria, #lista). Envio igual ao da versão anterior: Google Apps Script, no-cors. */
export default function LandingWaitlist() {
  const [objetivo, setObjetivo] = useState<Objetivo>("alugar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [dataRenda, setDataRenda] = useState("");
  const [valorAluguer, setValorAluguer] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [valorRenda, setValorRenda] = useState("");
  const [provincia, setProvincia] = useState("Luanda");
  const [perfil, setPerfil] = useState<Perfil>("particular");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  // "Quero alugar" / "Quero disponibilizar" noutras secções escolhem a opção aqui
  useEffect(() => {
    const pick = (e: Event) => {
      const v = (e as CustomEvent<Objetivo>).detail;
      if (v === "alugar" || v === "disponibilizar" || v === "ambos") setObjetivo(v);
    };
    window.addEventListener(WAITLIST_ROLE_EVENT, pick);
    return () => window.removeEventListener(WAITLIST_ROLE_EVENT, pick);
  }, []);

  const perfilTexto = perfil === "particular" ? "Particular" : "Empresa";

  const trackObjetivo = (tipo: Objetivo) => {
    fetch(`/api/track-click?tipo=${encodeURIComponent(tipo)}`).catch(() => {});
  };

  const send = async (url: string, body: Record<string, string>) => {
    setLoading(true);
    setError(false);
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors", // o Google Apps Script exige isto
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
      });
      // no-cors não devolve resposta, mas a submissão chega
      setSuccess(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAmbos = () => {
    const msg =
      `Olá! Quero conhecer a Beeznoo e utilizar a plataforma nos dois perfis.\n\n` +
      `Nome: ${nome}\n` +
      `Email: ${email}\n` +
      `Telefone/WhatsApp: ${telefone}\n` +
      `Província: ${provincia}\n` +
      `Perfil: ${perfilTexto}\n` +
      `Objetivo: Alugar e disponibilizar equipamentos`;
    trackObjetivo("ambos");
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
    setWhatsappOpened(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (objetivo === "alugar") {
      void send(ALUGAR_URL, { nome, email, equipamento, dataRenda, valorAluguer, telefone, provincia, perfil });
    } else if (objetivo === "disponibilizar") {
      void send(DISPONIBILIZAR_URL, { nome, email, equipamento, valorRenda, dataInicio, dataFinal, telefone, provincia, perfil });
    } else {
      handleAmbos();
    }
  };

  const reset = () => {
    setNome("");
    setEmail("");
    setTelefone("");
    setEquipamento("");
    setDataRenda("");
    setValorAluguer("");
    setDataInicio("");
    setDataFinal("");
    setValorRenda("");
    setSuccess(false);
    setError(false);
    setWhatsappOpened(false);
  };

  return (
    <section id="lista" className="lp-sec" aria-labelledby="lp-lista-title">
      <div className="lp-wrap lp-formsplit">
        <div className="lp-formside lp-rv">
          <div className="lp-eyebrow">Lista de espera</div>
          <h2 id="lp-lista-title" className="lp-sg lp-h2">
            Sê dos primeiros a alugar na Beeznoo.
          </h2>
          <p className="lp-lead">
            Leva menos de um minuto. Avisamos-te quando abrirmos na tua província, e os primeiros inscritos têm benefícios
            no arranque.
          </p>
          <ul>
            {["Sem spam: só novidades do lançamento", "Particulares e empresas", "Podes alugar, disponibilizar ou os dois"].map(
              (t) => (
                <li key={t}>
                  <span className="lp-hextile lp-hextile--tint" aria-hidden="true">
                    <Check size={18} strokeWidth={2} />
                  </span>
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="lp-formcard lp-rv">
          {success ? (
            <div className="lp-ok" role="status">
              <div className="lp-ok__ic" aria-hidden="true">
                <Check size={34} strokeWidth={2.2} />
              </div>
              <h3 className="lp-sg">Estás na lista!</h3>
              <p>Avisamos-te quando abrirmos na tua província.</p>
              <div className="lp-ok__acts">
                <a href={SHARE} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--g">
                  Partilhar no WhatsApp
                </a>
                <button type="button" className="lp-btn lp-btn--g" onClick={reset}>
                  Inscrever outra pessoa
                </button>
              </div>
            </div>
          ) : (
            <form className="lp-form" onSubmit={handleSubmit}>
              <div>
                <span className="lp-lbl" id="lp-lbl-objetivo">
                  O que queres fazer?
                </span>
                <div className="lp-seg lp-seg--3" role="group" aria-labelledby="lp-lbl-objetivo">
                  {OBJETIVOS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={objetivo === o.v}
                      onClick={() => {
                        setObjetivo(o.v);
                        setWhatsappOpened(false);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-fgrid">
                <div className="lp-full">
                  <label className="lp-lbl" htmlFor="lp-nome">
                    Nome
                  </label>
                  <input className="lp-inp" id="lp-nome" type="text" autoComplete="name" required value={nome}
                    onChange={(e) => setNome(e.target.value)} placeholder="O teu nome" />
                </div>
                <div>
                  <label className="lp-lbl" htmlFor="lp-email">
                    Email <span className="lp-opt">(opcional)</span>
                  </label>
                  <input className="lp-inp" id="lp-email" type="email" autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" />
                </div>
                <div>
                  <label className="lp-lbl" htmlFor="lp-tel">
                    Telefone / WhatsApp
                  </label>
                  <input className="lp-inp" id="lp-tel" type="tel" autoComplete="tel" inputMode="tel" required value={telefone}
                    onChange={(e) => setTelefone(e.target.value)} placeholder="+244 9XX XXX XXX" />
                </div>

                {objetivo === "alugar" && (
                  <>
                    <div className="lp-full">
                      <label className="lp-lbl" htmlFor="lp-item">
                        O que precisas de alugar?
                      </label>
                      <input className="lp-inp" id="lp-item" type="text" required value={equipamento}
                        onChange={(e) => setEquipamento(e.target.value)} placeholder="Ex.: câmara e luz para um casamento" />
                    </div>
                    <div>
                      <label className="lp-lbl" htmlFor="lp-quando">
                        Para quando? <span className="lp-opt">(opcional)</span>
                      </label>
                      <input className="lp-inp" id="lp-quando" type="date" value={dataRenda}
                        onChange={(e) => setDataRenda(e.target.value)} />
                    </div>
                    <div>
                      <label className="lp-lbl" htmlFor="lp-valor-aluguer">
                        Quanto pagarias por semana? (Kz)
                      </label>
                      <input className="lp-inp" id="lp-valor-aluguer" type="number" inputMode="numeric" min={0} step={1} required
                        value={valorAluguer} onChange={(e) => setValorAluguer(e.target.value)} placeholder="Ex.: 25000" />
                    </div>
                  </>
                )}

                {objetivo === "disponibilizar" && (
                  <>
                    <div className="lp-full">
                      <label className="lp-lbl" htmlFor="lp-item">
                        O que queres disponibilizar?
                      </label>
                      <input className="lp-inp" id="lp-item" type="text" required value={equipamento}
                        onChange={(e) => setEquipamento(e.target.value)} placeholder="Ex.: Canon EOS R6 e 2 lentes" />
                    </div>
                    <div className="lp-full lp-fgrid lp-fgrid--3">
                      <div>
                        <label className="lp-lbl" htmlFor="lp-de">
                          Disponível de <span className="lp-opt">(opcional)</span>
                        </label>
                        <input className="lp-inp" id="lp-de" type="date" value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)} />
                      </div>
                      <div>
                        <label className="lp-lbl" htmlFor="lp-ate">
                          Até <span className="lp-opt">(opcional)</span>
                        </label>
                        <input className="lp-inp" id="lp-ate" type="date" value={dataFinal}
                          onChange={(e) => setDataFinal(e.target.value)} />
                      </div>
                      <div>
                        <label className="lp-lbl" htmlFor="lp-valor-renda">
                          Por quanto? (Kz) <span className="lp-opt">(opcional)</span>
                        </label>
                        <input className="lp-inp" id="lp-valor-renda" type="number" inputMode="numeric" min={0} step={1}
                          value={valorRenda} onChange={(e) => setValorRenda(e.target.value)} placeholder="Ex.: 25000" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="lp-lbl" htmlFor="lp-prov">
                    Província
                  </label>
                  <select className="lp-inp" id="lp-prov" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
                    {PROVINCIAS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="lp-lbl" id="lp-lbl-perfil">
                    Sou
                  </span>
                  <div className="lp-seg lp-seg--2" role="group" aria-labelledby="lp-lbl-perfil">
                    {(["particular", "empresa"] as Perfil[]).map((p) => (
                      <button key={p} type="button" aria-pressed={perfil === p} onClick={() => setPerfil(p)}>
                        {p === "particular" ? "Particular" : "Empresa"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="lp-form__err" role="alert">
                  <CircleAlert size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>Não conseguimos enviar. Confirma a ligação à internet e carrega em &quot;Tentar outra vez&quot;.</span>
                </div>
              )}
              {whatsappOpened && objetivo === "ambos" && (
                <div className="lp-form__info" role="status">
                  <Info size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>Abrimos o WhatsApp com os teus dados. Envia a mensagem para ficares na lista.</span>
                </div>
              )}

              <button type="submit" className="lp-btn lp-btn--p" disabled={loading} aria-busy={loading}>
                {loading ? (
                  "A enviar…"
                ) : objetivo === "ambos" ? (
                  <>
                    <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
                    Continuar no WhatsApp
                  </>
                ) : (
                  <>
                    {error ? "Tentar outra vez" : "Entrar na lista de espera"}
                    <ArrowRight className="lp-btn__arr" size={20} strokeWidth={1.8} aria-hidden="true" />
                  </>
                )}
              </button>
              <p className="lp-form__note">
                Ao inscreveres-te aceitas a nossa <Link href="/privacidade">Política de Privacidade</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
