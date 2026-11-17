"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Info, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/booking";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
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

const OBJETIVOS: Objetivo[] = ["alugar", "disponibilizar", "ambos"];

/** Lista de espera (secção própria, #lista). Envio igual ao da versão anterior: Google Apps Script, no-cors. */
export default function LandingWaitlist() {
  const dict = useT();
  const t = dict.landing.waitlist;
  const { optional: opt, retry, sending } = dict.common;
  const SHARE = `https://wa.me/?text=${encodeURIComponent(t.shareText)}`;
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

  const perfilTexto = perfil === "particular" ? t.individual : t.company;

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
    const msg = fmt(t.waBoth, { name: nome, email, phone: telefone, province: provincia, profile: perfilTexto });
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
          <div className="lp-eyebrow">{t.eyebrow}</div>
          <h2 id="lp-lista-title" className="lp-sg lp-h2">
            {t.title}
          </h2>
          <p className="lp-lead">
            {t.lead}
          </p>
          <ul>
            {t.bullets.map((b) => (
              <li key={b}>
                <span className="lp-hextile lp-hextile--tint" aria-hidden="true">
                  <Check size={18} strokeWidth={2} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-formcard lp-rv">
          {success ? (
            <div className="lp-ok" role="status">
              <div className="lp-ok__ic" aria-hidden="true">
                <Check size={34} strokeWidth={2.2} />
              </div>
              <h3 className="lp-sg">{t.okTitle}</h3>
              <p>{t.okText}</p>
              <div className="lp-ok__acts">
                <a href={SHARE} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--g">
                  {t.share}
                </a>
                <button type="button" className="lp-btn lp-btn--g" onClick={reset}>
                  {t.another}
                </button>
              </div>
            </div>
          ) : (
            <form className="lp-form" onSubmit={handleSubmit}>
              <div>
                <span className="lp-lbl" id="lp-lbl-objetivo">
                  {t.goal}
                </span>
                <div className="lp-seg lp-seg--3" role="group" aria-labelledby="lp-lbl-objetivo">
                  {OBJETIVOS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={objetivo === o}
                      onClick={() => {
                        setObjetivo(o);
                        setWhatsappOpened(false);
                      }}
                    >
                      {t.goals[o]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-fgrid">
                <div className="lp-full">
                  <label className="lp-lbl" htmlFor="lp-nome">
                    {t.name}
                  </label>
                  <input className="lp-inp" id="lp-nome" type="text" autoComplete="name" required value={nome}
                    onChange={(e) => setNome(e.target.value)} placeholder={t.namePh} />
                </div>
                <div>
                  <label className="lp-lbl" htmlFor="lp-email">
                    {t.email} <span className="lp-opt">{opt}</span>
                  </label>
                  <input className="lp-inp" id="lp-email" type="email" autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" />
                </div>
                <div>
                  <label className="lp-lbl" htmlFor="lp-tel">
                    {t.phone}
                  </label>
                  <input className="lp-inp" id="lp-tel" type="tel" autoComplete="tel" inputMode="tel" required value={telefone}
                    onChange={(e) => setTelefone(e.target.value)} placeholder="+244 9XX XXX XXX" />
                </div>

                {objetivo === "alugar" && (
                  <>
                    <div className="lp-full">
                      <label className="lp-lbl" htmlFor="lp-item">
                        {t.rentWhat}
                      </label>
                      <input className="lp-inp" id="lp-item" type="text" required value={equipamento}
                        onChange={(e) => setEquipamento(e.target.value)} placeholder={t.rentWhatPh} />
                    </div>
                    <div>
                      <label className="lp-lbl" htmlFor="lp-quando">
                        {t.rentWhen} <span className="lp-opt">{opt}</span>
                      </label>
                      <input className="lp-inp" id="lp-quando" type="date" value={dataRenda}
                        onChange={(e) => setDataRenda(e.target.value)} />
                    </div>
                    <div>
                      <label className="lp-lbl" htmlFor="lp-valor-aluguer">
                        {t.rentBudget}
                      </label>
                      <input className="lp-inp" id="lp-valor-aluguer" type="number" inputMode="numeric" min={0} step={1} required
                        value={valorAluguer} onChange={(e) => setValorAluguer(e.target.value)} placeholder={t.amountPh} />
                    </div>
                  </>
                )}

                {objetivo === "disponibilizar" && (
                  <>
                    <div className="lp-full">
                      <label className="lp-lbl" htmlFor="lp-item">
                        {t.offerWhat}
                      </label>
                      <input className="lp-inp" id="lp-item" type="text" required value={equipamento}
                        onChange={(e) => setEquipamento(e.target.value)} placeholder={t.offerWhatPh} />
                    </div>
                    <div className="lp-full lp-fgrid lp-fgrid--3">
                      <div>
                        <label className="lp-lbl" htmlFor="lp-de">
                          {t.from} <span className="lp-opt">{opt}</span>
                        </label>
                        <input className="lp-inp" id="lp-de" type="date" value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)} />
                      </div>
                      <div>
                        <label className="lp-lbl" htmlFor="lp-ate">
                          {t.until} <span className="lp-opt">{opt}</span>
                        </label>
                        <input className="lp-inp" id="lp-ate" type="date" value={dataFinal}
                          onChange={(e) => setDataFinal(e.target.value)} />
                      </div>
                      <div>
                        <label className="lp-lbl" htmlFor="lp-valor-renda">
                          {t.price} <span className="lp-opt">{opt}</span>
                        </label>
                        <input className="lp-inp" id="lp-valor-renda" type="number" inputMode="numeric" min={0} step={1}
                          value={valorRenda} onChange={(e) => setValorRenda(e.target.value)} placeholder={t.amountPh} />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="lp-lbl" htmlFor="lp-prov">
                    {t.province}
                  </label>
                  <select className="lp-inp" id="lp-prov" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
                    {PROVINCIAS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="lp-lbl" id="lp-lbl-perfil">
                    {t.iAm}
                  </span>
                  <div className="lp-seg lp-seg--2" role="group" aria-labelledby="lp-lbl-perfil">
                    {(["particular", "empresa"] as Perfil[]).map((p) => (
                      <button key={p} type="button" aria-pressed={perfil === p} onClick={() => setPerfil(p)}>
                        {p === "particular" ? t.individual : t.company}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="lp-form__err" role="alert">
                  <CircleAlert size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t.error}</span>
                </div>
              )}
              {whatsappOpened && objetivo === "ambos" && (
                <div className="lp-form__info" role="status">
                  <Info size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t.waOpened}</span>
                </div>
              )}

              <button type="submit" className="lp-btn lp-btn--p" disabled={loading} aria-busy={loading}>
                {loading ? (
                  sending
                ) : objetivo === "ambos" ? (
                  <>
                    <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
                    {t.waContinue}
                  </>
                ) : (
                  <>
                    {error ? retry : t.submit}
                    <ArrowRight className="lp-btn__arr" size={20} strokeWidth={1.8} aria-hidden="true" />
                  </>
                )}
              </button>
              <p className="lp-form__note">
                {t.privacyBefore}
                <Link href="/privacidade">{t.privacy}</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
