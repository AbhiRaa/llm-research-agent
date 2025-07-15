import type { Message } from '../hooks/useStream';
export function exportChatAsJSON(messages: Message[]): void {
  const dataStr = JSON.stringify(messages, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

export function exportChatAsMarkdown(messages: Message[]): void {
  const markdown = messages.map(msg => {
    const role = msg.role === 'user' ? '**You**' : '**AI Assistant**';
    const timestamp = msg.timestamp.toLocaleString();
    return `${role} (${timestamp}):\n${msg.text}\n\n---\n`;
  }).join('\n');
  
  const dataStr = markdown;
  const dataUri = 'data:text/markdown;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `chat-export-${new Date().toISOString().split('T')[0]}.md`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}