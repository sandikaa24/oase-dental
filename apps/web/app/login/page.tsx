'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

import type { UserSession } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Amandemen D4: SEMUA user tanpa konteks cabang valid dialihkan ke /select-branch
  const handlePostLoginRedirect = useCallback((userSession: UserSession) => {
    if (userSession.branchContext || userSession.activeBranchId) {
      router.replace('/admin');
    } else {
      router.replace('/select-branch');
    }
  }, [router]);

  // Client guard: hanya redirect jika user TERVALIDASI dari session (bukan sekadar presence cookie)
  useEffect(() => {
    if (!authLoading && user) {
      handlePostLoginRedirect(user);
    }
  }, [user, authLoading, handlePostLoginRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const userSession = await login(identifier, password);
      handlePostLoginRedirect(userSession);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
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
              Masukkan username atau email dan kata sandi Anda untuk mengakses dashboard
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
                  label="Username atau Email"
                  type="text"
                  placeholder="Username atau email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Kata Sandi"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting || authLoading}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                      title={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                      className="w-10 h-10 flex items-center justify-center text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r-md transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  }
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
