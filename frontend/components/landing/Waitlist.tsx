"use client"

import { motion } from "framer-motion"
import { MessageCircle, MessageCircleCode,  } from "lucide-react"

const NUMERO = "244932300335";

function abrirWhatsapp() {
    const texto = encodeURIComponent("Olá! Tenho interesse em saber mais sobre o Beeznoo.");
    window.open(`https://wa.me/${NUMERO}?text=${texto}`, "_blank");
  }

export default function BeeznoWaitlist()
{

    return (
        <motion.section className="bg-card px-6 py-10 flex items-center justify-center">
            <div className="bg-sand border border-border-bg/40 px-8 py-12 rounded-3xl flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-12 justify-center">
                <div className="bg-shield rounded-full w-18 h-18 shrink-0 flex items-center justify-center">
                    <MessageCircleCode className="h-8 w-8 text-shield-foreground" />
                </div>
                <div>
                    <h1 className="text-3xl font-black">
                        Tens dúvidas? Fala connosco no
                        <br/>
                        WhatsApp.
                    </h1>
                    <p className="font-sans text-muted-foreground">
                        Queres saber mais, disponibilizar equipamento da tua empresa ouer parceiro do 
                        <br/>
                        Beeznoo? Manda-nos uma mensagem.
                    </p>
                </div>
                <div className="flex items-center">
                    <button onClick={abrirWhatsapp} className="bg-shield flex gap-2 items-center text-shield-foreground px-8 py-3 cursor-pointer rounded-full hover:opacity-90 transition-opacity">
                        <MessageCircle className="h-4 w-4 text-shield-foreground font-bold" />
                        <p className="font-bold">
                            Falar no WhatsApp
                        </p>
                    </button>
                </div>
            </div>
        </motion.section>
    )
}