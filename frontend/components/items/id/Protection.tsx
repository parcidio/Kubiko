import { ShieldCheck } from "lucide-react";

export default function ItemProtection()
{
    return (
        <section className="rounded-xs bg-accent p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 text-sm">
                <h2 className="font-bold">Protecção Beeznoo</h2>
                <p className="mt-1 leading-relaxed">
                  Caução retida pela Beeznoo, checklist com fotos na entrega e
                  na devolução, e podes reportar o problema até 24h depois de
                  receber o equipamento.
                </p>
              </div>
            </div>
          </section>
    )
}