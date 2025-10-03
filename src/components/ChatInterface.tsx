import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { CustomKeyboard } from './CustomKeyboard';
import { useTelegram } from './TelegramProvider';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { triggerHaptic, user } = useTelegram();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      setMessages([
        {
          role: 'system',
          content: `Привет, ${user.first_name}! Я AI-ассистент с памятью. Расскажи мне о своих друзьях, проектах или событиях, и я буду помнить всё о них.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    triggerHaptic('light');
    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowKeyboard(false);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: {
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId: user?.id,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      triggerHaptic('success');

      if (data.shouldShowKeyboard) {
        setShowKeyboard(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      triggerHaptic('error');
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyboardOption = (option: string) => {
    sendMessage(option);
  };

  const handleCustomOption = () => {
    setShowKeyboard(false);
    triggerHaptic('medium');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-screen relative z-10">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} {...message} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className={`border-t border-border bg-background p-4 transition-all ${
          showKeyboard ? 'mb-32' : 'mb-0'
        }`}
      >
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напишите сообщение..."
            disabled={isLoading}
            className="flex-1"
            onFocus={() => setShowKeyboard(false)}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      <CustomKeyboard
        isVisible={showKeyboard}
        onOptionClick={handleKeyboardOption}
        onCustomClick={handleCustomOption}
      />
    </div>
  );
};
