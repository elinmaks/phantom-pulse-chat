import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export const ChatMessage = ({ role, content, timestamp }: ChatMessageProps) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div
      className={cn(
        'flex w-full animate-fade-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser && 'bg-primary text-primary-foreground',
          !isUser && !isSystem && 'bg-card text-card-foreground border border-border',
          isSystem && 'bg-accent/50 text-accent-foreground text-sm italic'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{content}</div>
        {timestamp && (
          <div className="text-xs opacity-50 mt-1">
            {timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
};
