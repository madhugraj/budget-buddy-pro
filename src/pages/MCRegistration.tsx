import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Upload, User, Phone, Mail, Building, Home, Check } from 'lucide-react';

const INTEREST_GROUPS = [
  'Finance',
  'Vendor Management',
  'Grievance/Discipline',
  'Cultural and Events',
  'Sports',
  'House Keeping',
  'Traffic and Regulations',
  'Safety & Security',
  'Communications',
  'Website & IT Infrastructure',
  'Others'
];

export default function MCRegistration() {
  const [name, setName] = useState('');
  const [towerNo, setTowerNo] = useState('');
  const [unitNo, setUnitNo] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Photo must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !towerNo || !unitNo || !contactNumber || !email) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!photoFile) {
      toast({
        title: 'Photo Required',
        description: 'Please upload your photograph.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedInterests.length === 0) {
      toast({
        title: 'Select Interests',
        description: 'Please select at least one interest group.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Upload photo first
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${Date.now()}_${name.replace(/\s+/g, '_')}.${fileExt}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('mc-photos')
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('mc-photos')
        .getPublicUrl(fileName);

      // Insert MC user record
      const { error: insertError } = await supabase
        .from('mc_users')
        .insert({
          name,
          tower_no: towerNo,
          unit_no: unitNo,
          contact_number: contactNumber,
          email,
          photo_url: publicUrl,
          interest_groups: selectedInterests,
          status: 'pending'
        });

      if (insertError) {
        // If insert fails, try to clean up the uploaded photo
        await supabase.storage.from('mc-photos').remove([fileName]);
        throw insertError;
      }

      toast({
        title: 'Registration Submitted',
        description: 'Your registration has been submitted for approval. You will receive an email once approved.',
      });

      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'An error occurred during registration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <CardTitle className="text-2xl font-bold text-center">MC Registration</CardTitle>
          <CardDescription className="text-center">
            Register as a Management Committee member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-dashed border-muted-foreground/30">
                    <User className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="photo" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Photo *
                  </div>
                </Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Personal Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="towerNo">Tower No *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="towerNo"
                    placeholder="e.g., 15"
                    value={towerNo}
                    onChange={(e) => setTowerNo(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitNo">Unit No *</Label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="unitNo"
                    placeholder="e.g., 181512"
                    value={unitNo}
                    onChange={(e) => setUnitNo(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact">Contact Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Interest Groups */}
            <div className="space-y-4">
              <Label>Interest Groups * (Select at least one)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTEREST_GROUPS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <div
                      key={interest}
                      className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border hover:bg-muted'
                        }`}
                      onClick={() => toggleInterest(interest)}
                    >
                      <div
                        className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-primary'
                          }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm">{interest}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Registration
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              After approval, you will receive login credentials at your registered email.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}