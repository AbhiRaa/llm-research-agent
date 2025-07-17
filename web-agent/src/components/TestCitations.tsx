// Test component to verify citation integration
import Message from "./Message"

export default function TestCitations() {
  // Sample data that matches the backend format
  const testMessage = {
    role: "assistant" as const,
    text: "Docker was invented by Solomon Hykes, who first released Docker Engine in 2013 under Docker, Inc. [1] Solomon Hykes introduced Docker to the world at PyCon 2013, showcasing its capabilities. [2] [3]",
    citations: [
      {
        id: 1,
        title: "Docker (software) - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Docker_(software)"
      },
      {
        id: 2,
        title: "What led to the invention of Docker? - Reddit",
        url: "https://www.reddit.com/r/docker/comments/18tkspm/what_led_to_the_invention_of_docker/"
      },
      {
        id: 3,
        title: "11 Years of Docker: Shaping the Next Decade of Development",
        url: "https://www.docker.com/blog/docker-11-year-anniversary/"
      }
    ]
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Citation Integration Test</h2>
      <Message
        role={testMessage.role}
        text={testMessage.text}
        citations={testMessage.citations}
      />
    </div>
  )
}