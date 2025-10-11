import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageCircle, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Character {
  id: string;
  name: string;
  category?: string;
  personality?: string;
  avatar_url?: string;
  facts?: string[];
}

interface CharacterSelectorProps {
  userId: string;
  onSelect: (characterName: string | null) => void;
  activeCharacter: string | null;
}

export const CharacterSelector = ({ userId, onSelect, activeCharacter }: CharacterSelectorProps) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCharacters();
  }, [userId]);

  const loadCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (data) {
      setCharacters(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Нет персонажей</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Создайте персонажа командой /create
        </p>
        <code className="text-xs bg-muted px-2 py-1 rounded">
          /create Имя | Описание | Категория
        </code>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-4">
        {activeCharacter && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelect(null)}
          >
            <X className="w-4 h-4 mr-2" />
            Выйти из режима чата
          </Button>
        )}

        {characters.map((char) => (
          <Card
            key={char.id}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeCharacter === char.name ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(char.name)}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {char.avatar_url ? (
                  <img
                    src={char.avatar_url}
                    alt={char.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Users className="w-6 h-6 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold truncate">{char.name}</h4>
                  {activeCharacter === char.name && (
                    <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>

                {char.category && (
                  <Badge variant="secondary" className="mb-2">
                    {char.category}
                  </Badge>
                )}

                {char.personality && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {char.personality}
                  </p>
                )}

                {char.facts && char.facts.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {char.facts.length} фактов
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
