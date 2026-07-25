import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";

export function TopicEntryPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTopicSession({ topicText: topic });
      navigate(`/session/${result.topicSession.id}/lenses`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create session";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page page-topic">
      <h1>What topic would you like to explore?</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Type a topic"
          aria-label="Topic"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Continue"}
        </button>
      </form>
      {error ? <p>{error}</p> : null}
    </main>
  );
}
