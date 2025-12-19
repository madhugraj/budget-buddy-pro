import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { LogOut, FileText, Building, User, LayoutDashboard } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Reports from './Reports';
import { ExportCAM } from '@/components/ExportCAM';
import Dashboard from './Dashboard'; // We can use Dashboard component or just the charts

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
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={mcUser.photo_url} alt={mcUser.name} />
              <AvatarFallback className="bg-primary/10 text-primary">{mcUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold text-lg leading-none">{mcUser.name}</h1>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                MC Member • Tower {mcUser.tower_no}, Unit {mcUser.unit_no}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full border border-border text-xs font-semibold">
              <span className="text-muted-foreground">Fiscal Year</span>
              <span className="text-foreground">2025-26</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="cam" className="gap-2">
              <Building className="h-4 w-4" />
              CAM & Facility
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
            {/* Reuse standard dashboard charts */}
            <Dashboard />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6 animate-in fade-in duration-500">
            <Card className="border-none shadow-lg">
              <CardContent className="p-0">
                <Reports />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cam" className="space-y-6 animate-in fade-in duration-500">
            <ExportCAM />
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