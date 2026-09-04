# DB SCHEMA — OASE Dental Clinic
**Versi: 2.0** | BINDING — AI agent dilarang menambah/mengubah tabel
atau kolom di luar file ini tanpa bertanya.

Konvensi:
- Primary key: `id String @id @default(uuid())` (cuid boleh)
- Semua tabel punya `createdAt DateTime @default(now())` dan
  `updatedAt DateTime @updatedAt` kecuali disebut lain
- Timestamp UTC; display Asia/Jakarta di application layer
- Nama tabel snake_case via `@@map`

---

## Enums

```prisma
enum UserRole { OWNER MANAGER CASHIER EMPLOYEE }

enum TransactionStatus { DRAFT PAID CANCELLED }

enum PaymentMethod { CASH DEBIT QRIS_TRANSFER }

enum ItemType { MATERIAL }

enum MovementType { STOCK_IN TRANSACTION MANUAL_ADJUSTMENT DAMAGE EXPIRED OPNAME }

enum ExpenseCategory { OPERASIONAL GAJI SEWA UTILITAS SUPPLIER LAINNYA }

enum LeaveType { CUTI IZIN SAKIT }

enum LeaveStatus { PENDING APPROVED REJECTED }

enum AttendanceStatus { PRESENT LATE }

enum OpnameStatus { DRAFT SUBMITTED }

enum ClosingStatus { OPEN CLOSED }

enum AuditAction {
  CREATE UPDATE DELETE
  LOGIN LOGIN_FAILED LOGOUT SWITCH_BRANCH
  TRANSACTION_PAID TRANSACTION_CANCELLED
  CASH_CLOSING_CREATED CASH_CLOSING_CLOSED CASH_CLOSING_REOPENED
  STOCK_OPNAME_SUBMITTED LEAVE_APPROVED LEAVE_REJECTED
  ATTENDANCE_CORRECTED
}
```

---

## Models

```prisma
model Branch {
  id        String  @id @default(uuid())
  code      String  @unique            // 3-5 huruf, mis. JKT
  name      String
  address   String
  phone     String?
  active    Boolean @default(true)
  // relasi
  employees        EmployeeBranch[]
  transactions     Transaction[]
  inventoryMovements InventoryMovement[]
  cashClosings     CashClosing[]
  stockOpnames     StockOpname[]
  expenses         Expense[]
  workingHours     BranchWorkingHour?
  @@map("branches")
}

model BranchWorkingHour {
  id        String @id @default(uuid())
  branchId  String @unique
  branch    Branch @relation(fields: [branchId], references: [id])
  openTime  String // "08:00"
  closeTime String // "21:00"
  lateAfter String // "08:15" — batas LATE untuk absensi
  @@map("branch_working_hours")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         UserRole
  employeeId   String?  @unique          // wajib terisi untuk non-OWNER
  employee     Employee? @relation(fields: [employeeId], references: [id])
  active       Boolean  @default(true)
  refreshTokens RefreshToken[]
  auditLogs    AuditLog[] @relation("AuditActor")
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  @@map("refresh_tokens")
}

model Employee {
  id      String  @id @default(uuid())
  name    String
  phone   String?
  position String // teks bebas: "Dokter Gigi", "Kasir", dst
  active  Boolean @default(true)
  user    User?
  branches EmployeeBranch[]
  attendances Attendance[]
  leaveRequests LeaveRequest[]
  @@map("employees")
}

model EmployeeBranch {
  id         String  @id @default(uuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id])
  active     Boolean @default(true)
  @@unique([employeeId, branchId])
  @@map("employee_branches")
}

model Attendance {
  id         String @id @default(uuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  branchId   String
  branch     Branch @relation(fields: [branchId], references: [id])
  workDate   DateTime @db.Date // tanggal operasional (server)
  checkIn    DateTime?
  checkOut   DateTime?
  status     AttendanceStatus
  corrected  Boolean @default(false)
  correctionNote String?
  @@unique([employeeId, workDate, branchId])
  @@index([workDate])
  @@map("attendances")
}

model LeaveRequest {
  id         String @id @default(uuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  type       LeaveType
  startDate  DateTime @db.Date
  endDate    DateTime @db.Date
  reason     String
  status     LeaveStatus @default(PENDING)
  decidedBy  String?  // user id
  decidedAt  DateTime?
  decisionNote String?
  @@index([employeeId, status])
  @@map("leave_requests")
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  active Boolean @default(true)
  services Service[]
  @@map("categories")
}

model Service {
  id          String  @id @default(uuid())
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
  name        String
  nameEn      String?   // fallback ke name
  description String?
  descriptionEn String?
  price       Decimal   @db.Decimal(12, 2)
  active      Boolean @default(true)
  showOnPortal Boolean @default(false)
  deletedAt   DateTime?
  @@map("services")
}

model Material {
  id        String  @id @default(uuid())
  name      String
  sku       String  @unique
  unit      String
  minStock  Int     @default(0)
  isStockTracked Boolean @default(true)
  active    Boolean @default(true)
  deletedAt DateTime?
  @@map("materials")
}

model Transaction {
  id              String  @id @default(uuid())
  transactionNumber String @unique // TRX-YYYYMMDD-00001 (per cabang, seq di NumberSequence)
  branchId        String
  branch          Branch @relation(fields: [branchId], references: [id])
  cashierId       String  // user id
  patientName     String?
  patientPhone    String?
  status          TransactionStatus @default(DRAFT)
  subtotal        Decimal @db.Decimal(12, 2)
  total           Decimal @db.Decimal(12, 2)
  transactionDate DateTime // server time (operasional)
  paidAt          DateTime?
  cancelledAt     DateTime?
  cancelledBy     String?
  cancellationReason String?
  items           TransactionItem[]
  payments        TransactionPayment[]
  @@index([branchId, transactionDate])
  @@map("transactions")
}

model TransactionItem {
  id            String  @id @default(uuid())
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  serviceId     String
  itemId        String  // uuid dari service (snapshot reference)
  name          String  // SNAPSHOT
  nameEn        String? // SNAPSHOT (service)
  price         Decimal @db.Decimal(12, 2) // SNAPSHOT
  quantity      Int
  lineTotal     Decimal @db.Decimal(12, 2)
  @@index([transactionId])
  @@map("transaction_items")
}

model TransactionPayment {
  id            String @id @default(uuid())
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  method        PaymentMethod
  amount        Decimal @db.Decimal(12, 2)
  createdAt     DateTime @default(now())
  @@map("transaction_payments")
}

model InventoryMovement {
  id            String @id @default(uuid())
  branchId      String
  branch        Branch @relation(fields: [branchId], references: [id])
  itemType      ItemType
  materialId    String?
  itemId        String
  quantityDelta Int    // positif = masuk, negatif = keluar
  unitCost      Decimal? @db.Decimal(12, 2)
  referenceType MovementType
  referenceId   String? // transaction id / opname id / stock-in batch id
  notes         String?
  createdBy     String
  @@index([branchId, itemId, createdAt])
  @@map("inventory_movements")
}
// Current stock = SUM(quantityDelta) per (branchId, itemId).
// Implementasi: helper query + optional tabel cache di bawah
// untuk performa dashboard (di-update dalam transaction yang sama).

model StockLevel {
  id        String @id @default(uuid())
  branchId  String
  itemType  ItemType
  itemId    String
  quantity  Int    @default(0)
  @@unique([branchId, itemType, itemId])
  @@map("stock_levels")
}
// INVARIANT: StockLevel.quantity harus selalu = SUM(movement delta).
// Setiap movement wajib meng-update StockLevel dalam $transaction yang sama.

model StockOpname {
  id        String @id @default(uuid())
  branchId  String
  branch    Branch @relation(fields: [branchId], references: [id])
  opnameDate DateTime @db.Date
  status    OpnameStatus @default(DRAFT)
  submittedAt DateTime?
  submittedBy String?
  items     StockOpnameItem[]
  @@unique([branchId, opnameDate])
  @@map("stock_opnames")
}

model StockOpnameItem {
  id          String @id @default(uuid())
  opnameId    String
  opname      StockOpname @relation(fields: [opnameId], references: [id])
  itemType    ItemType
  itemId      String
  systemQty   Int   // read-only snapshot saat opname dibuat
  physicalQty Int
  note        String?
  @@unique([opnameId, itemType, itemId])
  @@map("stock_opname_items")
}

model Expense {
  id          String @id @default(uuid())
  branchId    String
  branch      Branch @relation(fields: [branchId], references: [id])
  category    ExpenseCategory
  amount      Decimal @db.Decimal(12, 2) // > 0; koreksi via expense negatif terpisah
  expenseDate DateTime @db.Date
  note        String
  proofUrl    String? // Supabase Storage
  createdBy   String
  @@index([branchId, expenseDate])
  @@map("expenses")
}

model CashClosing {
  id            String @id @default(uuid())
  branchId      String
  branch        Branch @relation(fields: [branchId], references: [id])
  status        ClosingStatus @default(OPEN)
  periodStart   DateTime // = closingDate closing sebelumnya
  closingDate   DateTime // server time
  expectedCash  Decimal @db.Decimal(12, 2)
  actualCash    Decimal @db.Decimal(12, 2)
  variance      Decimal @db.Decimal(12, 2)
  note          String?
  closedBy      String
  reopenedBy    String?
  reopenedReason String?
  reopenedAt    DateTime?
  @@index([branchId, status])
  @@map("cash_closings")
}

model NumberSequence {
  id        String @id @default(uuid())
  branchId  String
  scope     String // "TRANSACTION"
  seqDate   DateTime @db.Date
  lastSeq   Int @default(0)
  @@unique([branchId, scope, seqDate])
  @@map("number_sequences")
}

model AuditLog {
  id        String @id @default(uuid())
  actorId   String?
  actor     User?  @relation("AuditActor", fields: [actorId], references: [id])
  action    AuditAction
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  note      String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

model PortalPage {
  id         String @id @default(uuid())
  slug       String @unique
  titleId    String
  titleEn    String
  contentId  String @db.Text
  contentEn  String @db.Text
  published  Boolean @default(false)
  sortOrder  Int @default(0)
  @@map("portal_pages")
}
```

---

## Seed (wajib)

1. 1 OWNER (dari `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`)
2. 2 cabang: `JKT` (OASE Klinik Gigi — Pusat) dan `BDG` (OASE Klinik Gigi — Cabang)
3. BranchWorkingHour untuk keduanya
4. Contoh: 1 kategori, 3 service, 2 product, 2 material, 2 employee
   (1 per cabang) + user CASHIER untuk cabang JKT
5. PortalPage contoh ("tentang-kami")

## Migration rules
- Hanya via `prisma migrate dev` / `prisma migrate deploy`
- Tidak ada SQL manual
- Decimal selalu `@db.Decimal(12, 2)` — tidak ada Float untuk uang
