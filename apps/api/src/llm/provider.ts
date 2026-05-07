import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

export class MissingApiKeyError extends Error {
  readonly provider: 'google' | 'anthropic'
  readonly envVar: string

  constructor(provider: 'google' | 'anthropic', envVar: string) {
    super(
      `${envVar} is not set — see /setup-environment or apps/api/.env.example. ` +
        `(LLM_PROVIDER=${provider})`
    )
    this.name = 'MissingApiKeyError'
    this.provider = provider
    this.envVar = envVar
  }
}

const PROVIDER = (process.env.LLM_PROVIDER ?? 'google').toLowerCase()

const DEFAULT_MODEL: Record<string, string> = {
  google: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-4-5',
}

export function getModel(): LanguageModel {
  const modelId = process.env.GALLEY_MODEL ?? DEFAULT_MODEL[PROVIDER]
  if (!modelId) {
    throw new Error(
      `Unsupported LLM_PROVIDER "${PROVIDER}" — expected "google" or "anthropic".`
    )
  }

  if (PROVIDER === 'google') {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) throw new MissingApiKeyError('google', 'GOOGLE_GENERATIVE_AI_API_KEY')
    return createGoogleGenerativeAI({ apiKey })(modelId)
  }

  if (PROVIDER === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new MissingApiKeyError('anthropic', 'ANTHROPIC_API_KEY')
    return createAnthropic({ apiKey })(modelId)
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${PROVIDER}" — expected "google" or "anthropic".`
  )
}

export const PROVIDER_NAME: 'google' | 'anthropic' =
  PROVIDER === 'anthropic' ? 'anthropic' : 'google'
