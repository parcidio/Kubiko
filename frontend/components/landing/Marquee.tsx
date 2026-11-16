const ITEMS = [
  "Sony A7 III",
  "DJI Ronin RS3",
  "Godox AD600",
  "JBL PartyBox",
  "Rode Wireless GO II",
  "Projetor Epson",
  "Canon EOS R6",
  "Kit de iluminação",
];

function Hex() {
  return (
    <svg width="16" height="18" viewBox="0 0 34 38" aria-hidden="true" focusable="false">
      <polygon points="17,1 33,10 33,28 17,37 1,28 1,10" fill="#B76E12" />
    </svg>
  );
}

/** Faixa a deslizar com exemplos de equipamento (translateX(-50%), 38s, pausa no hover). */
export default function LandingMarquee() {
  return (
    <div className="lp-marquee">
      <p className="lp-sr">Exemplos de equipamento: {ITEMS.join(", ")}.</p>
      {/* A lista vai duplicada para o laço ser contínuo; o leitor de ecrã lê a frase acima. */}
      <ul className="lp-marquee__track" aria-hidden="true">
        {[...ITEMS, ...ITEMS].map((name, i) => (
          <li key={i} className="lp-marquee__i lp-sg">
            {name}
            <Hex />
          </li>
        ))}
      </ul>
    </div>
  );
}
