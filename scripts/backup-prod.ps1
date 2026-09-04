<#
.SYNOPSIS
    Script Otomatisasi Backup Database PostgreSQL & File Bukti Uploads OASE Dental Clinic.

.DESCRIPTION
    Script ini melakukan:
    1. Membaca konfigurasi database dari file .env secara aman (tanpa hardcode password).
    2. Menjalankan pg_dump (mendukung Docker Compose oase-postgres maupun native pg_dump.exe).
    3. Menyimpan hasil dump ke folder backup bertanggal (YYYY-MM-DD).
    4. Mengarsipkan seluruh folder bukti kuitansi (uploads).
    5. Menghapus arsip backup yang berumur lebih dari batas retensi (default 7 hari).
    6. Mencatat seluruh log eksekusi, ukuran file, dan stempel waktu ke file backup.log.

.PARAMETER EnvFile
    Lokasi file .env konfigurasi produksi (default: .env di root repositori atau apps/web/.env).

.PARAMETER BackupRoot
    Direktori target penyimpanan arsip backup (default: .\backups).

.PARAMETER RetentionDays
    Jumlah hari penyimpanan backup sebelum dihapus otomatis (default: 7).

.PARAMETER Mode
    Metode koneksi pg_dump: 'Auto', 'Docker', atau 'Native' (default: 'Auto').
#>

[CmdletBinding()]
param (
    [string]$EnvFile = "",
    [string]$BackupRoot = "",
    [int]$RetentionDays = 7,
    [ValidateSet("Auto", "Docker", "Native")]
    [string]$Mode = "Auto"
)

$ErrorActionPreference = "Stop"

# ─── 1. RESOLVE PATHS ────────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = Join-Path $ProjectRoot "backups"
}

if (-not (Test-Path $BackupRoot)) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
}

$LogFile = Join-Path $BackupRoot "backup.log"

function Write-Log {
    param (
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine
    Add-Content -Path $LogFile -Value $logLine -Encoding UTF8
}

Write-Log "=========================================================="
Write-Log "MEMULAI PROSES BACKUP OASE DENTAL CLINIC"

# ─── 2. BACA FILE .ENV SECARA AMAN ──────────────────────────────────────────
$envCandidates = @()
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    $envCandidates += $EnvFile
}
$envCandidates += (Join-Path $ProjectRoot ".env")
$envCandidates += (Join-Path $ProjectRoot "apps\web\.env")

$SelectedEnv = $null
foreach ($cand in $envCandidates) {
    if (Test-Path $cand) {
        $SelectedEnv = $cand
        break
    }
}

if (-not $SelectedEnv) {
    Write-Log "File .env tidak ditemukan pada lokasi yang diperiksa!" "ERROR"
    exit 1
}

Write-Log "Membaca konfigurasi environment dari: $SelectedEnv"

$envVars = @{}
Get-Content $SelectedEnv | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $idx = $line.IndexOf("=")
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        $envVars[$key] = $val
    }
}

# ─── 3. STRUKTUR FOLDER BACKUP BERTANGGAL ────────────────────────────────────
$DateFolder = Get-Date -Format "yyyy-MM-dd"
$TimeStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TargetDir = Join-Path $BackupRoot $DateFolder

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$DumpFileName = "db_oase_${TimeStamp}.sql"
$DumpFilePath = Join-Path $TargetDir $DumpFileName
$UploadsZipName = "uploads_oase_${TimeStamp}.zip"
$UploadsZipPath = Join-Path $TargetDir $UploadsZipName

# ─── 4. EKSEKUSI PG_DUMP ────────────────────────────────────────────────────
$dumpSuccess = $false

# Opsi 1: Docker Compose (jika Mode Auto/Docker dan container oase-postgres running)
if ($Mode -in @("Auto", "Docker")) {
    try {
        $dockerCheck = & docker ps --filter "name=oase-postgres" --format "{{.Names}}" 2>$null
        if ($dockerCheck -match "oase-postgres") {
            Write-Log "Terdeteksi kontainer Docker 'oase-postgres'. Menjalankan pg_dump via Docker..."
            $dbUser = if ($envVars["POSTGRES_USER"]) { $envVars["POSTGRES_USER"] } else { "oase_user" }
            $dbName = if ($envVars["POSTGRES_DB"]) { $envVars["POSTGRES_DB"] } else { "oase_db" }

            & docker exec -t oase-postgres pg_dump -U $dbUser -d $dbName --clean --if-exists > $DumpFilePath
            if ($LASTEXITCODE -eq 0 -and (Test-Path $DumpFilePath) -and ((Get-Item $DumpFilePath).Length -gt 0)) {
                $dumpSuccess = $true
                Write-Log "pg_dump via Docker berhasil." "SUCCESS"
            }
        }
    } catch {
        Write-Log "Percobaan pg_dump via Docker gagal, beralih ke Native..." "WARN"
    }
}

# Opsi 2: Native pg_dump (jika belum sukses)
if (-not $dumpSuccess) {
    Write-Log "Menjalankan pg_dump via binary native lokal..."
    
    # Cari binary pg_dump.exe
    $pgDumpBin = Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue
    if (-not $pgDumpBin) {
        $commonPaths = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
        )
        foreach ($cp in $commonPaths) {
            if (Test-Path $cp) { $pgDumpBin = $cp; break }
        }
    }

    if (-not $pgDumpBin) {
        Write-Log "Executable 'pg_dump.exe' tidak ditemukan di sistem!" "ERROR"
        exit 1
    }

    # Gunakan DIRECT_URL jika ada (misal Supabase direct port 5432), atau DATABASE_URL
    $connUrl = if ($envVars["DIRECT_URL"]) { $envVars["DIRECT_URL"] } else { $envVars["DATABASE_URL"] }

    if ([string]::IsNullOrWhiteSpace($connUrl)) {
        # Fallback ke komponen terpisah
        $dbHost = if ($envVars["POSTGRES_HOST"]) { $envVars["POSTGRES_HOST"] } else { "localhost" }
        $dbPort = if ($envVars["POSTGRES_PORT"]) { $envVars["POSTGRES_PORT"] } else { "5432" }
        $dbUser = if ($envVars["POSTGRES_USER"]) { $envVars["POSTGRES_USER"] } else { "postgres" }
        $dbName = if ($envVars["POSTGRES_DB"]) { $envVars["POSTGRES_DB"] } else { "postgres" }
        $dbPass = $envVars["POSTGRES_PASSWORD"]

        if ($dbPass) { $env:PGPASSWORD = $dbPass }
        & $pgDumpBin -h $dbHost -p $dbPort -U $dbUser -d $dbName --clean --if-exists --file=$DumpFilePath
    } else {
        # Menggunakan Connection String
        Write-Log "Menghubungkan via connection string dari .env..."
        & $pgDumpBin "$connUrl" --clean --if-exists --file=$DumpFilePath
    }

    if ($LASTEXITCODE -eq 0 -and (Test-Path $DumpFilePath) -and ((Get-Item $DumpFilePath).Length -gt 0)) {
        $dumpSuccess = $true
        Write-Log "pg_dump native berhasil." "SUCCESS"
    } else {
        Write-Log "Eksekusi native pg_dump gagal dengan kode keluar: $LASTEXITCODE" "ERROR"
        exit 1
    }
}

$dumpSizeKB = [math]::Round(((Get-Item $DumpFilePath).Length / 1KB), 2)
Write-Log "File dump database: $DumpFilePath ($dumpSizeKB KB)" "INFO"

# ─── 5. BACKUP VOLUME UPLOADS (BUKTI KUITANSI/NOTA) ─────────────────────────
$uploadsDirCandidates = @(
    (Join-Path $ProjectRoot "apps\web\public\uploads"),
    (Join-Path $ProjectRoot "uploads"),
    $envVars["UPLOAD_DIR"]
)

$targetUploadsDir = $null
foreach ($uc in $uploadsDirCandidates) {
    if ($uc -and (Test-Path $uc)) {
        $targetUploadsDir = $uc
        break
    }
}

if ($targetUploadsDir) {
    Write-Log "Mengarsipkan direktori uploads: $targetUploadsDir ..."
    try {
        if (Test-Path $UploadsZipPath) { Remove-Item $UploadsZipPath -Force }
        Compress-Archive -Path "$targetUploadsDir\*" -DestinationPath $UploadsZipPath -Force -ErrorAction SilentlyContinue
        
        # Jika folder kosong Compress-Archive mungkin tidak membuat file, buat zip dummy penanda
        if (-not (Test-Path $UploadsZipPath)) {
            $emptyNote = Join-Path $TargetDir "uploads_info.txt"
            Set-Content -Path $emptyNote -Value "Folder uploads ada namun tidak berisi file pada saat backup ($TimeStamp)." -Encoding UTF8
            Compress-Archive -Path $emptyNote -DestinationPath $UploadsZipPath -Force
            Remove-Item $emptyNote -Force
        }

        $zipSizeKB = [math]::Round(((Get-Item $UploadsZipPath).Length / 1KB), 2)
        Write-Log "Arsip uploads berhasil dibuat: $UploadsZipPath ($zipSizeKB KB)" "SUCCESS"
    } catch {
        Write-Log "Gagal mengarsipkan uploads: $_" "WARN"
    }
} else {
    Write-Log "Folder uploads fisik belum ada. Membuat catatan manifest bukti..." "INFO"
    $manifestFile = Join-Path $TargetDir "uploads_manifest.txt"
    Set-Content -Path $manifestFile -Value "Folder uploads belum berisi data fisik pada saat backup ($TimeStamp)." -Encoding UTF8
}

# ─── 6. ROTASI & PEMBERSIHAN BACKUP KEDALUWARSA (> 7 HARI) ─────────────────
Write-Log "Memeriksa retensi arsip backup (kebijakan: $RetentionDays hari)..."
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)

# Bersihkan folder harian yang lebih tua dari cutoff
$oldFolders = Get-ChildItem -Path $BackupRoot -Directory | Where-Object {
    if ($_.Name -match '^\d{4}-\d{2}-\d{2}$') {
        try {
            $folderDate = [DateTime]::ParseExact($_.Name, "yyyy-MM-dd", $null)
            return $folderDate -lt $cutoffDate.Date
        } catch {
            return $_.LastWriteTime -lt $cutoffDate
        }
    }
    return $_.LastWriteTime -lt $cutoffDate
}

foreach ($folder in $oldFolders) {
    Write-Log "Menghapus folder backup kedaluwarsa: $($folder.FullName) (Dibuat: $($folder.CreationTime))" "INFO"
    Remove-Item -Path $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

# Bersihkan juga file .sql atau .zip lepasan yang melebihi retensi
$oldFiles = Get-ChildItem -Path $BackupRoot -File -Include "*.sql", "*.zip", "*.gz" -Recurse | Where-Object {
    $_.LastWriteTime -lt $cutoffDate
}

foreach ($file in $oldFiles) {
    Write-Log "Menghapus file arsip kedaluwarsa: $($file.FullName)" "INFO"
    Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
}

Write-Log "Pembersihan retensi selesai." "INFO"
Write-Log "PROSES BACKUP BERHASIL DISELESAIKAN DENGAN SUKSES." "SUCCESS"
Write-Log "=========================================================="
exit 0
