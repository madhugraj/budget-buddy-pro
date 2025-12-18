import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Shield, ChartBar } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Society Management Portal
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive financial management system for your residential society. 
            Track expenses, manage budgets, and maintain transparent records.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="text-center pb-2">
              <ChartBar className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle className="text-lg">Financial Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Comprehensive income, expense, and GST reports
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="text-center pb-2">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle className="text-lg">CAM Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Track common area maintenance payments
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="text-center pb-2">
              <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle className="text-lg">Secure Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Role-based access for transparency
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sign In Section */}
      <div className="border-t border-border bg-muted/30 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-8">Sign In to Continue</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Operations Sign In */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>Operations Sign In</CardTitle>
                <CardDescription>
                  For Treasurer, Accountant, Lead & Office Staff
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate('/auth')}
                >
                  Operations Login
                </Button>
              </CardContent>
            </Card>

            {/* MC Sign In */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <Users className="h-10 w-10 text-primary mx-auto mb-2" />
                <CardTitle>MC Sign In</CardTitle>
                <CardDescription>
                  For Management Committee Members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate('/mc-auth')}
                >
                  MC Login
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/mc-register')}
                >
                  Register as MC
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;