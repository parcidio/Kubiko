import { cookies } from "next/headers";
import { getDict, LANG_COOKIE, toLang, type Lang } from "./index";

/** Língua do pedido (cookie `lang`, omissão "pt"). Só em server components e generateMetadata. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return toLang(store.get(LANG_COOKIE)?.value);
}

/** Dicionário da língua do pedido: const t = await getT(); t.landing.hero.lead */
export async function getT() {
  return getDict(await getLang());
}
