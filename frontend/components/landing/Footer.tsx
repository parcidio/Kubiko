"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

function BeeznoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#1F3A2E" />
      <path d="M16 2 L28 9 L16 16 L4 9 Z" fill="#2F6B4F" />
      <path d="M16 16 L28 9 V23 L16 30 Z" fill="#16291F" />
    </svg>
  );
}

export default function BeeznoFooter()
{
    return (
        <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}>
            <footer className="mt-20 border-t border-border-bg bg-sand">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <a href="#" className="flex shrink-0 items-center gap-2">
            <Image src="/png/beeznoo-icon-512.png" alt="logo" width={30} height={30}/>
            </a>
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