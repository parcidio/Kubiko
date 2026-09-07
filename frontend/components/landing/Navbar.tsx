"use client"

import { useState } from "react";
import { MapPin, ChevronDown, MessageCircle, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Explorar", href: "#", active: true },
  { label: "Como funciona", href: "#" },
  { label: "Arrendar", href: "#" },
  { label: "Ganhar dinheiro", href: "#" },
];

function KubikoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#1F3A2E" />
      <path d="M16 2 L28 9 L16 16 L4 9 Z" fill="#2F6B4F" />
      <path d="M16 16 L28 9 V23 L16 30 Z" fill="#16291F" />
    </svg>
  );
}

export default function KubikoNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E4DFD3] bg-[#FBF9F4]/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2">
          <KubikoMark />
          <span className="text-lg font-semibold text-[#1A1A18]">Kubiko</span>
        </a>

        {/* Links (desktop) */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map(({ label, href, active }) => (
            <a
              key={label}
              href={href}
              className={`relative text-sm transition-colors ${
                active
                  ? "text-[#1A1A18]"
                  : "text-[#5C5C55] hover:text-[#1A1A18]"
              }`}
            >
              {label}
              {active && (
                <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-[#1A1A18]" />
              )}
            </a>
          ))}
        </nav>

        {/* Ações (desktop) */}
        <div className="hidden items-center gap-3 lg:flex">
          <button className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-3.5 py-2 text-sm text-[#3A3A36] transition-colors hover:border-[#2F6B4F]">
            <MapPin className="h-4 w-4 text-[#5C5C55]" />
            Luanda
            <ChevronDown className="h-3.5 w-3.5 text-[#9B9B93]" />
          </button>

          <button className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2 text-sm font-medium text-[#2F6B4F] transition-colors hover:border-[#2F6B4F]">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>

          <button className="rounded-full bg-[#1F3A2E] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16291F]">
            Entrar
          </button>
        </div>

        {/* Botão menu (mobile) */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4DFD3] bg-white lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Menu (mobile) */}
      {open && (
        <div className="border-t border-[#E4DFD3] bg-[#FBF9F4] px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map(({ label, href, active }) => (
              <a
                key={label}
                href={href}
                className={`text-sm ${
                  active ? "font-medium text-[#1A1A18]" : "text-[#5C5C55]"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-5 flex flex-col gap-2.5">
            <button className="flex items-center justify-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2.5 text-sm text-[#3A3A36]">
              <MapPin className="h-4 w-4 text-[#5C5C55]" />
              Luanda
              <ChevronDown className="h-3.5 w-3.5 text-[#9B9B93]" />
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2.5 text-sm font-medium text-[#2F6B4F]">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            <button className="rounded-full bg-[#1F3A2E] px-4 py-2.5 text-sm font-medium text-white">
              Entrar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}