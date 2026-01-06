import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, X, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function StaffAIChatbot() {
  const { user, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getRoleContext = () => {
    switch (userRole) {
      case 'accountant':
        return 'You are helping an Accountant. They can query about expenses, income entries, budget items, and verify their entries.';
      case 'treasurer':
        return 'You are helping the Treasurer/Admin. They have full access to all financial data, approvals, and system management.';
      case 'lead':
        return 'You are helping a Lead. They can query about CAM tracking, petty cash, and general reports.';
      default:
        return 'You are helping a staff member with general queries about the expense management system.';
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('staff-ai-chat', {
        body: {
          message: userMessage,
          userId: user?.id,
          userRole: userRole,
          roleContext: getRoleContext(),
          history: messages.slice(-10),
        },
      });

      if (response.error) throw response.error;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.data.reply },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSampleQuestions = () => {
    switch (userRole) {
      case 'accountant':
        return [
          'Did I record income for Club House in December?',
          'What is the total expense for Lifts this year?',
          'Show pending expense approvals',
        ];
      case 'treasurer':
        return [
          'What is the total budget utilization?',
          'Show CAM collection summary',
          'List all pending approvals',
        ];
      case 'lead':
        return [
          'What is the CAM collection status?',
          'Show petty cash summary',
          'List pending CAM submissions',
        ];
      default:
        return [
          'What is the budget status?',
          'Show recent expenses',
        ];
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-background border rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-primary text-primary-foreground rounded-t-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs opacity-80 capitalize">{userRole} Mode</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center text-muted-foreground text-sm">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Hi! I can help you with:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>• Query expenses, income, and budgets</li>
                    <li>• Check entry status</li>
                    <li>• Send messages to team members</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  {getSampleQuestions().map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(q);
                      }}
                      className="block w-full text-left text-xs p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={isLoading}
            />
            <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
