-- Create chat messages table for MC-to-MC communication
CREATE TABLE public.mc_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.mc_users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL, -- 'dm_user1_user2' for DMs or 'group_xxxxx' for groups
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'system', 'ai_response'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat rooms table for group discussions
CREATE TABLE public.mc_chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  room_name TEXT, -- Only for groups
  room_type TEXT NOT NULL DEFAULT 'dm', -- 'dm' or 'group'
  created_by UUID REFERENCES public.mc_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room members table
CREATE TABLE public.mc_chat_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.mc_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create presence tracking table
CREATE TABLE public.mc_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.mc_users(id) ON DELETE CASCADE UNIQUE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI chat history table for the chatbot
CREATE TABLE public.mc_ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.mc_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.mc_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for mc_chat_messages (MC users can read/write messages in rooms they belong to)
CREATE POLICY "MC users can read messages in their rooms"
ON public.mc_chat_messages
FOR SELECT
USING (
  room_id IN (
    SELECT rm.room_id FROM public.mc_chat_room_members rm
    WHERE rm.user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
  )
);

CREATE POLICY "MC users can insert messages"
ON public.mc_chat_messages
FOR INSERT
WITH CHECK (
  sender_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

-- RLS policies for mc_chat_rooms
CREATE POLICY "MC users can read rooms they belong to"
ON public.mc_chat_rooms
FOR SELECT
USING (
  room_id IN (
    SELECT rm.room_id FROM public.mc_chat_room_members rm
    WHERE rm.user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
  )
);

CREATE POLICY "MC users can create rooms"
ON public.mc_chat_rooms
FOR INSERT
WITH CHECK (
  created_by IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

-- RLS policies for mc_chat_room_members
CREATE POLICY "MC users can read room members"
ON public.mc_chat_room_members
FOR SELECT
USING (true);

CREATE POLICY "MC users can join rooms"
ON public.mc_chat_room_members
FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

CREATE POLICY "MC users can leave rooms"
ON public.mc_chat_room_members
FOR DELETE
USING (
  user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

-- RLS policies for mc_presence
CREATE POLICY "Anyone can read presence"
ON public.mc_presence
FOR SELECT
USING (true);

CREATE POLICY "MC users can update their presence"
ON public.mc_presence
FOR ALL
USING (
  user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

-- RLS policies for mc_ai_chat_history
CREATE POLICY "MC users can read their AI chat history"
ON public.mc_ai_chat_history
FOR SELECT
USING (
  user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

CREATE POLICY "MC users can insert AI chat messages"
ON public.mc_ai_chat_history
FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.mc_users WHERE status = 'approved')
);

-- Enable realtime for chat messages and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_presence;

-- Create indexes for performance
CREATE INDEX idx_mc_chat_messages_room ON public.mc_chat_messages(room_id);
CREATE INDEX idx_mc_chat_messages_created ON public.mc_chat_messages(created_at DESC);
CREATE INDEX idx_mc_chat_room_members_room ON public.mc_chat_room_members(room_id);
CREATE INDEX idx_mc_chat_room_members_user ON public.mc_chat_room_members(user_id);
CREATE INDEX idx_mc_ai_chat_history_user ON public.mc_ai_chat_history(user_id);
CREATE INDEX idx_mc_presence_user ON public.mc_presence(user_id);