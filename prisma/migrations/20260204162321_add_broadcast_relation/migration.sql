-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "originalBroadcastEventId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_originalBroadcastEventId_fkey" FOREIGN KEY ("originalBroadcastEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
