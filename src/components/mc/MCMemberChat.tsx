import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Plus, Users, ArrowLeft, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MCUser {
  id: string;
  name: string;
  email: string;
  tower_no: string;
  unit_no: string;
  photo_url: string;
}

interface ChatRoom {
  room_id: string;
  room_name: string | null;
  room_type: 'dm' | 'group';
  members: MCUser[];
  lastMessage?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: MCUser;
}

interface OnlineUser {
  user_id: string;
  is_online: boolean;
}

interface MCMemberChatProps {
  currentUser: MCUser;
}

export function MCMemberChat({ currentUser }: MCMemberChatProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [allMembers, setAllMembers] = useState<MCUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch all MC members
  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('mc_users')
        .select('id, name, email, tower_no, unit_no, photo_url')
        .eq('status', 'approved')
        .neq('id', currentUser.id);

      if (!error && data) {
        setAllMembers(data);
      }
    };
    fetchMembers();
  }, [currentUser.id]);

  // Track presence
  useEffect(() => {
    const updatePresence = async () => {
      await supabase.from('mc_presence').upsert({
        user_id: currentUser.id,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
    };
    updatePresence();

    // Fetch online users
    const fetchOnline = async () => {
      const { data } = await supabase
        .from('mc_presence')
        .select('user_id, is_online')
        .eq('is_online', true);
      
      if (data) {
        setOnlineUsers(new Set(data.map((u) => u.user_id)));
      }
    };
    fetchOnline();

    // Subscribe to presence changes
    const presenceChannel = supabase
      .channel('mc-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mc_presence' }, (payload) => {
        const data = payload.new as OnlineUser;
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (data.is_online) {
            next.add(data.user_id);
          } else {
            next.delete(data.user_id);
          }
          return next;
        });
      })
      .subscribe();

    // Set offline on unmount
    return () => {
      supabase.from('mc_presence').update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('user_id', currentUser.id);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser.id]);

  // Fetch user's rooms
  useEffect(() => {
    const fetchRooms = async () => {
      const { data: memberData } = await supabase
        .from('mc_chat_room_members')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (!memberData?.length) return;

      const roomIds = memberData.map((m) => m.room_id);
      
      const { data: roomData } = await supabase
        .from('mc_chat_rooms')
        .select('*')
        .in('room_id', roomIds);

      if (roomData) {
        // Get members for each room
        const roomsWithMembers = await Promise.all(
          roomData.map(async (room) => {
            const { data: members } = await supabase
              .from('mc_chat_room_members')
              .select('user_id')
              .eq('room_id', room.room_id);

            const memberIds = members?.map((m) => m.user_id) || [];
            const { data: memberDetails } = await supabase
              .from('mc_users')
              .select('id, name, email, tower_no, unit_no, photo_url')
              .in('id', memberIds);

            return {
              room_id: room.room_id,
              room_name: room.room_name,
              room_type: room.room_type as 'dm' | 'group',
              members: memberDetails || [],
            };
          })
        );
        setRooms(roomsWithMembers);
      }
    };
    fetchRooms();
  }, [currentUser.id]);

  // Fetch messages for selected room
  useEffect(() => {
    if (!selectedRoom) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('mc_chat_messages')
        .select('*')
        .eq('room_id', selectedRoom.room_id)
        .order('created_at', { ascending: true });

      if (data) {
        const messagesWithSenders = data.map((msg) => ({
          ...msg,
          sender: allMembers.find((m) => m.id === msg.sender_id) || 
            (msg.sender_id === currentUser.id ? currentUser : undefined),
        }));
        setMessages(messagesWithSenders);
      }
    };
    fetchMessages();

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`room-${selectedRoom.room_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mc_chat_messages',
        filter: `room_id=eq.${selectedRoom.room_id}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        newMsg.sender = allMembers.find((m) => m.id === newMsg.sender_id) ||
          (newMsg.sender_id === currentUser.id ? currentUser : undefined);
        setMessages((prev) => [...prev, newMsg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [selectedRoom, allMembers, currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startDM = async (member: MCUser) => {
    // Check if DM already exists
    const dmRoomId = [currentUser.id, member.id].sort().join('_');
    const existingRoom = rooms.find((r) => r.room_id === `dm_${dmRoomId}`);
    
    if (existingRoom) {
      setSelectedRoom(existingRoom);
      return;
    }

    // Create new DM room
    const roomId = `dm_${dmRoomId}`;
    await supabase.from('mc_chat_rooms').insert({
      room_id: roomId,
      room_type: 'dm',
      created_by: currentUser.id,
    });

    await supabase.from('mc_chat_room_members').insert([
      { room_id: roomId, user_id: currentUser.id },
      { room_id: roomId, user_id: member.id },
    ]);

    const newRoom: ChatRoom = {
      room_id: roomId,
      room_name: null,
      room_type: 'dm',
      members: [member, currentUser],
    };

    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoom(newRoom);
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length < 1) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter group name and select members' });
      return;
    }

    const roomId = `group_${Date.now()}`;
    await supabase.from('mc_chat_rooms').insert({
      room_id: roomId,
      room_name: newGroupName.trim(),
      room_type: 'group',
      created_by: currentUser.id,
    });

    await supabase.from('mc_chat_room_members').insert([
      { room_id: roomId, user_id: currentUser.id },
      ...selectedMembers.map((id) => ({ room_id: roomId, user_id: id })),
    ]);

    const members = allMembers.filter((m) => selectedMembers.includes(m.id));
    const newRoom: ChatRoom = {
      room_id: roomId,
      room_name: newGroupName.trim(),
      room_type: 'group',
      members: [...members, currentUser],
    };

    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoom(newRoom);
    setIsCreatingRoom(false);
    setNewGroupName('');
    setSelectedMembers([]);
    toast({ title: 'Group Created', description: `${newGroupName} has been created` });
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedRoom) return;

    const { error } = await supabase.from('mc_chat_messages').insert({
      sender_id: currentUser.id,
      room_id: selectedRoom.room_id,
      content: input.trim(),
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message' });
    } else {
      setInput('');
    }
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.room_type === 'group') return room.room_name;
    const otherMember = room.members.find((m) => m.id !== currentUser.id);
    return otherMember?.name || 'Unknown';
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.room_type === 'group') return null;
    const otherMember = room.members.find((m) => m.id !== currentUser.id);
    return otherMember?.photo_url;
  };

  if (selectedRoom) {
    return (
      <div className="flex flex-col h-full">
        {/* Room Header */}
        <div className="p-3 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRoom(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={getRoomAvatar(selectedRoom) || undefined} />
            <AvatarFallback>
              {selectedRoom.room_type === 'group' ? <Users className="h-4 w-4" /> : getRoomDisplayName(selectedRoom)?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{getRoomDisplayName(selectedRoom)}</p>
            <p className="text-xs text-muted-foreground">
              {selectedRoom.room_type === 'group' 
                ? `${selectedRoom.members.length} members`
                : onlineUsers.has(selectedRoom.members.find(m => m.id !== currentUser.id)?.id || '') 
                  ? 'Online' 
                  : 'Offline'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender_id !== currentUser.id && (
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={msg.sender?.photo_url} />
                    <AvatarFallback>{msg.sender?.name?.[0]}</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.sender_id === currentUser.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {selectedRoom.room_type === 'group' && msg.sender_id !== currentUser.id && (
                    <p className="text-[10px] font-medium opacity-70 mb-1">{msg.sender?.name}</p>
                  )}
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[10px] opacity-60 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="p-3 border-b flex items-center justify-between">
        <p className="text-sm font-medium">Conversations</p>
        <Dialog open={isCreatingRoom} onOpenChange={setIsCreatingRoom}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="h-4 w-4" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Group Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Select members:</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {allMembers.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers((prev) => [...prev, member.id]);
                          } else {
                            setSelectedMembers((prev) => prev.filter((id) => id !== member.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{member.name} (T{member.tower_no})</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={createGroup} className="w-full">Create Group</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Online Members */}
      <div className="p-3 border-b">
        <p className="text-xs text-muted-foreground mb-2">Online Now ({onlineUsers.size})</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allMembers.filter((m) => onlineUsers.has(m.id)).map((member) => (
            <button
              key={member.id}
              onClick={() => startDM(member)}
              className="flex flex-col items-center gap-1 p-1 hover:bg-muted rounded-lg min-w-[60px]"
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.photo_url} />
                  <AvatarFallback>{member.name[0]}</AvatarFallback>
                </Avatar>
                <Circle className="h-3 w-3 text-green-500 fill-green-500 absolute bottom-0 right-0" />
              </div>
              <span className="text-[10px] truncate w-full text-center">{member.name.split(' ')[0]}</span>
            </button>
          ))}
          {onlineUsers.size === 0 && (
            <p className="text-xs text-muted-foreground">No members online</p>
          )}
        </div>
      </div>

      {/* Rooms List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {rooms.map((room) => (
            <button
              key={room.room_id}
              onClick={() => setSelectedRoom(room)}
              className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={getRoomAvatar(room) || undefined} />
                <AvatarFallback>
                  {room.room_type === 'group' ? <Users className="h-4 w-4" /> : getRoomDisplayName(room)?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{getRoomDisplayName(room)}</p>
                <p className="text-xs text-muted-foreground">
                  {room.room_type === 'group' ? `${room.members.length} members` : `Tower ${room.members.find(m => m.id !== currentUser.id)?.tower_no}`}
                </p>
              </div>
              {room.room_type === 'group' && (
                <Badge variant="secondary" className="text-[10px]">Group</Badge>
              )}
            </button>
          ))}
          {rooms.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a DM with an online member!</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* All Members */}
      <div className="p-3 border-t">
        <p className="text-xs text-muted-foreground mb-2">All Members</p>
        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
          {allMembers.slice(0, 6).map((member) => (
            <button
              key={member.id}
              onClick={() => startDM(member)}
              className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-left"
            >
              <div className="relative">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={member.photo_url} />
                  <AvatarFallback className="text-[10px]">{member.name[0]}</AvatarFallback>
                </Avatar>
                {onlineUsers.has(member.id) && (
                  <Circle className="h-2 w-2 text-green-500 fill-green-500 absolute bottom-0 right-0" />
                )}
              </div>
              <span className="text-xs truncate">{member.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
