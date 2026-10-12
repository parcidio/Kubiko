import { catalogo } from "@/lib/marketplace"
import { Clock, IdCard, ShieldCheck, Smartphone } from "lucide-react"
import Image from "next/image"

export default async function ItemPage({params}: { params: Promise<{ id: string }> }) {
const { id } = await params
const item = catalogo.find(item => item.id === id)

return (
    <div>
        <div className="flex gap-4">
            <div className="flex items-center">
                <div className="flex items-center justify-center">
                    <img className="flex items-center justify-center" src={item?.foto || ''} alt={item?.nome} />
                </div>
                <div>
                    <div>
                        <img src={item?.foto || ''} alt={item?.nome} width={400} height={250}/>
                    </div>
                    <div>
                        <img src={item?.foto || ''} alt={item?.nome} width={400} height={250}/>
                    </div>
                </div>
            </div>
            <div>
            </div>
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-24">
            <div>
                <div className="flex gap-2">
                    <div className="bg-input rounded-xs">
                        <h1 className="text-secondary-foreground text-xs font-bold">{item?.categoria}</h1>
                    </div>
                    <div className="bg-input rounded-xs">
                        <h1 className="text-secondary-foreground text-xs font-bold">Particular</h1>
                    </div>
                </div>
                <div>
                    <h1 className="text-4xl font-bold">{item?.nome}</h1>
                    <h1 className="text-2xl font-bold">{item?.precoPorDia.toLocaleString("pt-AO")} Kz
                        <span className="text-[10px] sm:text-xs font-normal text-muted-foreground"> /dia</span>
                    </h1>
                </div>
            </div>
            <div className="flex flex-col gap-6">
                <div className="bg-card border border-border-bg rounded-xs">
                    <h1 className="font-bold text-card-foreground mx-6 mt-6">Pedir reserva</h1>
                    <div className="flex mx-6 gap-6 py-4">
                        <div className="">
                            <h1 className="text-card-foreground text-xs">Levantar</h1>
                            <input type="date" className="bg-card rounded-xs border-2 border-border-bg/40 px-6 py-2"/>
                        </div>
                        <div className="">
                            <h1 className="text-card-foreground text-xs">Devolver</h1>
                            <input type="date" className="bg-card rounded-xs border-2 border-border-bg/40 px-6 py-2"/>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border-bg rounded-xs">
                    <div className="flex gap-4 mx-6 mt-6">
                        <div className="bg-ring/30 rounded-full justify-center w-12 h-12 flex items-center">
                            <h1 className="uppercase text-accent-foreground font-bold">EM</h1>
                        </div>
                        <div>
                            <div className="flex gap-2 items-center">
                                <h1 className="font-bold text-sm">Edson Mateus</h1>
                                <div className="flex gap-1 bg-accent px-2 py-0.5 rounded-xs items-center">
                                    <ShieldCheck className="w-3 h-3"/>
                                    <h1 className="text-xs font-semibold">Verificado</h1>
                                </div>
                            </div>
                            <div className="mt-2 flex gap-1.5">
                                <h1 className="text-xs text-muted-foreground">Particular · </h1>
                                <h1 className="text-xs text-muted-foreground">Talatona · </h1>
                                <h1 className="text-xs text-muted-foreground">Membro desde 2023</h1>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 mx-8 mt-6 font-display mb-6">
                        <div className="flex gap-1.5">
                            <IdCard className="w-4 h-4 text-muted-foreground"/>
                            <h1 className="text-xs text-muted-foreground">BI e selfie verificados pela equipa</h1>
                        </div>
                        <div className="flex gap-1.5">
                            <Smartphone className="w-4 h-4 text-muted-foreground"/>
                            <h1 className="text-xs text-muted-foreground">Telefone confirmado</h1>
                        </div>
                        <div className="flex gap-1.5">
                            <Clock className="w-4 h-4 text-muted-foreground"/>
                            <h1 className="text-xs text-muted-foreground">Costuma responder em ~3 horas</h1>
                        </div>
                    </div>
                </div>
                <div className="rounded-xs bg-accent">
                    <div className="flex gap-2 mx-6 mt-6 mb-6 items-center">
                        <ShieldCheck className="w-4 h-4 font-bold"/>
                        <div className="text-sm">
                            <h1 className="font-bold">Protecção Beeznoo</h1>
                            <p>Caução retida pela Beeznoo, checklist com fotos</p>
                            <p>na entrega e na devolução, e podes reportar o</p>
                            <p>problema até 24h depois de receber o</p>
                            <p>equipamento.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)


}
