-- Create relationships table for character connections
CREATE TABLE public.relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  from_character_id uuid NOT NULL,
  to_character_id uuid NOT NULL,
  relationship_type text NOT NULL,
  description text,
  strength integer DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fk_from_character FOREIGN KEY (from_character_id) REFERENCES public.characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_to_character FOREIGN KEY (to_character_id) REFERENCES public.characters(id) ON DELETE CASCADE,
  CONSTRAINT unique_relationship UNIQUE (user_id, from_character_id, to_character_id, relationship_type)
);

-- Enable RLS
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own relationships"
ON public.relationships FOR SELECT
USING (user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text));

CREATE POLICY "Users can insert their own relationships"
ON public.relationships FOR INSERT
WITH CHECK (user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text));

CREATE POLICY "Users can update their own relationships"
ON public.relationships FOR UPDATE
USING (user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text));

CREATE POLICY "Users can delete their own relationships"
ON public.relationships FOR DELETE
USING (user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text));

-- Create indexes
CREATE INDEX idx_relationships_user_id ON public.relationships(user_id);
CREATE INDEX idx_relationships_from_character ON public.relationships(from_character_id);
CREATE INDEX idx_relationships_to_character ON public.relationships(to_character_id);

-- Add trigger for updated_at
CREATE TRIGGER update_relationships_updated_at
BEFORE UPDATE ON public.relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add active_character_id to track current chat mode
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS personality text;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS speaking_style text;