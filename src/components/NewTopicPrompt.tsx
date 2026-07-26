import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";

const suggestedTopics = [
  "Urban gardens",
  "Public libraries",
  "Renewable energy",
  "Sleep and learning",
  "Ocean conservation",
  "Walkable cities",
  "Community gardens",
  "Houseplants",
  "The history of maps",
  "Music and concentration",
  "A world without traffic lights",
  "Why some places feel like home",
  "What makes a city memorable",
  "The hidden life of a neighborhood park",
  "How food traditions travel",
  "The future of play",
  "Why bees matter",
  "The art of a good question",
  "How bicycles changed cities",
  "Designing for a rainy day",
];

function randomSuggestedTopics(): string[] {
  const shuffled = [...suggestedTopics];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, 5);
}

interface NewTopicPromptProps {
  showSuggestions?: boolean;
}

export function NewTopicPrompt({
  showSuggestions = true,
}: NewTopicPromptProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [topic, setTopic] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions] = useState(randomSuggestedTopics);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTopicSession({ topicText: topic });
      navigate(`/session/${result.topicSession.id}/lenses`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create session",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="new-topic-prompt">
      <form onSubmit={handleSubmit} className="topic-form">
        <input
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={
            pathname === "/"
              ? "Enter a topic to explore"
              : "Enter a new topic to explore"
          }
          aria-label="New topic"
          maxLength={120}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Refracting..." : "Explore"}
        </button>
      </form>
      {showSuggestions ? (
        <div className="topic-suggestions" aria-label="Suggested topics">
          <span className="suggestions-label">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="suggested-topic"
              type="button"
              onClick={() => setTopic(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
