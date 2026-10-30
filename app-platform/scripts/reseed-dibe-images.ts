/**
 * Delete draw-it-by-ear protocol_images rows and re-insert with filename-only paths.
 * Run from app-platform: npx tsx scripts/reseed-dibe-images.ts
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json, ProtocolImageInsert } from "../lib/types/database";

config({ path: resolve(process.cwd(), ".env.local") });

const PROTOCOL_SLUG = "draw-it-by-ear";

const IMAGES: { name: string; image_path: string; criteria: Json }[] = [
  {
    name: "RoboDoc",
    image_path: "RoboDoc.png",
    criteria: [
      { text: "The robot doctor has a headband", points: 1 },
      { text: "Neither of the man's feet are visible", points: 1 },
      { text: "The robot dog has four wheels", points: 1 },
      { text: "There is some hair on the man's head", points: 1 },
      { text: "The robot dog has both a tail and an antenna", points: 1 },
      { text: "The robot dog is barking", points: 2 },
      { text: "There is some hair on the man's head", points: 2 },
      {
        text: "The top of the needle is higher than the top of the robot doctor's antenna",
        points: 3,
      },
      { text: "One of the robot doctor's eyes is bigger than the other", points: 3 },
      { text: "Exactly one of the patient's arms is visible", points: 3 },
    ],
  },
  {
    name: "HatMan",
    image_path: "HatMan.png",
    criteria: [
      { text: "Hat man has exactly 5 hats", points: 1 },
      { text: "Hat man is wearing a bow tie", points: 1 },
      { text: "Hat man is smiling", points: 1 },
      { text: "The man's nose is not visible", points: 1 },
      { text: "The bottom of the leaf is the lowest item in the drawing", points: 1 },
      { text: "There are 2 pockets on the man's jacket", points: 2 },
      { text: "There are exactly 3 buttons on the jacket", points: 2 },
      {
        text: "The top of the stump is lower than the lowest button on the jacket",
        points: 2,
      },
      { text: "There is spiral or circular wood grain on the tree stump", points: 3 },
      { text: "The hats on his hands are higher than the hat on his head", points: 3 },
    ],
  },
  {
    name: "Working Out",
    image_path: "Working Out.png",
    criteria: [
      { text: "All people are wearing shoes that have no laces", points: 1 },
      { text: "There are two winged insects in the scene", points: 1 },
      { text: "No more than 1 person has hair on their head", points: 1 },
      { text: "The leftmost person in the scene is not holding anything", points: 1 },
      {
        text: "The word Gym is closer to the top of the scene than any of the people",
        points: 1,
      },
      { text: "None of the people have ears", points: 2 },
      {
        text: "All of the people in the drawing have their hands above their noses",
        points: 2,
      },
      { text: "At least one of the people is frowning", points: 2 },
      {
        text: "One person is holding a barbell with weights that are below his waist",
        points: 3,
      },
      {
        text: "There are exactly two drops of sweat next to but not touching one of the people's heads",
        points: 3,
      },
    ],
  },
  {
    name: "Dropping In For Lunch",
    image_path: "Dropping In For Lunch.png",
    criteria: [
      { text: "The bird is holding exactly 2 balloons", points: 1 },
      { text: "The alligator is wearing sunglasses", points: 1 },
      { text: "There is a straw in the cup", points: 1 },
      { text: "The alligator is lying on a blanket", points: 1 },
      { text: "The sun is to the right of the bird", points: 1 },
      { text: "The alligator's teeth are visible", points: 2 },
      { text: "The bird's mouth is open", points: 2 },
      { text: "There are tears visible around the bird's face", points: 2 },
      { text: "There are stripes on the cup next to the alligator", points: 3 },
      { text: "There are at least six rays emanating from the sun", points: 3 },
    ],
  },
  {
    name: "Mountain Hike",
    image_path: "Mountain Hike.png",
    criteria: [
      { text: "The man has a hat on his head", points: 1 },
      { text: "The man is facing to the left side of the drawing", points: 1 },
      { text: "The man's travel pack has a wheel visible on it", points: 1 },
      { text: "There are at least two windows on the car", points: 1 },
      { text: "The car has balloons for wheels with strings visible", points: 1 },
      { text: "There are at least three stones in the scene", points: 2 },
      { text: "The top of the car is higher than the top of the sun", points: 2 },
      { text: "The man's coat has at least one pocket", points: 2 },
      { text: "The wheel on the travel pack is larger than the sun", points: 3 },
      { text: "There are exactly five clouds in the sky", points: 3 },
    ],
  },
  {
    name: "PastaToGo",
    image_path: "PastaToGo.png",
    criteria: [
      { text: "The man's pupils are not visible", points: 1 },
      { text: "The man is wearing a bow tie", points: 1 },
      { text: "Exactly one of the man's ears is visible", points: 1 },
      { text: "There is an upper case letter E in the scene", points: 1 },
      { text: "The letter V is below the letter L", points: 1 },
      {
        text: "There are at least four lines representing steam or heat rising from the pasta",
        points: 2,
      },
      { text: "There are at least 3 coils in the telephone cord", points: 2 },
      { text: "The bottle of wine is further to the left than the phone", points: 2 },
      {
        text: "Pasta makes contact with the phone at a point that is above and to the right of the bowl",
        points: 3,
      },
      { text: "At least four buttons are visible on the man's coat", points: 3 },
    ],
  },
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key);

  const { error: deleteError } = await supabase
    .from("protocol_images")
    .delete()
    .eq("protocol_slug", PROTOCOL_SLUG);

  if (deleteError) {
    console.error("delete protocol_images:", deleteError.message);
    process.exit(1);
  }

  const rows: ProtocolImageInsert[] = IMAGES.map((img) => ({
    protocol_slug: PROTOCOL_SLUG,
    name: img.name,
    image_path: img.image_path,
    criteria: img.criteria,
  }));

  const { data, error: insertError } = await supabase
    .from("protocol_images")
    .insert(rows)
    .select("id, name, image_path");

  if (insertError) {
    console.error("insert protocol_images:", insertError.message);
    process.exit(1);
  }

  console.log(`Deleted and re-inserted ${data?.length ?? 0} draw-it-by-ear images:`);
  for (const row of data ?? []) {
    console.log(`  - ${row.name} → ${row.image_path} (${row.id})`);
  }
}

void main();
