"use client"

import { useState, useEffect } from "react";
import { MapPin, ChevronDown, MessageCircle, Menu, X } from "lucide-react";
import Image from "next/image";

const navLinks = [
  { label: "Explorar",         href: "#explore",    id: "explore"    },
  { label: "Como funciona",    href: "#howworks",   id: "howworks"   },
  { label: "Categorias",       href: "#categories", id: "categories" },
  { label: "Comprar vs Alugar",href: "#compare",    id: "compare"    },
];

function abrirWhatsapp(): void {
  const NUMERO = "244939351150";
  const texto  = encodeURIComponent("Olá! Sou um cliente e tenho interesse em saber sobre a Beeznoo.");
  fetch(`/api/track-click`).catch(() => {});
  window.open(`https://wa.me/${NUMERO}?text=${texto}`, "_blank");
}

export default function BeeznoNavbar() {
  const [open, setOpen]               = useState(false);
  const [activeSection, setActive]    = useState("explore");

  /* ── Detecta qual secção está visível ── */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    navLinks.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* ── Fecha menu mobile ao clicar num link ── */
  const handleLink = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-bg bg-background shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">

        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2">
          <Image src="/png/beeznoo-icon-512.png" alt="logo" width={30} height={30} />
          <span className="text-lg font-semibold text-foreground">Beeznoo</span>
        </a>

        {/* Links desktop */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map(({ label, href, id }) => {
            const active = id === activeSection;
            return (
              <a
                key={id}
                href={href}
                className={`relative text-sm transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-[-1.1rem] left-0 right-0 h-0.5 bg-foreground" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Acções desktop */}
        <div className="hidden items-center gap-3 lg:flex">

          <button onClick={abrirWhatsapp} className="group flex cursor-pointer items-center gap-2 rounded-full border border-border-bg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/70 hover:shadow-md active:translate-y-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M20.52 3.449A11.82 11.82 0 0 0 12.04 0C5.495 0 .16 5.335.157 11.882c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.674 1.447h.005c6.542 0 11.88-5.335 11.883-11.882a11.82 11.82 0 0 0-3.403-8.462zM12.04 21.785h-.004a9.86 9.86 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.87 9.87 0 0 1-1.509-5.27c.002-5.45 4.437-9.884 9.89-9.884a9.83 9.83 0 0 1 7.008 2.906 9.83 9.83 0 0 1 2.903 7.01c-.003 5.45-4.438 9.87-9.919 9.87z" />
            </svg>
            <span>WhatsApp</span>
          </button>

          <button className="cursor-pointer rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/85 hover:shadow-lg active:translate-y-0">
            Entrar
          </button>
        </div>

        {/* Botão menu mobile */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-border bg-background px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map(({ label, href, id }) => (
              <a
                key={id}
                href={href}
                onClick={handleLink}
                className={`text-sm ${
                  id === activeSection
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-5 flex flex-col gap-2.5">
            <button className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
              <MapPin className="h-4 w-4" />
              Luanda
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={abrirWhatsapp}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            <button className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              Entrar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}