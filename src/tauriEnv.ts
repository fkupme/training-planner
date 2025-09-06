export const isTauri = true;

// export async function safeImport<T>(loader: () => Promise<T>): Promise<T | null> {
//   if (!isTauri) return null;
//   try { return await loader(); } catch { return null; }
// }
