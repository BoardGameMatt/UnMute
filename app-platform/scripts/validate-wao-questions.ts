/**
 * Wrong Answers Only question library validator.
 * Run from app-platform: npm run validate:wao [path-to-json]
 *
 * Reads the JSON library and reports every rule violation it finds.
 * Never connects to a database and never writes anything.
 *
 * Normative question design (structure, verification, shipping checklist):
 * docs/protocols/wao-question-contract-v1.md
 * This script enforces the machine-checkable subset of that contract.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_LIBRARY_PATH = "supabase/seed-data/wao-questions.json";

const REGION_TAGS = ["us", "intl", "global"];
const TRAP_TIERS = ["gimme", "graded", "trap"];
const ITEMS_PER_QUESTION = 10;
const MIN_GIMMES = 2;
const MIN_TRAPS = 2;
const MIN_CORRECT_COUNT = 1;
const MAX_CORRECT_COUNT = 5;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;
const RULE_MAX_LENGTH = 140;

interface Failure {
  question: string;
  item: string | null;
  message: string;
}

const failures: Failure[] = [];

function fail(question: string, item: string | null, message: string): void {
  failures.push({ question, item, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function itemName(item: unknown, index: number): string {
  if (isRecord(item) && typeof item.label === "string" && item.label.trim() !== "") {
    return item.label;
  }
  return `item #${index + 1}`;
}

function validateItem(
  item: unknown,
  index: number,
  questionName: string,
  questionIsActive: boolean
): void {
  const name = itemName(item, index);

  if (!isRecord(item)) {
    fail(questionName, name, "item is not an object");
    return;
  }

  if (typeof item.label !== "string" || item.label.trim() === "") {
    fail(questionName, name, "label is missing or empty");
  }

  if (typeof item.is_correct !== "boolean") {
    fail(questionName, name, "is_correct is missing or not a boolean");
  }

  if (typeof item.trap_tier !== "string" || !TRAP_TIERS.includes(item.trap_tier)) {
    fail(
      questionName,
      name,
      `trap_tier is ${JSON.stringify(item.trap_tier)}, must be one of ${TRAP_TIERS.join(", ")}`
    );
  }

  for (const field of ["source_1_url", "source_1_note", "source_2_url", "source_2_note"]) {
    if (!(field in item)) {
      fail(questionName, name, `${field} is missing (use null when unverified)`);
    } else if (!isNullableString(item[field])) {
      fail(questionName, name, `${field} must be a string or null`);
    }
  }

  if (questionIsActive && (item.source_1_url === null || item.source_2_url === null)) {
    fail(
      questionName,
      name,
      "question is active but this item is missing source_1_url or source_2_url"
    );
  }
}

function validateQuestion(question: unknown, index: number): void {
  const questionName =
    isRecord(question) && typeof question.category_title === "string" && question.category_title.trim() !== ""
      ? question.category_title
      : `question #${index + 1}`;

  if (!isRecord(question)) {
    fail(questionName, null, "question is not an object");
    return;
  }

  if (typeof question.category_title !== "string" || question.category_title.trim() === "") {
    fail(questionName, null, "category_title is missing or empty");
  }

  if (typeof question.disambiguation_rule !== "string" || question.disambiguation_rule.trim() === "") {
    fail(questionName, null, "disambiguation_rule is missing or empty");
  } else if (question.disambiguation_rule.length > RULE_MAX_LENGTH) {
    fail(
      questionName,
      null,
      `disambiguation_rule is ${question.disambiguation_rule.length} characters, limit is ${RULE_MAX_LENGTH}`
    );
  }

  if (!isNullableString(question.disambiguation_detail)) {
    fail(questionName, null, "disambiguation_detail must be a string or null");
  }

  if (typeof question.region_tag !== "string" || !REGION_TAGS.includes(question.region_tag)) {
    fail(
      questionName,
      null,
      `region_tag is ${JSON.stringify(question.region_tag)}, must be one of ${REGION_TAGS.join(", ")}`
    );
  }

  if (!isInteger(question.difficulty) || question.difficulty < MIN_DIFFICULTY || question.difficulty > MAX_DIFFICULTY) {
    fail(
      questionName,
      null,
      `difficulty is ${JSON.stringify(question.difficulty)}, must be an integer ${MIN_DIFFICULTY} to ${MAX_DIFFICULTY}`
    );
  }

  if (typeof question.pinned !== "boolean") {
    fail(questionName, null, "pinned is missing or not a boolean");
  }

  const isActive = question.active === true;
  if (typeof question.active !== "boolean") {
    fail(questionName, null, "active is missing or not a boolean");
  }

  const correctCountIsValid =
    isInteger(question.correct_count) &&
    question.correct_count >= MIN_CORRECT_COUNT &&
    question.correct_count <= MAX_CORRECT_COUNT;

  if (!correctCountIsValid) {
    fail(
      questionName,
      null,
      `correct_count is ${JSON.stringify(question.correct_count)}, must be an integer ${MIN_CORRECT_COUNT} to ${MAX_CORRECT_COUNT}`
    );
  }

  if (!Array.isArray(question.items)) {
    fail(questionName, null, "items is missing or not an array");
    return;
  }

  const items = question.items;

  if (items.length !== ITEMS_PER_QUESTION) {
    fail(questionName, null, `has ${items.length} items, must have exactly ${ITEMS_PER_QUESTION}`);
  }

  items.forEach((item, itemIndex) => {
    validateItem(item, itemIndex, questionName, isActive);
  });

  const seenLabels = new Map<string, number>();
  for (const [itemIndex, item] of items.entries()) {
    if (!isRecord(item) || typeof item.label !== "string") continue;
    const key = item.label.trim().toLowerCase();
    const firstIndex = seenLabels.get(key);
    if (firstIndex === undefined) {
      seenLabels.set(key, itemIndex);
    } else {
      fail(
        questionName,
        item.label,
        `duplicate label, already used by item #${firstIndex + 1}`
      );
    }
  }

  const records = items.filter(isRecord);
  const correctItems = records.filter((item) => item.is_correct === true).length;
  const gimmes = records.filter((item) => item.trap_tier === "gimme").length;
  const traps = records.filter((item) => item.trap_tier === "trap").length;

  if (correctCountIsValid && question.correct_count !== correctItems) {
    fail(
      questionName,
      null,
      `correct_count is ${question.correct_count} but ${correctItems} items are marked is_correct`
    );
  }

  if (gimmes < MIN_GIMMES) {
    fail(questionName, null, `has ${gimmes} gimme items, needs at least ${MIN_GIMMES}`);
  }

  if (traps < MIN_TRAPS) {
    fail(questionName, null, `has ${traps} trap items, needs at least ${MIN_TRAPS}`);
  }
}

function main(): void {
  const pathArg = process.argv[2] ?? DEFAULT_LIBRARY_PATH;
  const libraryPath = resolve(process.cwd(), pathArg);

  let raw: string;
  try {
    raw = readFileSync(libraryPath, "utf8");
  } catch {
    console.error(`Could not read ${libraryPath}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`${libraryPath} is not valid JSON: ${(error as Error).message}`);
    process.exit(1);
  }

  if (!isRecord(parsed)) {
    console.error(`${libraryPath} must contain a JSON object at the top level`);
    process.exit(1);
  }

  if (!isInteger(parsed.schema_version)) {
    fail("(file)", null, "schema_version is missing or not an integer");
  }

  if (!Array.isArray(parsed.questions)) {
    console.error("questions is missing or not an array");
    process.exit(1);
  }

  const questions = parsed.questions;
  questions.forEach(validateQuestion);

  const titles = new Map<string, number>();
  for (const [index, question] of questions.entries()) {
    if (!isRecord(question) || typeof question.category_title !== "string") continue;
    const key = question.category_title.trim().toLowerCase();
    const firstIndex = titles.get(key);
    if (firstIndex === undefined) {
      titles.set(key, index);
    } else {
      fail(
        question.category_title,
        null,
        `duplicate category_title, already used by question #${firstIndex + 1}`
      );
    }
  }

  console.log(`Validated ${questions.length} questions in ${pathArg}`);

  if (failures.length === 0) {
    console.log("No failures.");
    return;
  }

  console.log("");
  for (const failure of failures) {
    const where = failure.item === null ? failure.question : `${failure.question} → ${failure.item}`;
    console.log(`FAIL  ${where}: ${failure.message}`);
  }
  console.log("");
  console.error(`${failures.length} failure${failures.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

main();
