export type Categoria =
  | "Fotografia"
  | "Vídeo"
  | "Áudio"
  | "Eventos"
  | "Ferramentas"
  | "Eletrónica"
  | "Mobiliário"
  | "Veículos";

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
  precoPorDia: number; // em Kz
  foto: string;
  avaliacao: number;
  disponivel: boolean;
}

export const catalogo: Item[] = [
  // ── Fotografia ──────────────────────────────────────────────────
  {
    id: "1",
    nome: "Canon EOS R6 Mark II",
    categoria: "Fotografia",
    precoPorDia: 18000,
    foto: "https://images.unsplash.com/photo-1516724562728-afc824a36e84?w=600&auto=format&fit=crop",
    avaliacao: 4.9,
    disponivel: true,
  },
  {
    id: "2",
    nome: "Sony Alpha A7 IV",
    categoria: "Fotografia",
    precoPorDia: 20000,
    foto: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&auto=format&fit=crop",
    avaliacao: 4.8,
    disponivel: true,
  },
  {
    id: "3",
    nome: "Ring Light 18\" com Tripé",
    categoria: "Fotografia",
    precoPorDia: 4500,
    foto: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&auto=format&fit=crop",
    avaliacao: 4.5,
    disponivel: true,
  },

  // ── Vídeo ────────────────────────────────────────────────────────
  {
    id: "4",
    nome: "DJI Ronin S3 Pro (Gimbal)",
    categoria: "Vídeo",
    precoPorDia: 12000,
    foto: "https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=600&auto=format&fit=crop",
    avaliacao: 4.7,
    disponivel: true,
  },
  {
    id: "5",
    nome: "Blackmagic Pocket Cinema 6K",
    categoria: "Vídeo",
    precoPorDia: 25000,
    foto: "https://images.unsplash.com/photo-1540655037529-dec987208707?w=600&auto=format&fit=crop",
    avaliacao: 4.9,
    disponivel: false,
  },

  // ── Áudio ────────────────────────────────────────────────────────
  {
    id: "6",
    nome: "Microfone Rode NTG5",
    categoria: "Áudio",
    precoPorDia: 6000,
    foto: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop",
    avaliacao: 4.8,
    disponivel: true,
  },
  {
    id: "7",
    nome: "Coluna JBL PartyBox 310",
    categoria: "Áudio",
    precoPorDia: 8000,
    foto: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop",
    avaliacao: 4.6,
    disponivel: true,
  },
  {
    id: "8",
    nome: "Mesa de Som Yamaha MG10XU",
    categoria: "Áudio",
    precoPorDia: 9500,
    foto: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&auto=format&fit=crop",
    avaliacao: 4.5,
    disponivel: true,
  },

  // ── Eventos ──────────────────────────────────────────────────────
  {
    id: "9",
    nome: "Tendas 5x5m (conjunto de 4)",
    categoria: "Eventos",
    precoPorDia: 35000,
    foto: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&auto=format&fit=crop",
    avaliacao: 4.4,
    disponivel: true,
  },
  {
    id: "10",
    nome: "Projetor Epson 4K Full HD",
    categoria: "Eventos",
    precoPorDia: 14000,
    foto: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&auto=format&fit=crop",
    avaliacao: 4.7,
    disponivel: true,
  },

  // ── Ferramentas ──────────────────────────────────────────────────
  {
    id: "11",
    nome: "Berbequim Bosch Professional",
    categoria: "Ferramentas",
    precoPorDia: 3000,
    foto: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop",
    avaliacao: 4.3,
    disponivel: true,
  },
  {
    id: "12",
    nome: "Gerador Honda 5.5kW",
    categoria: "Ferramentas",
    precoPorDia: 22000,
    foto: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&auto=format&fit=crop",
    avaliacao: 4.6,
    disponivel: false,
  },

  // ── Eletrónica ───────────────────────────────────────────────────
  {
    id: "13",
    nome: "MacBook Pro M3 14\"",
    categoria: "Eletrónica",
    precoPorDia: 15000,
    foto: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop",
    avaliacao: 4.9,
    disponivel: true,
  },
  {
    id: "14",
    nome: "iPad Pro 12.9\" + Apple Pencil",
    categoria: "Eletrónica",
    precoPorDia: 10000,
    foto: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop",
    avaliacao: 4.7,
    disponivel: true,
  },

  // ── Veículos ─────────────────────────────────────────────────────
  {
    id: "15",
    nome: "DJI Mavic 3 Pro (Drone)",
    categoria: "Veículos",
    precoPorDia: 20000,
    foto: "https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=600&auto=format&fit=crop",
    avaliacao: 4.9,
    disponivel: true,
  },
  {
    id: "16",
    nome: "Trotinete Elétrica Xiaomi",
    categoria: "Veículos",
    precoPorDia: 7000,
    foto: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format&fit=crop",
    avaliacao: 4.2,
    disponivel: true,
  },
];