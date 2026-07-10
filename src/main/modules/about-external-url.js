const ALLOWED_ABOUT_EXTERNAL_URLS = new Set([
  'https://mxvoice.app/',
  'https://mxvoice.app/docs/',
  'mailto:support@mxvoice.app?subject=Mx.%20Voice%20Support%20Request'
]);

function isAllowedAboutExternalUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (!['https:', 'mailto:'].includes(url.protocol)) return false;
    return ALLOWED_ABOUT_EXTERNAL_URLS.has(url.href);
  } catch {
    return false;
  }
}

export { isAllowedAboutExternalUrl };
