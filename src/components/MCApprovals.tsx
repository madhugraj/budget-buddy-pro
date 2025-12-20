import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download, Loader2, CheckCircle, XCircle, User, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  login_username?: string;
  temp_password?: string;
}

export default function MCApprovals() {
  const [pendingMC, setPendingMC] = useState<MCUser[]>([]);
  const [approvedMC, setApprovedMC] = useState<MCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMC, setSelectedMC] = useState<MCUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadPendingMC(), loadApprovedMC()]);
    setLoading(false);
  };

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
      console.error('Error loading pending MC users:', error);
    }
  };

  const loadApprovedMC = async () => {
    try {
      const { data, error } = await supabase
        .from('mc_users')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApprovedMC(data || []);
    } catch (error: any) {
      console.error('Error loading approved MC users:', error);
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
        description: `${mcUser.name} has been approved. Credentials generated.`,
      });

      loadData();
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

      loadData();
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

  const handleDeleteMC = async (mcUser: MCUser) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete MC user "${mcUser.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('mc_users')
        .delete()
        .eq('id', mcUser.id);

      if (error) throw error;

      toast({
        title: 'User Deleted',
        description: `MC user ${mcUser.name} has been permanently removed.`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete MC user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const downloadApprovedUsers = () => {
    if (approvedMC.length === 0) {
      toast({
        title: 'No data to download',
        description: 'There are no approved MC members at the moment.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = approvedMC.map(user => ({
      'Name': user.name,
      'Tower No': user.tower_no,
      'Unit No': user.unit_no,
      'Login ID': user.login_username || 'Not set',
      'Temp Password': user.temp_password || '---'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Approved MC Users');
    XLSX.writeFile(wb, `MC_Approved_Users_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Download Started',
      description: 'The approved MC users list is being downloaded.',
    });
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
      <div className="flex flex-col gap-6">
        {/* Email Policy Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          <p className="font-semibold mb-1">Important: Email Delivery Status</p>
          <p>
            Currently, automated emails (credentials & password resets) are only delivered to the administration's verified email address due to Resend's onboarding restrictions.
          </p>
          <p className="mt-1 font-medium">To fix this: Please verify your domain in the Resend dashboard and update the "from" address in Supabase Edge Functions.</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="pending">Pending ({pendingMC.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvedMC.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Registrations</CardTitle>
                <CardDescription>Review and approve member requests</CardDescription>
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
                          <Button variant="outline" size="sm" onClick={() => setSelectedMC(mc)}>View</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setSelectedMC(mc); setShowRejectDialog(true); }}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(mc)} disabled={processing}>
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
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Approved Members</CardTitle>
                    <CardDescription>View credentials and manage member access</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadApprovedUsers}>
                    <Download className="h-4 w-4 mr-2" />
                    Download List
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {approvedMC.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No approved MC members
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approvedMC.map((mc) => (
                      <div
                        key={mc.id}
                        className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg bg-card"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={mc.photo_url} alt={mc.name} />
                          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{mc.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{mc.email}</div>
                        </div>

                        <div className="flex flex-col gap-1 flex-1">
                          <div className="text-xs text-muted-foreground">Login Username:</div>
                          <div className="text-sm font-mono bg-muted px-2 py-1 rounded select-all truncate">
                            {mc.login_username || 'Not set'}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 flex-1">
                          <div className="text-xs text-muted-foreground">Temp Password:</div>
                          <div className="text-sm font-mono bg-muted px-2 py-1 rounded select-all truncate">
                            {mc.temp_password || '---'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                setProcessing(true);
                                const { error } = await supabase.functions.invoke('mc-forgot-password', {
                                  body: { email: mc.email }
                                });
                                if (error) throw error;
                                toast({ title: 'Success', description: 'Temporary password reset successfully.' });
                                loadApprovedMC();
                              } catch (err: any) {
                                toast({ title: 'Error', description: err.message, variant: 'destructive' });
                              } finally {
                                setProcessing(false);
                              }
                            }}
                            disabled={processing}
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteMC(mc)}
                            disabled={processing}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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