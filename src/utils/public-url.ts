const getRuntimeEnv = () => {
  const runtimeProcess = (globalThis as any)?.process;
  return runtimeProcess?.env || {};
};

const normalizeBaseUrl = (req?: any) => {
  const env = getRuntimeEnv();
  const envUrl = env.BASE_URL || env.APP_URL || env.PUBLIC_URL;
  if (envUrl) {
    return String(envUrl).replace(/\/+$/, '');
  }

  if (req?.get) {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  return 'https://apiai.goexperts.in';
};

export const buildPublicFileUrl = (filepath?: string | null, req?: any) => {
  if (!filepath) return null;
  if (/^https?:\/\//i.test(filepath)) return filepath;

  const normalizedPath = String(filepath)
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');

  return `${normalizeBaseUrl(req)}/${normalizedPath}`;
};