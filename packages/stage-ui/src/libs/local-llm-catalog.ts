export interface LocalLlmCatalogEntry {
  id: string
  name: string
  description: string
  repo: string
  filename: string
  size: string
}

export const LOCAL_LLM_BASE_CATALOG: LocalLlmCatalogEntry[] = [
  {
    id: 'gemma-270m',
    name: 'Gemma 3 270M IT',
    description: 'Google Gemma 3 270M Instruct in Q4_K_M GGUF. Very small offline chat model for low-end PCs. About 0.18 GB on disk.',
    repo: 'unsloth/gemma-3-270m-it-GGUF',
    filename: 'gemma-3-270m-it-Q4_K_M.gguf',
    size: '0.18 GB',
  },
  {
    id: 'qwen-1.5b',
    name: 'Qwen 2.5 1.5B',
    description: 'Qwen 2.5 1.5B Instruct in Q4_K_M GGUF. Fast compact offline chat for everyday talk. About 0.96 GB on disk.',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: '0.96 GB',
  },
  {
    id: 'llama-3b',
    name: 'Llama 3.2 3B',
    description: 'Meta Llama 3.2 3B Instruct in Q4_K_M GGUF. Stronger offline chat when the PC has about 8 GB RAM or more. About 2.02 GB on disk.',
    repo: 'Bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '2.02 GB',
  },
]
