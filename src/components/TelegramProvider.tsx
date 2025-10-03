import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramContextType {
  user: TelegramUser | null;
  initData: string;
  isReady: boolean;
  triggerHaptic: (style: 'light' | 'medium' | 'heavy' | 'error' | 'success') => void;
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: () => void;
}

const TelegramContext = createContext<TelegramContextType>({
  user: null,
  initData: '',
  isReady: false,
  triggerHaptic: () => {},
  showMainButton: () => {},
  hideMainButton: () => {},
});

export const useTelegram = () => useContext(TelegramContext);

interface TelegramProviderProps {
  children: ReactNode;
}

export const TelegramProvider = ({ children }: TelegramProviderProps) => {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      tg.ready();
      tg.expand();
      
      setInitData(tg.initData);
      
      if (tg.initDataUnsafe?.user) {
        setUser({
          id: tg.initDataUnsafe.user.id,
          first_name: tg.initDataUnsafe.user.first_name,
          last_name: tg.initDataUnsafe.user.last_name,
          username: tg.initDataUnsafe.user.username,
          photo_url: tg.initDataUnsafe.user.photo_url,
        });
      }
      
      setIsReady(true);
    } else {
      console.warn('Telegram WebApp API not available. Running in development mode.');
      setUser({
        id: 123456789,
        first_name: 'Dev',
        last_name: 'User',
        username: 'devuser',
      });
      setIsReady(true);
    }
  }, []);

  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'error' | 'success') => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      switch (style) {
        case 'light':
          tg.HapticFeedback.impactOccurred('light');
          break;
        case 'medium':
          tg.HapticFeedback.impactOccurred('medium');
          break;
        case 'heavy':
          tg.HapticFeedback.impactOccurred('heavy');
          break;
        case 'error':
          tg.HapticFeedback.notificationOccurred('error');
          break;
        case 'success':
          tg.HapticFeedback.notificationOccurred('success');
          break;
      }
    }
  };

  const showMainButton = (text: string, onClick: () => void) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.MainButton) {
      tg.MainButton.text = text;
      tg.MainButton.show();
      tg.MainButton.onClick(onClick);
    }
  };

  const hideMainButton = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.MainButton) {
      tg.MainButton.hide();
    }
  };

  return (
    <TelegramContext.Provider
      value={{
        user,
        initData,
        isReady,
        triggerHaptic,
        showMainButton,
        hideMainButton,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        MainButton?: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}
