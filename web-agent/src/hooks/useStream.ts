import { useState, useCallback, useRef } from "react";

export interface Citation {
  id: number;
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  citations?: Citation[];
}

export default function useStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const ask = useCallback(async (question: string) => {
    if (isLoading) return;

    setIsLoading(true);
    
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      text: question,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder assistant message
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      text: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const eventSource = new EventSource(
        `/api/stream?question=${encodeURIComponent(question)}`,
      );
      
      eventSourceRef.current = eventSource;
      let buffer = "";

      eventSource.addEventListener("token", (e: MessageEvent) => {
        try {
          const { text } = JSON.parse(e.data);
          buffer += text;
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, text: buffer, isStreaming: true }
              : msg
          ));
        } catch (error) {
          console.error('Error parsing token:', error);
        }
      });

      eventSource.addEventListener("done", (e: MessageEvent) => {
        try {
          const { answer, citations } = JSON.parse(e.data);
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, text: answer, citations: citations || [], isStreaming: false }
              : msg
          ));
        } catch (error) {
          console.error('Error parsing done event:', error);
        } finally {
          eventSource.close();
          setIsLoading(false);
        }
      });

      eventSource.addEventListener("error", (error) => {
        console.error('EventSource error:', error);
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, text: "Sorry, I encountered an error. Please try again.", isStreaming: false }
            : msg
        ));
        eventSource.close();
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Error setting up stream:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, text: "Sorry, I encountered an error. Please try again.", isStreaming: false }
          : msg
      ));
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsLoading(false);
    
    // Mark last message as not streaming
    setMessages(prev => prev.map((msg, index) => 
      index === prev.length - 1 && msg.isStreaming 
        ? { ...msg, isStreaming: false }
        : msg
    ));
  }, []);

  return { 
    messages, 
    ask, 
    isLoading, 
    clearMessages, 
    stopStream 
  };
}