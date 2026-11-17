-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'fixed',
    "deadline" TIMESTAMP(3),
    "criteria" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentRoomId" TEXT NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programId" TEXT NOT NULL,

    CONSTRAINT "ProgramRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramChild" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "regionId" TEXT,

    CONSTRAINT "ProgramChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramChildDepartment" (
    "childId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "ProgramChildDepartment_pkey" PRIMARY KEY ("childId","departmentId")
);

-- CreateTable
CREATE TABLE "ProgramDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDays" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "programId" TEXT NOT NULL,

    CONSTRAINT "ProgramDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivityRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviada',
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "programId" TEXT,
    "departmentId" TEXT,
    "roomId" TEXT NOT NULL,
    "supersedesId" TEXT,
    "eventId" TEXT,

    CONSTRAINT "FestivityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_inviteCode_key" ON "Program"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramRegion_programId_name_key" ON "ProgramRegion"("programId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramChild_programId_roomId_key" ON "ProgramChild"("programId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDepartment_programId_name_key" ON "ProgramDepartment"("programId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FestivityRequest_supersedesId_key" ON "FestivityRequest"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "FestivityRequest_eventId_key" ON "FestivityRequest"("eventId");

-- CreateIndex
CREATE INDEX "FestivityRequest_programId_status_idx" ON "FestivityRequest"("programId", "status");

-- CreateIndex
CREATE INDEX "FestivityRequest_roomId_idx" ON "FestivityRequest"("roomId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_parentRoomId_fkey" FOREIGN KEY ("parentRoomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRegion" ADD CONSTRAINT "ProgramRegion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChild" ADD CONSTRAINT "ProgramChild_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChild" ADD CONSTRAINT "ProgramChild_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChild" ADD CONSTRAINT "ProgramChild_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "ProgramRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChildDepartment" ADD CONSTRAINT "ProgramChildDepartment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ProgramChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChildDepartment" ADD CONSTRAINT "ProgramChildDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ProgramDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramDepartment" ADD CONSTRAINT "ProgramDepartment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityRequest" ADD CONSTRAINT "FestivityRequest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityRequest" ADD CONSTRAINT "FestivityRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ProgramDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityRequest" ADD CONSTRAINT "FestivityRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityRequest" ADD CONSTRAINT "FestivityRequest_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "FestivityRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityRequest" ADD CONSTRAINT "FestivityRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

