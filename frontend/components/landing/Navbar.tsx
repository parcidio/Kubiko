"use client"

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { label: "Como funciona",     href: "#howworks",   id: "howworks"   },
  { label: "Tenho equipamento", href: "#highlights", id: "highlights" },
  { label: "Segurança",         href: "#securing",   id: "securing"   },
];

export default function BeeznoNavbar() {
  const [open, setOpen]         = useState(false);
  const [activeSection, setActive] = useState("howworks");

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
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const handleLink = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-primary">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">

        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2">
          <Image src="/png/beeznoo-icon-512.png" alt="logo" width={30} height={30} />
          <span className="text-lg font-bold text-primary-foreground/90">beeznoo</span>
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
                  active
                    ? "text-primary-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-[-1.1rem] left-0 right-0 h-0.5 bg-primary-foreground/40" />
                )}
              </a>
            );
          })}
        </nav>

        {/* CTA desktop */}
        <div className="hidden items-center lg:flex">
          <button className="cursor-pointer rounded-full bg-chart-2 px-5 py-2 text-sm font-bold text-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-warning/90 hover:shadow-md active:translate-y-0">
            Entrar na lista
          </button>
        </div>

        {/* Botão menu mobile */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10 lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open
            ? <X className="h-4 w-4 text-primary-foreground" />
            : <Menu className="h-4 w-4 text-primary-foreground" />
          }
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-primary-foreground/10 bg-primary px-6 py-5 lg:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map(({ label, href, id }) => (
              <a
                key={id}
                href={href}
                onClick={handleLink}
                className={`text-sm transition-colors ${
                  id === activeSection
                    ? "font-semibold text-primary-foreground"
                    : "text-primary-foreground/60"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-5">
            <button className="w-full cursor-pointer rounded-full bg-warning py-2.5 text-sm font-bold text-primary transition-opacity hover:opacity-90">
              Inscrever
            </button>
          </div>
        </div>
      )}
    </header>
  );
}