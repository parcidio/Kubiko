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
  const texto  = encodeURIComponent("Olá! Tenho interesse em avançar com a Beeznoo.");
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
                  <span className="absolute -bottom-[1.1rem] left-0 right-0 h-0.5 bg-foreground" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Acções desktop */}
        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border-bg bg-secondary px-3.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80">
            <MapPin className="h-4 w-4" />
            Luanda
          </div>

          <button
            onClick={abrirWhatsapp}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border-bg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>

          <button className="cursor-pointer rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
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