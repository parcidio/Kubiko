import { Search, ArrowRight, Package, Camera, Video, Mic, Sparkles, Plane, Plus, Shield, Star, Leaf } from "lucide-react";

const categories = [
  { label: "Fotografia", icon: Camera },
  { label: "Vídeo", icon: Video },
  { label: "Áudio", icon: Mic },
  { label: "Eventos", icon: Sparkles },
  { label: "Drone", icon: Plane },
];

export default function BeeznoCategories()
{
    return (
        <section className="relative min-h-screen overflow-hidden bg-background">
            <div className="p-8 flex">
                <h1 className="text-5xl font-semibold">Categorias em destaque</h1>
            </div>
            {/* Chips de categorias */}
          <div className="mt-7 flex flex-wrap gap-2">
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2 text-sm text-[#3A3A36] transition-colors hover:border-[#2F6B4F] hover:text-[#2F6B4F]"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2 text-sm text-[#3A3A36] transition-colors hover:border-[#2F6B4F] hover:text-[#2F6B4F]">
              <Plus className="h-3.5 w-3.5" />
              Mais
            </button>
          </div>
        </section>
    )
}