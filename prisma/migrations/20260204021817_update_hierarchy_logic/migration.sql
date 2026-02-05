-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "visibleToParent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "group" TEXT;

-- CreateTable
CREATE TABLE "_EventTargets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_EventTargets_AB_unique" ON "_EventTargets"("A", "B");

-- CreateIndex
CREATE INDEX "_EventTargets_B_index" ON "_EventTargets"("B");

-- AddForeignKey
ALTER TABLE "_EventTargets" ADD CONSTRAINT "_EventTargets_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventTargets" ADD CONSTRAINT "_EventTargets_B_fkey" FOREIGN KEY ("B") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
