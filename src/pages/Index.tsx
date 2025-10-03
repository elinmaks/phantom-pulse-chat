import { ParticlesBackground } from '@/components/ParticlesBackground';
import { ChatInterface } from '@/components/ChatInterface';
import { TelegramProvider } from '@/components/TelegramProvider';

const Index = () => {
  return (
    <TelegramProvider>
      <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
        <ParticlesBackground />
        <ChatInterface />
      </div>
    </TelegramProvider>
  );
};

export default Index;
