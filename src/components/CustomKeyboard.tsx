import { Button } from '@/components/ui/button';

interface CustomKeyboardProps {
  isVisible: boolean;
  onOptionClick: (option: string) => void;
  onCustomClick: () => void;
}

export const CustomKeyboard = ({ isVisible, onOptionClick, onCustomClick }: CustomKeyboardProps) => {
  if (!isVisible) return null;

  const options = ['Да', 'Нет', 'Возможно', 'Не знаю'];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 animate-slide-up z-50">
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
        {options.map((option) => (
          <Button
            key={option}
            variant="secondary"
            onClick={() => onOptionClick(option)}
            className="h-12 text-base"
          >
            {option}
          </Button>
        ))}
        <Button
          variant="outline"
          onClick={onCustomClick}
          className="col-span-2 h-12 text-base"
        >
          Мой вариант
        </Button>
      </div>
    </div>
  );
};
