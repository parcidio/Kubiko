"use client"

import { useState } from "react";
import { MapPin, ChevronDown, MessageCircle, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Explorar", href: "#", active: true },
  { label: "Como funciona", href: "#" },
  { label: "Arrendar", href: "#" },
  { label: "Ganhar dinheiro", href: "#" },
];

function BeeznoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#1F3A2E" />
      <path d="M16 2 L28 9 L16 16 L4 9 Z" fill="#2F6B4F" />
      <path d="M16 16 L28 9 V23 L16 30 Z" fill="#16291F" />
    </svg>
  );
}

export default function BeeznoNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-bg bg-background shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2">
          <BeeznoMark />
          <span className="text-lg font-semibold text-foreground">Beeznoo</span>
        </a>

        {/* Links (desktop) */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map(({ label, href, active }) => (
            <a
              key={label}
              href={href}
              className={`relative text-sm transition-colors ${
                active
                  ? "text-foreground"
                  : "text-[#5C5C55] hover:text-foreground"
              }`}
            >
              {label}
              {active && (
                <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-foreground" />
              )}
            </a>
          ))}
        </nav>

        {/* Ações (desktop) */}
        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-border-bg bg-secondary px-3.5 py-2 text-sm text-secondary-foreground cursor-pointer transition-colors hover:bg-secondary/80 hover:border-border-bg/90">
            <MapPin className="h-4 w-4" />
            Luanda
          </div>

          <button className="flex items-center gap-1.5 rounded-full border border-border-bg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors cursor-pointer hover:bg-secondary/80 hover:border-border-bg/90">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>

          <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium cursor-pointer text-primary-foreground transition-colors hover:bg-primary/90">
            Entrar
          </button>
        </div>

        {/* Botão menu (mobile) */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-bg bg-secondary lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Menu (mobile) */}
      {open && (
        <div className="border-t border-border-bg bg-background px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map(({ label, href, active }) => (
              <a
                key={label}
                href={href}
                className={`text-sm ${
                  active ? "font-medium text-foreground" : "text-[#5C5C55]"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-5 flex flex-col gap-2.5">
            <button className="flex items-center justify-center gap-1.5 rounded-full border border-border-bg bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
              <MapPin className="h-4 w-4 " />
              Luanda
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-full border border-border-bg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground">
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