import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Shield, Users, ArrowRight, Building2, FileText, BarChart3 } from 'lucide-react';


const Index = () => {
  const navigate = useNavigate();
  /* Removed auto-redirect logic to allow users to stay on landing page after logout */

  return (
    <div className="min-h-screen flex flex-col relative text-foreground overflow-hidden">
      {/* Background Image Wrapper */}
      <div
        className="fixed inset-0 z-[-50] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background-image.jpg')" }}
      />
      {/* Overlay */}
      <div className="fixed inset-0 z-[-40] bg-black/50 backdrop-blur-[2px]" />

      {/* Main Content - Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-5xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-white drop-shadow-2xl">
              Prestige Bella Vista
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-light drop-shadow-lg max-w-2xl mx-auto">
              Financial Management & Transparency Portal
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 transition-colors duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="p-2 bg-white/10 rounded-lg w-fit">
                  <BarChart3 className="h-6 w-6 text-blue-300" />
                </div>
                <h3 className="font-semibold text-lg">Financial Reports</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  View detailed income and expense reports with complete transparency and real-time updates.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 transition-colors duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="p-2 bg-white/10 rounded-lg w-fit">
                  <Building2 className="h-6 w-6 text-emerald-300" />
                </div>
                <h3 className="font-semibold text-lg">CAM Tracking</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Monitor tower-wise Common Area Maintenance collection status and pending dues efficiently.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 transition-colors duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="p-2 bg-white/10 rounded-lg w-fit">
                  <FileText className="h-6 w-6 text-amber-300" />
                </div>
                <h3 className="font-semibold text-lg">Digital Records</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Access verified financial statements, audit records, and downloadable reports secure in one place.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sign In Footer */}
      <div className="border-t border-white/10 bg-black/60 backdrop-blur-md py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-10 text-white tracking-wide">Select Your Access Portal</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Operations Sign In */}
            <Card
              className="hover:scale-105 transition-all duration-300 cursor-pointer bg-white/95 hover:bg-white border-none shadow-2xl group relative overflow-hidden"
              onClick={() => navigate('/auth')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center gap-5 py-6">
                <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Operations Team</CardTitle>
                  <CardDescription className="text-muted-foreground">Admin, Treasurer & Staff Login</CardDescription>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              </CardHeader>
            </Card>

            {/* MC Sign In */}
            <Card
              className="hover:scale-105 transition-all duration-300 cursor-pointer bg-white/95 hover:bg-white border-none shadow-2xl group relative overflow-hidden"
              onClick={() => navigate('/mc-auth')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center gap-5 py-6">
                <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Management Committee</CardTitle>
                  <CardDescription className="text-muted-foreground">MC Member Login & Registration</CardDescription>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              </CardHeader>
            </Card>
          </div>

          <div className="text-center mt-8">
            <p className="text-white/60 text-sm mb-2">Not registered yet?</p>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white hover:text-black transition-all"
              onClick={() => navigate('/mc-register')}
            >
              Register as New MC Member
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;