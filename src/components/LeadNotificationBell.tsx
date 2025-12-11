import { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function LeadNotificationBell() {
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (userRole === 'lead' && user) {
      loadNotifications();
      
      // Poll every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole, user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'cam_reminder' || notification.type === 'data_discrepancy') {
      // Navigate to CAM Tracking with discrepancy tab selected
      navigate('/cam-tracking?tab=discrepancies');
    }
    setIsOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Only show for lead
  if (userRole !== 'lead') {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Notifications</div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      notification.is_read 
                        ? 'bg-background hover:bg-muted' 
                        : 'bg-primary/10 hover:bg-primary/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{notification.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(notification.created_at)}
                        </div>
                      </div>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}