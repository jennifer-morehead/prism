export const demoTopics = [
  "Urban heat islands in coastal cities",
  "The future of public libraries",
  "How music affects concentration",
  "Designing better playgrounds",
  "Why bees matter to ecosystems",
  "What makes a city walkable",
  "How sleep supports learning",
  "The history of maps",
  "How food traditions travel",
] as const;

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isDemoTopic(topic: string): boolean {
  const normalizedTopic = normalizeTopic(topic);
  return demoTopics.some((item) => normalizeTopic(item) === normalizedTopic);
}

export function randomDemoTopic(excludeTopic?: string): string {
  const excluded = excludeTopic ? normalizeTopic(excludeTopic) : null;
  const choices = demoTopics.filter(
    (topic) => normalizeTopic(topic) !== excluded,
  );
  const pool = choices.length > 0 ? choices : demoTopics;
  return pool[Math.floor(Math.random() * pool.length)] ?? demoTopics[0];
}

export function randomDemoTopicChoices(
  selectedTopic: string,
  count = 5,
): string[] {
  const selected = normalizeTopic(selectedTopic);
  const shuffled = demoTopics
    .filter((topic) => normalizeTopic(topic) !== selected)
    .slice();

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count);
}
