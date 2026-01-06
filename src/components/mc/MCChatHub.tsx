import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Users, MessageCircle } from 'lucide-react';
import { MCAIChatbot } from './MCAIChatbot';
import { MCMemberChat } from './MCMemberChat';

interface MCUser {
  id: string;
  name: string;
  email: string;
  tower_no: string;
  unit_no: string;
  interest_groups: string[];
  photo_url: string;
}

interface MCChatHubProps {
  currentUser: MCUser;
}

export function MCChatHub({ currentUser }: MCChatHubProps) {
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Chat Hub
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs defaultValue="ai" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="h-4 w-4" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ai" className="flex-1 m-0 overflow-hidden">
            <MCAIChatbot currentUser={currentUser} />
          </TabsContent>
          
          <TabsContent value="members" className="flex-1 m-0 overflow-hidden">
            <MCMemberChat currentUser={currentUser} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
