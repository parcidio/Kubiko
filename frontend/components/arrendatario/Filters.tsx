import { MapPin, Banknote, Tag, Bookmark, Calendar } from "lucide-react"

export default function BeeznoFilters()
{
    const stats = [
  { icon: MapPin, label: "Província" },
  { icon: Banknote, label: "Preço" },
  { icon: Bookmark, label: "Categoria" },
];
    return (
        <div className="px-6 py-16 sm:px-8 sm:py-20">
            <div className="fixed rounded-lg bg-card border border-border-bg max-w-2xl">
                <div className="border-b border-border-bg flex justify-center">
                    <h1 className="font-light text-card-foreground">Filtros</h1>
                </div>
                <div className="flex flex-col gap-4 p-6">
                    <div className="rounded-xl bg-accent px-6 py-8">
                        <div>
                            <h1 className="text-accent-foreground font-bold">As tuas preferências</h1>
                        </div>
                    </div>
                    <div className="rounded-lg bg-background px-6 py-8">
                        <div>
                            <h1 className="font-bold">Editar preferências</h1>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}