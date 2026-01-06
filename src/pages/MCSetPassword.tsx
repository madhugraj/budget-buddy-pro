import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Lock, Eye, EyeOff } from 'lucide-react';

export default function MCSetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [mcUser, setMcUser] = useState<{ id: string; name: string; login_username: string } | null>(null);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setValidating(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mc_users')
        .select('id, name, login_username, password_reset_expires_at, password_hash')
        .eq('password_reset_token', token)
        .eq('status', 'approved')
        .single();

      if (error || !data) {
        setTokenValid(false);
        setValidating(false);
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (data.password_reset_expires_at) {
        const expiryDate = new Date(data.password_reset_expires_at);
        if (expiryDate < new Date()) {
          setTokenValid(false);
          setValidating(false);
          setLoading(false);
          return;
        }
      }

      // Check if password was already set (token already used)
      if (data.password_hash) {
        setTokenValid(false);
        setValidating(false);
        setLoading(false);
        toast({
          title: 'Link Already Used',
          description: 'You have already set your password. Please login with your credentials.',
        });
        navigate('/mc-auth');
        return;
      }

      setMcUser({ id: data.id, name: data.name, login_username: data.login_username || '' });
      setTokenValid(true);
    } catch (err) {
      console.error('Token validation error:', err);
      setTokenValid(false);
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords Do Not Match',
        description: 'Please ensure both passwords are identical.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Call an RPC function to set the password securely
      // @ts-ignore - Function exists in DB but not in generated types yet
      const { data, error } = await supabase.rpc('set_mc_initial_password', {
        p_token: token,
        p_new_password: password
      });

      if (error) throw error;

      if (!data) {
        throw new Error('Failed to set password. Token may be invalid or expired.');
      }

      toast({
        title: '🎉 Password Set Successfully!',
        description: 'You can now login with your username and password.',
      });

      navigate('/mc-auth');
    } catch (err: any) {
      console.error('Set password error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to set password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Invalid Link</h2>
            <p className="text-muted-foreground">
              No password setup token found. Please use the link from your approval email.
            </p>
            <Button onClick={() => navigate('/mc-auth')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Link Expired or Invalid</h2>
            <p className="text-muted-foreground">
              This password setup link has expired or is invalid. Please contact the Treasurer to resend the approval email.
            </p>
            <Button onClick={() => navigate('/mc-auth')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Welcome, <strong>{mcUser?.name}</strong>! Create a secure password for your MC Portal account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Your Username</Label>
              <p className="font-mono text-sm mt-1">{mcUser?.login_username}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Set Password & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
