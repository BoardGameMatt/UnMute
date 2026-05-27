import type { IKWYMStimulusCategory } from "./types";

export const OPEN_PROMPTS: string[] = [
  "How are you showing up today?",
  "Describe last week in one word",
  "How are you expecting this week to go?",
  "What's your energy level right now?",
  "If today were a weather pattern, what would it be?",
];

export const STIMULUS_CATEGORIES: IKWYMStimulusCategory[] = [
  { label: "Pop culture", prompt: "Name a pop culture figure" },
  { label: "Historical", prompt: "Name a historical figure" },
  { label: "Animal", prompt: "Name an animal" },
  { label: "Movie character", prompt: "Name a movie character" },
  { label: "Food", prompt: "Name a food" },
  { label: "TV character", prompt: "Name a TV show character" },
];
