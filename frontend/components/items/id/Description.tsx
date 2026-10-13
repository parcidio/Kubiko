export default function ItemDescription({extra}: {extra: {description: string; includes: string[]}})
{
    return (
        <section className="rounded-xs border border-border bg-card p-4">
            <h2 className="mb-2 font-bold text-foreground">Descrição</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {extra.description}
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-3 font-bold text-foreground">Inclui</h3>
              <ul className="space-y-1.5">
                {extra.includes.map((include, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-xs bg-foreground" />
                    <span>{include}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
    )
}