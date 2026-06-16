CREATE TABLE IF NOT EXISTS "User" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Profile" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL UNIQUE,
  "age" INTEGER NOT NULL,
  "gender" TEXT NOT NULL,
  "weight_kg" DOUBLE PRECISION NOT NULL,
  "height_cm" DOUBLE PRECISION NOT NULL,
  "activity_level" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "tdee" INTEGER NOT NULL,
  "protein_target" INTEGER NOT NULL,
  CONSTRAINT "Profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "FoodLog" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "food_name" TEXT NOT NULL,
  "calories" INTEGER NOT NULL,
  "protein_g" INTEGER NOT NULL,
  "meal_type" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ExerciseLog" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "exercise_name" TEXT NOT NULL,
  "duration_mins" INTEGER NOT NULL,
  "calories_burned" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "user_id" INTEGER PRIMARY KEY,
  "data_retention" TEXT NOT NULL DEFAULT 'forever',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
