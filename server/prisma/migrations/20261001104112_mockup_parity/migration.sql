-- DropForeignKey
ALTER TABLE `CustomerAddress` DROP FOREIGN KEY `CustomerAddress_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `CustomerSpecialDate` DROP FOREIGN KEY `CustomerSpecialDate_customerId_fkey`;

-- DropIndex
DROP INDEX `Order_channel_idx` ON `Order`;

-- DropIndex
DROP INDEX `Order_occasion_idx` ON `Order`;

-- AlterTable
ALTER TABLE `Customer` DROP COLUMN `address`,
    DROP COLUMN `preferredContact`,
    ADD COLUMN `emails` JSON NOT NULL,
    ADD COLUMN `paymentMethods` JSON NOT NULL,
    MODIFY `acquisitionChannel` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `CustomerAddress` DROP COLUMN `customerId`,
    ADD COLUMN `personaId` VARCHAR(191) NOT NULL,
    ADD COLUMN `zone` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `CustomerSpecialDate` DROP COLUMN `customerId`,
    DROP COLUMN `occasion`,
    ADD COLUMN `personaId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Expense` MODIFY `type` ENUM('GASTO', 'COSTO', 'INVERSION', 'OTRO') NOT NULL;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `channel`,
    DROP COLUMN `deliveryWindow`,
    DROP COLUMN `isRush`,
    DROP COLUMN `recipientRelationship`,
    ADD COLUMN `cardPrinted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `deliveryPersonId` VARCHAR(191) NULL,
    ADD COLUMN `dispatchPrinted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isThirdPartyDelivery` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `notifiedStatus` ENUM('PENDING', 'IN_PROGRESS', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `qCalidad` INTEGER NULL,
    ADD COLUMN `qPuntualidad` INTEGER NULL,
    ADD COLUMN `qRecomendacion` INTEGER NULL,
    ADD COLUMN `recipientPersonaId` VARCHAR(191) NULL,
    ADD COLUMN `scheduledHour` VARCHAR(191) NULL,
    ADD COLUMN `scheduledShift` VARCHAR(191) NULL,
    ADD COLUMN `surveyNotes` TEXT NULL,
    ADD COLUMN `surveySelected` BOOLEAN NULL,
    ADD COLUMN `thirdPartyDriverName` VARCHAR(191) NULL,
    ADD COLUMN `thirdPartyPlate` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    MODIFY `deliveryDate` DATE NULL,
    MODIFY `notes` TEXT NULL,
    MODIFY `cardMessage` TEXT NULL,
    MODIFY `deliveryMethod` ENUM('PICKUP', 'DELIVERY') NOT NULL DEFAULT 'DELIVERY',
    MODIFY `occasion` VARCHAR(191) NULL,
    MODIFY `ratingComment` TEXT NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `productName` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `coverPhoto` LONGTEXT NULL,
    ADD COLUMN `groupId` VARCHAR(191) NULL,
    ADD COLUMN `laborCost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `photos` JSON NULL,
    MODIFY `category` VARCHAR(191) NOT NULL DEFAULT 'Otros';

-- AlterTable
ALTER TABLE `Store` ADD COLUMN `adminId` VARCHAR(191) NULL,
    ADD COLUMN `logo` LONGTEXT NULL,
    ADD COLUMN `themeColor` VARCHAR(191) NULL,
    ADD COLUMN `vendedorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `arl` VARCHAR(191) NULL,
    ADD COLUMN `contractType` VARCHAR(191) NULL,
    ADD COLUMN `documentId` VARCHAR(191) NULL,
    ADD COLUMN `eps` VARCHAR(191) NULL,
    ADD COLUMN `hasSystemAccess` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `hireDate` DATE NULL,
    ADD COLUMN `jornadaId` VARCHAR(191) NULL,
    ADD COLUMN `pensionFund` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `position` VARCHAR(191) NULL,
    ADD COLUMN `salary` DECIMAL(12, 2) NULL,
    ADD COLUMN `schedule` JSON NULL,
    MODIFY `role` ENUM('ADMIN', 'GERENTE', 'ADMINISTRATIVO', 'VENDEDOR') NOT NULL DEFAULT 'VENDEDOR';

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'ADMINISTRATIVO', 'VENDEDOR') NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `RolePermission_role_key_key`(`role`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jornada` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `days` JSON NOT NULL,
    `start` VARCHAR(191) NOT NULL,
    `end` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListOption` (
    `id` VARCHAR(191) NOT NULL,
    `listKey` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ListOption_listKey_idx`(`listKey`),
    UNIQUE INDEX `ListOption_listKey_value_key`(`listKey`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardMessageTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `occasion` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `CardMessageTemplate_occasion_idx`(`occasion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanySettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `razonSocial` VARCHAR(191) NULL,
    `nit` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `resolution` VARCHAR(191) NULL,
    `nextInvoiceNumber` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Persona` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `isTitular` BOOLEAN NOT NULL DEFAULT false,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Persona_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `categories` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `leadTimeDays` INTEGER NULL,
    `rating` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supply` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `costPerUnit` DECIMAL(12, 4) NOT NULL,
    `stock` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `supplierId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Supply_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSupply` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `supplyId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,

    INDEX `ProductSupply_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `type` ENUM('PROVEEDOR', 'NOMINA', 'CREDITO', 'OTRO') NOT NULL,
    `payeeType` ENUM('PROVEEDOR', 'EMPLEADO', 'OTRO') NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `payeeName` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `method` VARCHAR(191) NULL,
    `status` ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_storeId_idx`(`storeId`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierInvoice_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierInvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `supplyId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unitCost` DECIMAL(12, 4) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetEntry` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `BudgetEntry_storeId_month_idx`(`storeId`, `month`),
    UNIQUE INDEX `BudgetEntry_storeId_month_productName_key`(`storeId`, `month`, `productName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CustomerAddress_personaId_idx` ON `CustomerAddress`(`personaId`);

-- CreateIndex
CREATE INDEX `CustomerSpecialDate_personaId_idx` ON `CustomerSpecialDate`(`personaId`);

-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_deliveryPersonId_idx` ON `Order`(`deliveryPersonId`);

-- CreateIndex
CREATE INDEX `Product_groupId_idx` ON `Product`(`groupId`);

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_jornadaId_fkey` FOREIGN KEY (`jornadaId`) REFERENCES `Jornada`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Persona` ADD CONSTRAINT `Persona_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSpecialDate` ADD CONSTRAINT `CustomerSpecialDate_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supply` ADD CONSTRAINT `Supply_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supply` ADD CONSTRAINT `Supply_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSupply` ADD CONSTRAINT `ProductSupply_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSupply` ADD CONSTRAINT `ProductSupply_supplyId_fkey` FOREIGN KEY (`supplyId`) REFERENCES `Supply`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_recipientPersonaId_fkey` FOREIGN KEY (`recipientPersonaId`) REFERENCES `Persona`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_deliveryPersonId_fkey` FOREIGN KEY (`deliveryPersonId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoiceItem` ADD CONSTRAINT `SupplierInvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `SupplierInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoiceItem` ADD CONSTRAINT `SupplierInvoiceItem_supplyId_fkey` FOREIGN KEY (`supplyId`) REFERENCES `Supply`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetEntry` ADD CONSTRAINT `BudgetEntry_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

