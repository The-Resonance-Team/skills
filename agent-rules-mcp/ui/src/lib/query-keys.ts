export const patchKeys = {
  dashboard: (token: string | null) => ['patches', token] as const,
};
