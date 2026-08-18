/**
 * The search overlay is only mounted once it is asked for, so its chunk was fetched by the click
 * that opened it. `AiAssistantPanel` is mounted unconditionally and controlled by `isOpen`, which
 * is why Ask AI has always felt instant while Search could sit for a second with nothing on
 * screen -- the press animation ran, the overlay did not exist yet, and it read as a dead button.
 * Warming the module after launch removes that wait without putting search on the eager path.
 */
const importGlobalSearch = () => import('./GlobalSearch')

export const loadGlobalSearch = importGlobalSearch

/** Fire-and-forget: a failed warm-up must not surface, the real open retries the import. */
export function preloadGlobalSearch(): void {
  void importGlobalSearch().catch(() => undefined)
}
