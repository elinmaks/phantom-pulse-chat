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

1. Анализируй разговор и выявляй:
   - Персонажей (людей, которых упоминает пользователь)
   - События (встречи, проекты, задачи)
   - Темы (интересы, хобби, предпочтения)

2. Запоминай конкретные факты:
   - О персонажах: имена, должности, отношения, характеристики
   - О событиях: даты, места, участники, детали
   - О темах: предпочтения пользователя, его интересы

3. Используй накопленные знания в разговоре:
   - Вспоминай ранее упомянутые факты
   - Связывай новую информацию с существующей
   - Будь внимательным к деталям

4. Будь естественным, дружелюбным и проявляй эмпатию.

5. Если вопрос предполагает короткий ответ (да/нет/возможно), добавь [SHOW_KEYBOARD].

📊 Текущая база знаний:

${formatKnowledgeBase(kb)}

Используй эти знания активно в разговоре. Вспоминай детали о людях и событиях, которые упоминал пользователь.`;

    // First call: Get AI response and extract knowledge
    const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Извлеки из разговора информацию о персонажах, событиях и темах.' },
          ...messages,
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_knowledge',
            description: 'Извлекает структурированную информацию о персонажах, событиях и темах из разговора',
            parameters: {
              type: 'object',
              properties: {
                characters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Имя персонажа' },
                      facts: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Конкретные факты о персонаже (профессия, отношения, характер)' 
                      }
                    }
                  }
                },
                events: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Название события' },
                      details: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Детали события (дата, место, участники)' 
                      }
                    }
                  }
                },
                topics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Тема или интерес' },
                      info: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Информация о теме (предпочтения, мнения)' 
                      }
                    }
                  }
                }
              }
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_knowledge' } }
      }),
    });

    if (!extractResponse.ok) {
      console.error('Knowledge extraction error:', extractResponse.status);
    } else {
      const extractData = await extractResponse.json();
      const toolCall = extractData.choices[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        try {
          const knowledge = JSON.parse(toolCall.function.arguments);
          await saveExtractedKnowledge(supabase, userId, kb, knowledge);
        } catch (e) {
          console.error('Failed to parse knowledge:', e);
        }
      }
    }

    // Second call: Generate response
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

async function saveExtractedKnowledge(
  supabase: any,
  userId: string,
  kb: KnowledgeBase,
  knowledge: any
) {
  // Save characters with facts
  if (knowledge.characters && Array.isArray(knowledge.characters)) {
    for (const char of knowledge.characters) {
      if (!char.name) continue;
      
      const existing = kb.characters[char.name] || { name: char.name, mentions: 0, facts: [] };
      const newFacts = char.facts || [];
      const allFacts = [...new Set([...existing.facts, ...newFacts])];
      
      kb.characters[char.name] = {
        name: char.name,
        mentions: existing.mentions + 1,
        facts: allFacts
      };

      await supabase
        .from('characters')
        .upsert({
          user_id: userId,
          name: char.name,
          mentions: kb.characters[char.name].mentions,
          facts: kb.characters[char.name].facts,
        }, {
          onConflict: 'user_id,name',
        });
    }
  }

  // Save events with details
  if (knowledge.events && Array.isArray(knowledge.events)) {
    for (const evt of knowledge.events) {
      if (!evt.name) continue;
      
      const eventName = evt.name.toLowerCase();
      const existing = kb.events[eventName] || { name: eventName, mentions: 0, details: [] };
      const newDetails = evt.details || [];
      const allDetails = [...new Set([...existing.details, ...newDetails])];
      
      kb.events[eventName] = {
        name: eventName,
        mentions: existing.mentions + 1,
        details: allDetails
      };

      await supabase
        .from('events')
        .upsert({
          user_id: userId,
          name: eventName,
          mentions: kb.events[eventName].mentions,
          details: kb.events[eventName].details,
        }, {
          onConflict: 'user_id,name',
        });
    }
  }

  // Save topics with info
  if (knowledge.topics && Array.isArray(knowledge.topics)) {
    for (const topic of knowledge.topics) {
      if (!topic.name) continue;
      
      const topicName = topic.name.toLowerCase();
      const existing = kb.topics[topicName] || { name: topicName, mentions: 0, info: [] };
      const newInfo = topic.info || [];
      const allInfo = [...new Set([...existing.info, ...newInfo])];
      
      kb.topics[topicName] = {
        name: topicName,
        mentions: existing.mentions + 1,
        info: allInfo
      };

      await supabase
        .from('topics')
        .upsert({
          user_id: userId,
          name: topicName,
          mentions: kb.topics[topicName].mentions,
          info: kb.topics[topicName].info,
        }, {
          onConflict: 'user_id,name',
        });
    }
  }
}

function formatKnowledgeBase(kb: KnowledgeBase): string {
  let result = '';
  
  const charCount = Object.keys(kb.characters).length;
  const eventCount = Object.keys(kb.events).length;
  const topicCount = Object.keys(kb.topics).length;
  
  if (charCount > 0) {
    result += '👥 Персонажи:\n';
    Object.values(kb.characters).forEach(char => {
      result += `- ${char.name} (упоминаний: ${char.mentions})\n`;
      if (char.facts.length > 0) {
        result += `  Факты: ${char.facts.join(', ')}\n`;
      }
    });
    result += '\n';
  }
  
  if (eventCount > 0) {
    result += '📅 События:\n';
    Object.values(kb.events).forEach(evt => {
      result += `- ${evt.name} (упоминаний: ${evt.mentions})\n`;
      if (evt.details.length > 0) {
        result += `  Детали: ${evt.details.join(', ')}\n`;
      }
    });
    result += '\n';
  }
  
  if (topicCount > 0) {
    result += '💡 Темы:\n';
    Object.values(kb.topics).forEach(topic => {
      result += `- ${topic.name} (упоминаний: ${topic.mentions})\n`;
      if (topic.info.length > 0) {
        result += `  Инфо: ${topic.info.join(', ')}\n`;
      }
    });
    result += '\n';
  }
  
  if (charCount === 0 && eventCount === 0 && topicCount === 0) {
    result = 'База знаний пуста. Начни разговор, чтобы я мог запомнить информацию о тебе!';
  }
  
  return result;
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
