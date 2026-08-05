import type { CSSProperties } from 'react'

function cssPropertyNameToReactName(name: string) {
  const trimmedName = name.trim()
  if (trimmedName.startsWith('--')) return trimmedName
  return trimmedName.replace(/-([a-z])/gu, (_, character: string) => character.toUpperCase())
}

/** Parse CSS declarations entered in Admin Console into scoped inline styles. */
export function cssDeclarationsToStyle(value: string): CSSProperties {
  const style: Record<string, string> = {}

  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue

    const property = cssPropertyNameToReactName(declaration.slice(0, separator))
    const propertyValue = declaration.slice(separator + 1).trim()
    if (!property.trim() || !propertyValue) continue
    style[property] = propertyValue
  }

  return style as CSSProperties
}
