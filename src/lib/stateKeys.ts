export const stateKeys = {
  topicSession: (topicSessionId: string) =>
    ["topicSession", topicSessionId] as const,
  lenses: (includeInactive: boolean) => ["lenses", includeInactive] as const,
  exploration: (topicSessionId: string, lensId: string) =>
    ["exploration", topicSessionId, lensId] as const,
  generation: (generationRunId: string) =>
    ["generation", generationRunId] as const,
};
