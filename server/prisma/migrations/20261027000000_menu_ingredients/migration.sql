-- Optional, display-only ingredient list for menu items (e.g. "Chicken, cheese, lettuce").
-- Independent of inventory: deduction still comes only from linked inventory items (RecipeItem).

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "ingredients" TEXT NOT NULL DEFAULT '';
