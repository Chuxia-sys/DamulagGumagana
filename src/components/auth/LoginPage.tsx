'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Shield, Users, Calendar, AlertTriangle, UserPlus, LogIn, CheckCircle, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Footer } from '@/components/layout/Footer';

interface Department {
  id: string;
  name: string;
  code: string;
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'checking' | 'seeded' | 'needs-seed'>('idle');

  // Check seed status on mount
  useEffect(() => {
    const checkSeedStatus = async () => {
      try {
        const res = await fetch('/api/seed');
        const data = await res.json();
        setSeedStatus(data.seeded ? 'seeded' : 'needs-seed');
      } catch {
        setSeedStatus('needs-seed');
      }
    };
    checkSeedStatus();
  }, []);

  // Handle seed database
  const handleSeed = async () => {
    setSeedLoading(true);
    setError('');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedStatus('seeded');
        setSuccess('Database seeded! Demo accounts are now available.');
      } else {
        setError(data.error || 'Failed to seed database');
      }
    } catch {
      setError('Failed to seed database');
    } finally {
      setSeedLoading(false);
    }
  };

  // Registration fields
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Fetch departments for registration
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/departments');
        const data = await res.json();
        const departmentsList = Array.isArray(data)
          ? data
          : Array.isArray(data?.departments)
            ? data.departments
            : [];
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        window.location.reload();
      }
    } catch {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          departmentId: departmentId || null,
          phone: phone || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
      } else {
        setSuccess('Account created successfully! You can now sign in.');
        setMode('login');
        // Clear registration fields
        setName('');
        setConfirmPassword('');
        setDepartmentId('');
        setPhone('');
        setPassword('');
      }
    } catch {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccess('');
  };

  const features = [
    { icon: Calendar, title: 'Smart Scheduling', description: 'AI-powered conflict detection' },
    { icon: Users, title: 'Faculty Management', description: 'Track loads and assignments' },
    { icon: Shield, title: 'Role-Based Access', description: 'Secure multi-level permissions' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          
          {/* Decorative circles */}
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col justify-center p-12 text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <Image 
                  src="/logo.png" 
                  alt="FEPC Logo" 
                  width={48} 
                  height={48}
                  className="rounded-xl bg-white/20 backdrop-blur-sm p-1"
                />
                <div>
                  <h1 className="text-2xl font-bold">FEPC</h1>
                  <p className="text-white/80 text-sm">Far Eastern Polytechnic College</p>
                </div>
              </div>

              <h2 className="text-4xl font-bold mb-4">
                Intelligent Timetable Management
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-md">
                Streamline your academic scheduling with our AI-powered conflict detection 
                and automatic schedule generation.
              </p>

              <div className="space-y-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="text-sm text-white/70">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Side - Login/Register Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center mb-8">
              <div className="flex items-center gap-3">
                <Image 
                  src="/logo.png" 
                  alt="FEPC Logo" 
                  width={48} 
                  height={48}
                  className="rounded-xl"
                />
                <div>
                  <h1 className="text-xl font-bold">FEPC</h1>
                  <p className="text-muted-foreground text-sm">Far Eastern Polytechnic College</p>
                </div>
              </div>
            </div>

            <Card className="border-0 shadow-xl">
              <CardHeader className="space-y-1 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">
                      {mode === 'login' ? 'Welcome back' : 'Create account'}
                    </CardTitle>
                    <CardDescription>
                      {mode === 'login' 
                        ? 'Sign in to your account to continue' 
                        : 'Register as a faculty member'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={switchMode}
                    className="text-primary"
                  >
                    {mode === 'login' ? (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Register
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-1" />
                        Sign in
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4"
                    >
                      <Alert className="border-green-500/50 bg-green-500/10">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          {success}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  {mode === 'login' ? (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onSubmit={handleLogin}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button type="submit" className="w-full h-11" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          'Sign in'
                        )}
                      </Button>

                      {/* Seed Button (only show if needs seeding) */}
                      {seedStatus === 'needs-seed' && (
                        <div className="pt-4 border-t">
                          <Alert className="border-amber-500/50 bg-amber-500/10 mb-3">
                            <Database className="h-4 w-4 text-amber-500" />
                            <AlertDescription className="text-amber-700 dark:text-amber-400">
                              Database needs to be seeded with demo data.
                            </AlertDescription>
                          </Alert>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleSeed}
                            disabled={seedLoading}
                          >
                            {seedLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Seeding Database...
                              </>
                            ) : (
                              <>
                                <Database className="mr-2 h-4 w-4" />
                                Seed Demo Data
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Demo Credentials */}
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground text-center mb-3">Demo Credentials:</p>
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => {
                              setEmail('admin@fepc.edu.ph');
                              setPassword('password123');
                            }}
                          >
                            <span className="font-medium mr-2">Admin:</span>
                            admin@fepc.edu.ph
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => {
                              setEmail('head.cs@fepc.edu.ph');
                              setPassword('password123');
                            }}
                          >
                            <span className="font-medium mr-2">Dept Head:</span>
                            head.cs@fepc.edu.ph
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => {
                              setEmail('faculty1@fepc.edu.ph');
                              setPassword('password123');
                            }}
                          >
                            <span className="font-medium mr-2">Faculty:</span>
                            faculty1@fepc.edu.ph
                          </Button>
                        </div>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onSubmit={handleRegister}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          type="text"
                          placeholder="Enter your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Department (Optional)</Label>
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select your department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name} {dept.code ? `(${dept.code})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number (Optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-password">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Create a password (min 8 characters)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="h-11"
                        />
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button type="submit" className="w-full h-11" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Account
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-muted-foreground text-center">
                        By creating an account, you will be registered as a faculty member.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
