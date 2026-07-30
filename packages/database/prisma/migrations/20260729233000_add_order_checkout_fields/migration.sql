ALTER TABLE "Order"
ADD COLUMN "deliveryAddress" VARCHAR(500),
ADD COLUMN "idempotencyKey" VARCHAR(64);

CREATE UNIQUE INDEX "Order_idempotencyKey_key"
ON "Order"("idempotencyKey");
