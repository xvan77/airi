# Model catalog pricing tiers use one resolver pipeline

Status: accepted

## Context

Consciousness filters models with **Free**, **Limited**, and **Paid** chips.
Google Gemini pricing uses a clear rule: a free tier plus a paid tier on the same model is **Limited**.
Groq and other providers need the same meaning without copy-paste `if (providerId)` branches.

## Decision

### Tier meanings

| Tier | Meaning |
| --- | --- |
| **free** | The catalog has no metered price for the model on a paid plan. |
| **limited** | The model can run for $0 inside a provider quota or free plan. A paid meter exists or can apply later. |
| **paid** | No usable free path is listed for the model. |
| **null** | A pricing adapter exists but this model id has no row. The UI shows no price chip. |

### Evidence

Each provider adapter supplies `PricingTierEvidence`:

- `freePath`: `none`, `quota`, or `unmetered`
- `paidPath`: whether a paid meter exists on the same offering

`resolvePricingTierFromEvidence` turns evidence into a tier.
Gemini table cells, Groq snapshot lines, and future xAI sources all feed this function.

### Catalog pipeline

`resolveModelPricingTier` runs these steps in order:

1. Model id contains `:free` → **free**
2. Registered provider tier table → tier or **null**
3. Listing API rate units → **paid** if any rate is above zero, else **free**
4. Provider default from attributes → else **paid**

Step 3 does not guess **limited** without evidence. **Limited** comes from step 2 or from a future adapter that sets `freePath: 'quota'`.

### Provider adapters

- **google-generative-ai**: parses the Gemini pricing page into a tier table via `tierFromGeminiPriceCells`.
- **groq**: ships a curated tier table. Each line is normalized through `tierFromExplicitCatalogLabel`.
- **Other providers**: add a tier table or metadata adapter. Do not add branches in `catalog.ts`.

Implementation: `packages/stage-ui/src/libs/model-catalog/resolve-pricing-tier.ts`.

## Consequences

- New cloud providers share one resolver. They only add evidence or a table.
- Listing metadata alone cannot distinguish **free** vs **limited** without a paid-path signal.
- Tier tables need periodic updates when vendors change models.

## Usable chat (Ping and Consciousness)

Provider Ping and the Consciousness catalog share `isUsableChatModel` from `@proj-airi/stage-shared/chat-model-eligibility`.
OpenAI-compatible Ping passes `catalogProviderId` from the provider definition so retired or non-chat models are not probed.
