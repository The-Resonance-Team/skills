export function noStoreHeaders(): Headers {
  return new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
}
