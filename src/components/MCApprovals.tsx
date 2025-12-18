import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface MCUser {
  id: string;
  name: string;
  email: string;
  tower_no: string;
  unit_no: string;
  contact_number: string;
  photo_url: string;
  interest_groups: string[];
  status: string;
  created_at: string;
}

export default function MCApprovals() {
  const [pendingMC, setPendingMC] = useState<MCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMC, setSelectedMC] = useState<MCUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingMC();
  }, []);

  const loadPendingMC = async () => {
    try {
      const { data, error } = await supabase
        .from('mc_users')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingMC(data || []);
    } catch (error: any) {
      console.error('Error loading MC users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending MC registrations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mcUser: MCUser) => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-mc-user', {
        body: { mc_user_id: mcUser.id, action: 'approve' }
      });

      if (error) throw error;

      toast({
        title: 'MC User Approved',
        description: `${mcUser.name} has been approved. Login credentials sent to their email.`,
      });

      loadPendingMC();
      setSelectedMC(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve MC user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedMC) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-mc-user', {
        body: { 
          mc_user_id: selectedMC.id, 
          action: 'reject',
          rejection_reason: rejectionReason 
        }
      });

      if (error) throw error;

      toast({
        title: 'MC Registration Rejected',
        description: `${selectedMC.name}'s registration has been rejected.`,
      });

      loadPendingMC();
      setSelectedMC(null);
      setShowRejectDialog(false);
      setRejectionReason('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject MC user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending MC Registrations</CardTitle>
          <CardDescription>Review and approve Management Committee member registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingMC.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending MC registrations
            </div>
          ) : (
            <div className="space-y-4">
              {pendingMC.map((mc) => (
                <div
                  key={mc.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={mc.photo_url} alt={mc.name} />
                    <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold">{mc.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Tower {mc.tower_no}, Unit {mc.unit_no} • {mc.email}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mc.interest_groups.slice(0, 3).map((group) => (
                        <Badge key={group} variant="outline" className="text-xs">
                          {group}
                        </Badge>
                      ))}
                      {mc.interest_groups.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{mc.interest_groups.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMC(mc)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedMC(mc);
                        setShowRejectDialog(true);
                      }}
                      disabled={processing}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(mc)}
                      disabled={processing}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!selectedMC && !showRejectDialog} onOpenChange={(open) => !open && setSelectedMC(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>MC Registration Details</DialogTitle>
          </DialogHeader>
          {selectedMC && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={selectedMC.photo_url} alt={selectedMC.name} />
                  <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                </Avatar>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <div className="font-medium">{selectedMC.name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact</Label>
                  <div className="font-medium">{selectedMC.contact_number}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="font-medium">{selectedMC.email}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <div className="font-medium">Tower {selectedMC.tower_no}, Unit {selectedMC.unit_no}</div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Interest Groups</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedMC.interest_groups.map((group) => (
                    <Badge key={group} variant="secondary" className="text-xs">
                      {group}
                    </Badge>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                >
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedMC)} disabled={processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject MC Registration</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedMC?.name}'s registration.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}