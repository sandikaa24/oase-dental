import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md border-border text-center shadow-sm">
        <CardContent className="p-8 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger-icon mx-auto">
            <ShieldX className="h-8 w-8" />
          </div>
          <Badge variant="danger">403 Dilarang</Badge>
          <h2 className="text-xl font-bold text-foreground">
            Akses Ditolak
          </h2>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Akun Anda tidak memiliki izin (permission) yang memadai untuk mengakses halaman atau fitur ini.
          </p>
          <div className="pt-2">
            <Link href="/admin">
              <Button variant="secondary" size="md" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
