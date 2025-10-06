import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Character {
  name: string;
  mentions: number;
  facts: string[];
}

interface Event {
  name: string;
  mentions: number;
  details: string[];
}

interface Topic {
  name: string;
  mentions: number;
  info: string[];
}

interface KnowledgeBase {
  characters: { [key: string]: Character };
  events: { [key: string]: Event };
  topics: { [key: string]: Topic };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load knowledge base from database
    const kb = await loadKnowledgeBase(supabase, userId);
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    if (lastUserMessage.startsWith('/summary')) {
      const target = lastUserMessage.split(' ')[1] || 'all';
      const summary = generateSummary(kb, target);
      return new Response(
        JSON.stringify({ response: summary, shouldShowKeyboard: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (lastUserMessage.startsWith('/facts')) {
      const target = lastUserMessage.split(' ')[1] || 'all';
      const facts = generateFacts(kb, target);
      return new Response(
        JSON.stringify({ response: facts, shouldShowKeyboard: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Ты — AI-ассистент с долговременной памятью. Твоя задача:

1. Анализируй разговор и выявляй персонажей (людей), события и темы.
2. Запоминай факты о каждом персонаже, событии и теме.
3. При упоминании персонажа используй накопленные знания о нём.
4. Будь естественным и дружелюбным.
5. Если видишь вопрос, на который можно ответить кратко (да/нет/возможно), укажи это в ответе фразой [SHOW_KEYBOARD].

Текущая база знаний:
${JSON.stringify(kb, null, 2)}

Когда пользователь упоминает нового человека или событие, извлекай информацию и сохраняй её в контексте.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'Извините, не могу ответить.';

    await updateKnowledgeBase(supabase, userId, kb, messages, aiResponse);

    const shouldShowKeyboard = aiResponse.includes('[SHOW_KEYBOARD]');
    const cleanResponse = aiResponse.replace('[SHOW_KEYBOARD]', '').trim();

    return new Response(
      JSON.stringify({ response: cleanResponse, shouldShowKeyboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in chat-ai function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function loadKnowledgeBase(supabase: any, userId: string): Promise<KnowledgeBase> {
  const kb: KnowledgeBase = {
    characters: {},
    events: {},
    topics: {},
  };

  // Load characters
  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId);

  if (characters) {
    characters.forEach((char: any) => {
      kb.characters[char.name] = {
        name: char.name,
        mentions: char.mentions,
        facts: char.facts || [],
      };
    });
  }

  // Load events
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId);

  if (events) {
    events.forEach((evt: any) => {
      kb.events[evt.name] = {
        name: evt.name,
        mentions: evt.mentions,
        details: evt.details || [],
      };
    });
  }

  // Load topics
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', userId);

  if (topics) {
    topics.forEach((topic: any) => {
      kb.topics[topic.name] = {
        name: topic.name,
        mentions: topic.mentions,
        info: topic.info || [],
      };
    });
  }

  return kb;
}

async function updateKnowledgeBase(
  supabase: any,
  userId: string,
  kb: KnowledgeBase,
  messages: Message[],
  aiResponse: string
) {
  const lastUserMessage = messages[messages.length - 1]?.content || '';
  const text = lastUserMessage + ' ' + aiResponse;

  const namePattern = /([А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+)?)/g;
  const names = text.match(namePattern) || [];
  
  for (const name of names) {
    if (name.length > 2 && !['Да', 'Нет', 'Возможно', 'Привет'].includes(name)) {
      if (!kb.characters[name]) {
        kb.characters[name] = { name, mentions: 0, facts: [] };
      }
      kb.characters[name].mentions += 1;

      // Upsert to database
      await supabase
        .from('characters')
        .upsert({
          user_id: userId,
          name: name,
          mentions: kb.characters[name].mentions,
          facts: kb.characters[name].facts,
        }, {
          onConflict: 'user_id,name',
        });
    }
  }

  const eventPattern = /(встреча|событие|проект|работа|задача)/gi;
  const events = text.match(eventPattern) || [];
  
  for (const event of events) {
    const eventLower = event.toLowerCase();
    if (!kb.events[eventLower]) {
      kb.events[eventLower] = { name: eventLower, mentions: 0, details: [] };
    }
    kb.events[eventLower].mentions += 1;

    // Upsert to database
    await supabase
      .from('events')
      .upsert({
        user_id: userId,
        name: eventLower,
        mentions: kb.events[eventLower].mentions,
        details: kb.events[eventLower].details,
      }, {
        onConflict: 'user_id,name',
      });
  }
}

function generateSummary(kb: KnowledgeBase, target: string): string {
  if (target === 'all') {
    const charCount = Object.keys(kb.characters).length;
    const eventCount = Object.keys(kb.events).length;
    return `📊 Общая статистика:\n\n` +
           `👥 Персонажей: ${charCount}\n` +
           `📅 События: ${eventCount}\n\n` +
           `Используй /summary [имя] для подробностей.`;
  }

  if (kb.characters[target]) {
    const char = kb.characters[target];
    return `👤 ${target}\n\n` +
           `Упоминаний: ${char.mentions}\n` +
           `Факты: ${char.facts.length > 0 ? char.facts.join(', ') : 'Пока нет фактов'}`;
  }

  return `Информации о "${target}" не найдено. Попробуй /summary all`;
}

function generateFacts(kb: KnowledgeBase, target: string): string {
  if (target === 'all') {
    let result = '📝 Все факты:\n\n';
    Object.entries(kb.characters).forEach(([name, data]) => {
      if (data.facts.length > 0) {
        result += `${name}: ${data.facts.join(', ')}\n`;
      }
    });
    return result || 'Фактов пока нет.';
  }

  if (kb.characters[target]) {
    const facts = kb.characters[target].facts;
    return facts.length > 0 
      ? `Факты о ${target}:\n${facts.join('\n')}`
      : `Фактов о ${target} пока нет.`;
  }

  return `Информации о "${target}" не найдено.`;
}
