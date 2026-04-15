-- AlterTable
ALTER TABLE "User" ADD COLUMN     "readReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlineStatusVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "typingIndicatorsEnabled" BOOLEAN NOT NULL DEFAULT true;
