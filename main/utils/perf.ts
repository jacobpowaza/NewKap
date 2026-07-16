const startupOrigin = performance.now();

export const mark = (name: string) => {
  console.log(`[perf] ${name}: ${(performance.now() - startupOrigin).toFixed(1)}ms`);
};
