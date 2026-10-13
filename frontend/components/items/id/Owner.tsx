import { Clock, IdCard, ShieldCheck, Smartphone } from "lucide-react";


export default function ItemOwner()
{
    return (
        <section className="rounded-xs border border-border bg-card p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ring/30">
                <span className="font-bold uppercase text-accent-foreground">EM</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold">Edson Mateus</h2>
                  <span className="inline-flex items-center gap-1 rounded-xs bg-accent px-2 py-1 text-xs font-semibold">
                    <ShieldCheck className="h-3 w-3 shrink-0" /> Verificado
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Particular · Talatona · Membro desde 2023
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  BI e selfie verificados pela equipa
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Telefone confirmado</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Costuma responder em ~3 horas
                </span>
              </div>
            </div>
        </section>
    )
}