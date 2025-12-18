import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';

const Index = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    // Check for standard operations auth
    if (!loading && session) {
      navigate('/dashboard');
      return;
    }

    // Check for MC auth
    const mcUser = localStorage.getItem('mc_user');
    if (mcUser) {
      navigate('/mc-dashboard');
      return;
    }
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Dashboard View - Public/Landing */}
      <div className="flex-1">
        <Dashboard />
      </div>

      {/* Sign In Footer */}
      <div className="border-t border-border bg-muted/60 backdrop-blur-sm py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl font-semibold text-center mb-6">Portal Access</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Operations Sign In */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-card/60" onClick={() => navigate('/auth')}>
              <CardHeader className="flex flex-row items-center gap-4 py-4">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-base">Operations Team</CardTitle>
                  <CardDescription>Login for Staff & Admin</CardDescription>
                </div>
              </CardHeader>
            </Card>

            {/* MC Sign In */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-card/60" onClick={() => navigate('/mc-auth')}>
              <CardHeader className="flex flex-row items-center gap-4 py-4">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-base">Management Committee</CardTitle>
                  <CardDescription>MC Member Login</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;