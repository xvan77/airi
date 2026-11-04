const TRUNCATED_SUFFIXES = ['...', '…'] as const

export function isTruncatedCatalogDescription(description: string | undefined): boolean {
  if (!description?.trim())
    return false
  const trimmed = description.trim()
  return TRUNCATED_SUFFIXES.some(suffix => trimmed.endsWith(suffix))
}

/**
 * Prefers a complete description over a truncated API preview.
 * When both sides are complete or both truncated, keeps the longer text.
 */
export function pickBestCatalogDescription(
  primary: string | undefined,
  secondary: string | undefined,
): string | undefined {
  const left = primary?.trim()
  const right = secondary?.trim()
  if (!left)
    return right || undefined
  if (!right)
    return left

  const leftTruncated = isTruncatedCatalogDescription(left)
  const rightTruncated = isTruncatedCatalogDescription(right)
  if (leftTruncated && !rightTruncated)
    return right
  if (!leftTruncated && rightTruncated)
    return left

  return left.length >= right.length ? left : right
}
