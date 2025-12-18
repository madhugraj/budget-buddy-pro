import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { LogOut, FileText, Building, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MCUser {
  id: string;
  name: string;
  email: string;
  tower_no: string;
  unit_no: string;
  interest_groups: string[];
  photo_url: string;
}

export default function MCDashboard() {
  const [mcUser, setMcUser] = useState<MCUser | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for MC session
    const storedUser = localStorage.getItem('mc_user');
    if (!storedUser) {
      navigate('/mc-auth');
      return;
    }
    setMcUser(JSON.parse(storedUser));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('mc_user');
    toast({
      title: 'Logged Out',
      description: 'You have been logged out successfully.',
    });
    navigate('/');
  };

  if (!mcUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={mcUser.photo_url} alt={mcUser.name} />
              <AvatarFallback>{mcUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold">{mcUser.name}</h1>
              <p className="text-sm text-muted-foreground">
                Tower {mcUser.tower_no}, Unit {mcUser.unit_no}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="cam">
              <Building className="h-4 w-4 mr-2" />
              CAM & Facility
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Reports</CardTitle>
                <CardDescription>
                  View society's financial reports and statements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Income Report</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View income from various sources
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Expense Report</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View society expenses breakdown
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">GST Report</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View GST collected and paid
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cam" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>CAM & Facility Management</CardTitle>
                <CardDescription>
                  View CAM collection status and facility information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">CAM Collection Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View tower-wise CAM collection status
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Facility Updates</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View facility maintenance updates
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Profile Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{mcUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">Tower {mcUser.tower_no}, Unit {mcUser.unit_no}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Interest Groups</p>
                <div className="flex flex-wrap gap-2">
                  {mcUser.interest_groups.map((group) => (
                    <span
                      key={group}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {group}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}