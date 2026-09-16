-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `acquisitionChannel` ENUM('WALK_IN', 'PHONE', 'WHATSAPP', 'EMAIL', 'WEBSITE', 'SOCIAL_MEDIA', 'MARKETPLACE', 'REFERRAL', 'OTHER') NULL,
    ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `documentId` VARCHAR(191) NULL,
    ADD COLUMN `lastOrderAt` DATETIME(3) NULL,
    ADD COLUMN `lifetimeValue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `ordersCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `preferredContact` ENUM('WALK_IN', 'PHONE', 'WHATSAPP', 'EMAIL', 'WEBSITE', 'SOCIAL_MEDIA', 'MARKETPLACE', 'REFERRAL', 'OTHER') NULL,
    ADD COLUMN `tags` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('INDIVIDUAL', 'CORPORATE') NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `assignedToId` VARCHAR(191) NULL,
    ADD COLUMN `cardMessage` VARCHAR(191) NULL,
    ADD COLUMN `channel` ENUM('WALK_IN', 'PHONE', 'WHATSAPP', 'EMAIL', 'WEBSITE', 'SOCIAL_MEDIA', 'MARKETPLACE', 'REFERRAL', 'OTHER') NOT NULL DEFAULT 'WALK_IN',
    ADD COLUMN `deliveryAddress` VARCHAR(191) NULL,
    ADD COLUMN `deliveryCity` VARCHAR(191) NULL,
    ADD COLUMN `deliveryFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `deliveryMethod` ENUM('PICKUP', 'DELIVERY') NOT NULL DEFAULT 'PICKUP',
    ADD COLUMN `deliveryWindow` VARCHAR(191) NULL,
    ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `externalReference` VARCHAR(191) NULL,
    ADD COLUMN `isRush` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `occasion` ENUM('BIRTHDAY', 'ANNIVERSARY', 'SYMPATHY', 'WEDDING', 'GET_WELL', 'CONGRATULATIONS', 'ROMANCE', 'NEW_BABY', 'GRADUATION', 'CORPORATE', 'MOTHERS_DAY', 'VALENTINES', 'NO_OCCASION', 'OTHER') NOT NULL DEFAULT 'NO_OCCASION',
    ADD COLUMN `rating` INTEGER NULL,
    ADD COLUMN `ratingComment` VARCHAR(191) NULL,
    ADD COLUMN `recipientName` VARCHAR(191) NULL,
    ADD COLUMN `recipientPhone` VARCHAR(191) NULL,
    ADD COLUMN `recipientRelationship` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `category` ENUM('FLOWERS', 'GREENERY', 'PLANT', 'ARRANGEMENT', 'CONTAINER', 'BALLOON', 'CARD', 'GIFT_ADDON', 'SUPPLY', 'OTHER') NOT NULL DEFAULT 'FLOWERS',
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `costPrice` DECIMAL(10, 2) NULL,
    ADD COLUMN `receivedAt` DATETIME(3) NULL,
    ADD COLUMN `reorderQuantity` INTEGER NULL,
    ADD COLUMN `shelfLifeDays` INTEGER NULL,
    ADD COLUMN `sku` VARCHAR(191) NULL,
    ADD COLUMN `tags` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CustomerAddress` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerAddress_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerSpecialDate` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `occasion` ENUM('BIRTHDAY', 'ANNIVERSARY', 'SYMPATHY', 'WEDDING', 'GET_WELL', 'CONGRATULATIONS', 'ROMANCE', 'NEW_BABY', 'GRADUATION', 'CORPORATE', 'MOTHERS_DAY', 'VALENTINES', 'NO_OCCASION', 'OTHER') NULL,
    `month` INTEGER NOT NULL,
    `day` INTEGER NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerSpecialDate_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Customer_lastOrderAt_idx` ON `Customer`(`lastOrderAt`);

-- CreateIndex
CREATE INDEX `Order_occasion_idx` ON `Order`(`occasion`);

-- CreateIndex
CREATE INDEX `Order_channel_idx` ON `Order`(`channel`);

-- CreateIndex
CREATE INDEX `Product_category_idx` ON `Product`(`category`);

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSpecialDate` ADD CONSTRAINT `CustomerSpecialDate_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
