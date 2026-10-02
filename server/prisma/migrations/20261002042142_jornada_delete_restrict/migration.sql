-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_jornadaId_fkey`;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_jornadaId_fkey` FOREIGN KEY (`jornadaId`) REFERENCES `Jornada`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
