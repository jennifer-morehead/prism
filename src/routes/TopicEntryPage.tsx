import { NewTopicPrompt } from "../components/NewTopicPrompt";

export function TopicEntryPage() {
  return (
    <main className="page page-topic">
      <section className="hero-shell">
        <p className="eyebrow">Prism Lens Studio</p>
        <h1>Reframe Any Topic Through Competing Perspectives</h1>
        <p className="lede">
          Enter a topic, pick a lens, and generate a structured exploration with
          concepts and explicit causal connections.
        </p>
      </section>

      <NewTopicPrompt />
    </main>
  );
}
