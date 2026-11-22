import { z } from 'zod'
import { translateImportTexts, TranslationError } from '../lib/translators/libretranslate'

// Translates the texts of an import review to Spanish with the self-hosted LibreTranslate (ADR 0008).
const bodySchema = z.object({
  title: z.string().max(200),
  description: z.string().max(20_000).default(''),
  tags: z.array(z.string().max(40)).max(30).default([]),
})

export default defineEventHandler(async (event) => {
  const url = useRuntimeConfig(event).translateUrl
  if (!url) throw createError({ statusCode: 501, statusMessage: 'La traducción no está configurada (NUXT_TRANSLATE_URL)' })
  const body = await readValidatedBody(event, bodySchema.parse)
  try {
    return await translateImportTexts(body, { url })
  }
  catch (err) {
    console.warn('[translate] failed', (err as Error).message)
    const rejected = err instanceof TranslationError && err.code === 'rejected'
    throw createError({
      statusCode: 502,
      statusMessage: rejected ? 'El traductor no admite este texto o idioma' : 'El traductor no responde ahora. Inténtalo en un momento.',
    })
  }
})
