/**
 * Where the landing sends people. Plain hrefs, not router links: the landing
 * also renders before the router exists (the hosted build's startup fallback),
 * so it cannot depend on router context.
 */
export const landingLinks = {
  demo: '/demo',
  signUp: '/login',
  signIn: '/login',
  windows: 'https://github.com/LEAN-EnLAN/Campus/releases',
  whatsapp: 'https://wa.me/5493412008643',
} as const

export const WHATSAPP_DISPLAY = '+54 9 341 200-8643'
