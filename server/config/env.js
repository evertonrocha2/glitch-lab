// A deployed server (Vercel, Render or any host that sets NODE_ENV=production), where dev fallbacks are off.
export const isProduction = () => process.env.VERCEL === '1' || Boolean(process.env.RENDER) || process.env.NODE_ENV === 'production'
