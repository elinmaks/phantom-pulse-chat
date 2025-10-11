import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, TrendingUp } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  category?: string;
}

interface Relationship {
  id: string;
  from_character_id: string;
  to_character_id: string;
  relationship_type: string;
  description: string;
  strength: number;
}

interface CharacterGraphProps {
  userId: string;
}

export const CharacterGraph = ({ userId }: CharacterGraphProps) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    avgConnections: 0,
  });

  useEffect(() => {
    loadGraphData();
  }, [userId]);

  const loadGraphData = async () => {
    const [charsRes, relsRes] = await Promise.all([
      supabase.from('characters').select('id, name').eq('user_id', userId),
      supabase.from('relationships').select('*').eq('user_id', userId),
    ]);

    if (charsRes.data) setCharacters(charsRes.data);
    if (relsRes.data) setRelationships(relsRes.data);

    const totalNodes = charsRes.data?.length || 0;
    const totalEdges = relsRes.data?.length || 0;
    const avgConnections = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;

    setStats({ totalNodes, totalEdges, avgConnections });
    setLoading(false);
  };

  const getCharacterConnections = (charId: string) => {
    return relationships.filter(
      (rel) => rel.from_character_id === charId || rel.to_character_id === charId
    ).length;
  };

  const getMostConnected = () => {
    const connections = characters.map((char) => ({
      ...char,
      connections: getCharacterConnections(char.id),
    }));
    return connections.sort((a, b) => b.connections - a.connections).slice(0, 3);
  };

  const getRelationshipTypes = () => {
    const types: { [key: string]: number } = {};
    relationships.forEach((rel) => {
      types[rel.relationship_type] = (types[rel.relationship_type] || 0) + 1;
    });
    return Object.entries(types).sort((a, b) => b[1] - a[1]);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (characters.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Network className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Граф связей пуст</h3>
        <p className="text-sm text-muted-foreground">
          Создайте персонажей и связи между ними
        </p>
      </Card>
    );
  }

  const mostConnected = getMostConnected();
  const relationshipTypes = getRelationshipTypes();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Network className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Граф связей</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-primary">{stats.totalNodes}</div>
          <div className="text-xs text-muted-foreground">Персонажей</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-primary">{stats.totalEdges}</div>
          <div className="text-xs text-muted-foreground">Связей</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {stats.avgConnections.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">Среднее связей</div>
        </div>
      </div>

      {mostConnected.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Самые связанные</h4>
          </div>
          <div className="space-y-2">
            {mostConnected.map((char) => (
              <div
                key={char.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div>
                  <div className="font-medium">{char.name}</div>
                  {char.category && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {char.category}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{char.connections}</div>
                  <div className="text-xs text-muted-foreground">связей</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationshipTypes.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-3">Типы связей</h4>
          <div className="space-y-2">
            {relationshipTypes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <Badge variant="outline">{type}</Badge>
                <span className="text-sm text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Используйте команды /create и /link для управления графом
        </p>
      </div>
    </Card>
  );
};
