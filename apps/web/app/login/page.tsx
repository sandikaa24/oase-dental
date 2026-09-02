'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client guard: hanya redirect jika user TERVALIDASI dari session (bukan sekadar presence cookie)
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/admin');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/admin');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal masuk. Silakan periksa kredensial Anda.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-teal-50/50 via-background to-blue-50/40">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-sm mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            OASE Dental Clinic
          </h1>
          <p className="text-sm text-muted mt-1">
            Sistem Manajemen Operasional &amp; Kasir
          </p>
        </div>

        <Card className="shadow-sm border-border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg text-center">Masuk ke Akun</CardTitle>
            <CardDescription className="text-xs text-center">
              Masukkan email dan kata sandi Anda untuk mengakses dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <ErrorBanner
                  title="Gagal Masuk"
                  message={error}
                />
              )}

              <div className="space-y-1">
                <Input
                  label="Email"
                  type="email"
                  placeholder="nama@oasedental.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Kata Sandi"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isSubmitting}
                disabled={authLoading}
              >
                Masuk
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-muted mt-6">
          &copy; 2026 OASE Dental Clinic. Hak Cipta Dilindungi.
        </p>
      </div>
    </div>
  );
}
