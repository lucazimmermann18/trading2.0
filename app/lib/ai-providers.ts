export type ProviderKey = "anthropic" | "openai" | "deepseek" | "gemini"

export interface AIModel {
  id: string
  label: string
  context: string
  badge?: "FAST" | "SMART" | "CHEAP" | "REASON"
}

export interface AIProvider {
  key: ProviderKey
  name: string
  baseUrl: string
  docsUrl: string
  models: AIModel[]
  color: string
  icon: string
}

export const PROVIDERS: AIProvider[] = [
  {
    key: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    color: "#cc785c",
    icon: "A",
    models: [
      { id: "claude-opus-4-7",           label: "Claude Opus 4.7",    context: "200K",  badge: "SMART"  },
      { id: "claude-sonnet-4-6",          label: "Claude Sonnet 4.6", context: "200K",  badge: "FAST"   },
      { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  context: "200K",  badge: "CHEAP"  },
    ],
  },
  {
    key: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    docsUrl: "https://platform.openai.com/docs",
    color: "#10a37f",
    icon: "O",
    models: [
      { id: "gpt-4o",       label: "GPT-4o",        context: "128K", badge: "SMART" },
      { id: "gpt-4o-mini",  label: "GPT-4o Mini",   context: "128K", badge: "FAST"  },
      { id: "o4-mini",      label: "o4-mini",        context: "128K", badge: "REASON" },
      { id: "o3",           label: "o3",             context: "200K", badge: "REASON" },
    ],
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    docsUrl: "https://platform.deepseek.com/api-docs",
    color: "#4d9de0",
    icon: "D",
    models: [
      { id: "deepseek-chat",      label: "DeepSeek V3",       context: "64K",  badge: "FAST"   },
      { id: "deepseek-reasoner",  label: "DeepSeek R1",       context: "64K",  badge: "REASON" },
    ],
  },
  {
    key: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    docsUrl: "https://ai.google.dev/docs",
    color: "#4285f4",
    icon: "G",
    models: [
      { id: "gemini-2.5-pro",         label: "Gemini 2.5 Pro",      context: "1M",   badge: "SMART"  },
      { id: "gemini-2.0-flash",       label: "Gemini 2.0 Flash",    context: "1M",   badge: "FAST"   },
      { id: "gemini-2.0-flash-lite",  label: "Gemini 2.0 Flash Lite", context: "1M", badge: "CHEAP"  },
    ],
  },
]

export const BADGE_COLORS: Record<string, string> = {
  FAST:   "bg-accent-green/15 text-accent-green",
  SMART:  "bg-accent-blue/15 text-accent-blue",
  CHEAP:  "bg-accent-amber/15 text-accent-amber",
  REASON: "bg-accent-violet/15 text-accent-violet",
}

export interface AISettings {
  activeProvider: ProviderKey
  /** true = key is stored in the database (never exposed to client) */
  keyStatus: Record<ProviderKey, boolean>
  selectedModels: Record<ProviderKey, string>
  useAI: boolean
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: "anthropic",
  keyStatus: { anthropic: false, openai: false, deepseek: false, gemini: false },
  selectedModels: {
    anthropic: "claude-sonnet-4-6",
    openai:    "gpt-4o",
    deepseek:  "deepseek-chat",
    gemini:    "gemini-2.0-flash",
  },
  useAI: false,
}

export const STORAGE_KEY = "tradeai_ai_settings"
