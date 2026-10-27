-- Payroll entries are either a salary payout or an advance taken before payday.

-- AlterTable
ALTER TABLE "StaffPayment" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'salary';
