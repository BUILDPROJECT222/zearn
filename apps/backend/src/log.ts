export const log = (scope: string) => ({
  info: (...a: unknown[]) => console.log(new Date().toISOString(), `[${scope}]`, ...a),
  warn: (...a: unknown[]) => console.warn(new Date().toISOString(), `[${scope}]`, ...a),
  error: (...a: unknown[]) => console.error(new Date().toISOString(), `[${scope}]`, ...a),
});
