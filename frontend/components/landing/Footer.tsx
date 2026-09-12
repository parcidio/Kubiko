"use client";

import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function BeeznoFooter()
{
    return (
        <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}>
            <footer className="mt-20 border-t border-border-bg bg-sand">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="size-5 text-shield" aria-hidden="true" />
            Beeznoo
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Arrendamento de bens entre particulares e empresas, com seguro incluído em cada contrato.
            Luanda, Angola.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Plataforma</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link href="/itens" className="hover:text-foreground">
                Explorar itens
              </Link>
            </li>
            <li>
              <Link href="/publicar" className="hover:text-foreground">
                Publicar item
              </Link>
            </li>
            <li>
              <Link href="/verificacao" className="hover:text-foreground">
                Verificação
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Seguro</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link href="/sinistros" className="hover:text-foreground">
                Participar sinistro
              </Link>
            </li>
            <li>
              <Link href="/painel-arrendatario" className="hover:text-foreground">
                Certificados de apólice
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-foreground">
                Área de gestão
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Pagamentos</p>
          <p className="mt-3 text-muted-foreground">
            Multicaixa Express e transferência bancária. Validação por ID de transação do
            comprovativo.
          </p>
        </div>
      </div>
      <div className="border-t border-border-bg px-4 py-6 text-center text-xs text-muted-foreground">
        © 2026 Beeznoo. Feito pra quem cria.
      </div>
    </footer>
        </motion.section>
    )
}