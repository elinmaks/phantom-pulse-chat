import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { CustomKeyboard } from './CustomKeyboard';
import { CharacterSelector } from './CharacterSelector';
import { CharacterGraph } from './CharacterGraph';
import { useTelegram } from './TelegramProvider';
import { Send, Loader2, Users, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
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
      const greeting = activeCharacter
        ? `Привет! Теперь я в роли ${activeCharacter}. Давай пообщаемся! 🎭`
        : `Привет, ${user.first_name}! Я AI-ассистент с памятью. Создавай персонажей и чат с ними! 💬`;
      
      setMessages([
        {
          role: 'system',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user, activeCharacter]);

  const handleCharacterSelect = (characterName: string | null) => {
    setActiveCharacter(characterName);
    triggerHaptic('medium');
    toast({
      title: characterName ? `🎭 Режим: ${characterName}` : '💬 Обычный режим',
      description: characterName
        ? 'Теперь вы общаетесь с персонажем'
        : 'Вернулись к обычному чату',
    });
  };

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
    setIsTyping(true);
    setShowKeyboard(false);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: {
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId: user?.id,
          activeCharacter,
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
      setIsTyping(false);
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
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            {activeCharacter ? (
              <div>
                <div className="text-sm font-semibold">🎭 Режим чата</div>
                <div className="text-xs text-muted-foreground">{activeCharacter}</div>
              </div>
            ) : (
              <div className="text-sm font-semibold">💬 AI Ассистент</div>
            )}
          </div>
          <div className="flex gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Users className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Персонажи и Связи</SheetTitle>
                  <SheetDescription>
                    Управляйте персонажами и анализируйте их связи
                  </SheetDescription>
                </SheetHeader>
                <Tabs defaultValue="characters" className="mt-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="characters">Персонажи</TabsTrigger>
                    <TabsTrigger value="graph">Граф</TabsTrigger>
                  </TabsList>
                  <TabsContent value="characters" className="mt-4">
                    {user && (
                      <CharacterSelector
                        userId={user.id.toString()}
                        onSelect={handleCharacterSelect}
                        activeCharacter={activeCharacter}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="graph" className="mt-4">
                    {user && <CharacterGraph userId={user.id.toString()} />}
                  </TabsContent>
                </Tabs>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} {...message} />
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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
