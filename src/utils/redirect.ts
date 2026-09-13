// Only implemented application destinations are valid login return addresses.
export function loginDestination(value: unknown): string {
  return typeof value === 'string' && value === '/workspace' ? value : '/workspace'
}
