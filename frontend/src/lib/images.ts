/**
 * Comprime fotos antes do upload (rede móvel lenta; a API aceita JPEG/PNG até 5 MB).
 * Lado maior até 1600 px, JPEG 82%. Se o browser não conseguir ler a imagem (p. ex. HEIC), devolve o original
 * e a API responde com o erro de tipo.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Foto de perfil: recorte quadrado ao centro, 512 px, JPEG 85% (~40–70 KB).
 * JPEG e não WebP: a API só aceita JPEG/PNG e recodifica tudo (decisoes-produto.md 2026-11-18).
 * Se o browser não conseguir ler a imagem (p. ex. HEIC), devolve o original e a API responde com o erro de tipo.
 */
export async function compressAvatar(file: File, side = 512, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const crop = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(side, crop);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, out, out);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
