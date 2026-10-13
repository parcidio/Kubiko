import { catalogo } from "@/lib/marketplace";

export default function ItemGallery({id}: {id: string})
{
    const item = catalogo.find((entry) => entry.id === id);
    return (
    <div>
        {/* Galeria desktop */}
        <section className="mb-6 hidden h-90 grid-cols-3 gap-3 lg:grid">
          <div className="col-span-2 min-h-0 min-w-0 overflow-hidden rounded-xs bg-muted">
            <img
              src={item?.foto}
              alt={item?.nome}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="grid min-h-0 min-w-0 grid-rows-2 gap-3">
            <div className="min-h-0 overflow-hidden rounded-xs bg-muted">
              <img
                src={item?.foto}
                alt={`${item?.nome} — traseira`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-h-0 overflow-hidden rounded-xs bg-muted">
              <img
                src={item?.foto}
                alt={`${item?.nome} — acessórios`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Galeria mobile */}
        <section className="mb-5 lg:hidden">
          <div className="relative overflow-hidden rounded-xs bg-muted">
            <img
              src={item?.foto}
              alt={item?.nome}
              className="h-56 w-full object-cover"
            />
            <span className="absolute right-3 top-3 rounded-xs bg-black/50 px-2 py-1 text-xs text-white">
              1 / 3
            </span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {[item?.foto, item?.foto, item?.foto].map((source, index) => (
              <img
                key={index}
                src={source}
                alt=""
                className="h-14 w-20 shrink-0 rounded-xs object-cover opacity-70 transition-opacity hover:opacity-100"
              />
            ))}
          </div>
        </section>
    </div>
)
}
