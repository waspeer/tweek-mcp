export async function main(): Promise<void> {
  console.warn('[auth-signin] stub - to be implemented in Task 6')
}

if (import.meta.main) {
  // Explicitly mark as intentionally not awaited to satisfy lint rule
  void main()
}
