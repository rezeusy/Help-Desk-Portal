CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(64) NOT NULL,
	`itemId` varchar(64),
	`itemName` varchar(255),
	`locationId` varchar(64),
	`locationName` varchar(255),
	`quantityDelta` int,
	`quantityBefore` int,
	`quantityAfter` int,
	`actorId` int,
	`actorName` varchar(255),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
