import { NewTopicPrompt } from "../components/NewTopicPrompt";

export function TopicEntryPage() {
  return (
    <main className="page page-topic">
      <section className="hero-shell">
        <p className="brand-mark">Prism</p>
        <h1>
          See any topic from
          <br />
          every angle that matters.
        </h1>
        <p className="lede">
          Choose a topic and discover the distinct perspectives that shape it.
        </p>
      </section>

      <NewTopicPrompt />
    </main>
  );
}
