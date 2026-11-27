#!/usr/bin/env node
/**
 * RTL codemod: rewrites physical Tailwind direction classes to logical ones
 * (PRD §10.2) so Untitled UI components mirror correctly under dir="rtl".
 *
 *   node scripts/rtl-codemod.mjs <dir> [--check]
 *
 * --check only reports remaining physical classes and exits 1 if any exist.
 *
 * Kept physical on purpose:
 *   left-1/2 / right-1/2   (always paired with -translate-x-1/2 for centering;
 *                           converting would break centering in RTL)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const checkOnly = process.argv.includes("--check");
if (!dir) {
    console.error("usage: rtl-codemod.mjs <dir> [--check]");
    process.exit(2);
}

// A class token starts after one of these characters (start of string, whitespace,
// quotes, template backtick, variant colon, important "!", or "(" / "{" in cx() calls).
const B = String.raw`(?<=^|[\s"'\`:!({])`;
// Tailwind value after "<utility>-": number, fraction, arbitrary [..], keyword, or css var (..)
const VAL = String.raw`(?:\d[\w./]*|\[[^\]\s]*\]|\([^)\s]*\)|px|auto|full|none|inherit|xs|sm|md|lg|xl|2xl|3xl|4xl)`;

/** [regex, replacement] pairs. `$1` = optional leading "-" (negative value). */
const RULES = [
    // padding / margin / scroll padding / scroll margin
    [new RegExp(`${B}(-?)pl-(?=${VAL}(?![\\w-]))`, "g"), "$1ps-"],
    [new RegExp(`${B}(-?)pr-(?=${VAL}(?![\\w-]))`, "g"), "$1pe-"],
    [new RegExp(`${B}(-?)ml-(?=${VAL}(?![\\w-]))`, "g"), "$1ms-"],
    [new RegExp(`${B}(-?)mr-(?=${VAL}(?![\\w-]))`, "g"), "$1me-"],
    [new RegExp(`${B}(-?)scroll-pl-(?=${VAL})`, "g"), "$1scroll-ps-"],
    [new RegExp(`${B}(-?)scroll-pr-(?=${VAL})`, "g"), "$1scroll-pe-"],
    [new RegExp(`${B}(-?)scroll-ml-(?=${VAL})`, "g"), "$1scroll-ms-"],
    [new RegExp(`${B}(-?)scroll-mr-(?=${VAL})`, "g"), "$1scroll-me-"],
    // inset (skip the 1/2 centering idiom)
    [new RegExp(`${B}(-?)left-(?!1/2)(?=${VAL}(?![\\w-]))`, "g"), "$1start-"],
    [new RegExp(`${B}(-?)right-(?!1/2)(?=${VAL}(?![\\w-]))`, "g"), "$1end-"],
    // border width / color on one side
    [new RegExp(`${B}border-l(?=-|(?![\\w-]))`, "g"), "border-s"],
    [new RegExp(`${B}border-r(?=-|(?![\\w-]))`, "g"), "border-e"],
    // radius
    [new RegExp(`${B}rounded-tl(?=-|(?![\\w-]))`, "g"), "rounded-ss"],
    [new RegExp(`${B}rounded-tr(?=-|(?![\\w-]))`, "g"), "rounded-se"],
    [new RegExp(`${B}rounded-bl(?=-|(?![\\w-]))`, "g"), "rounded-es"],
    [new RegExp(`${B}rounded-br(?=-|(?![\\w-]))`, "g"), "rounded-ee"],
    [new RegExp(`${B}rounded-l(?=-|(?![\\w-]))`, "g"), "rounded-s"],
    [new RegExp(`${B}rounded-r(?=-|(?![\\w-]))`, "g"), "rounded-e"],
    // text alignment
    [new RegExp(`${B}text-left(?![\\w-])`, "g"), "text-start"],
    [new RegExp(`${B}text-right(?![\\w-])`, "g"), "text-end"],
];

/** Used by --check and for the before/after counts. */
const PHYSICAL = new RegExp(
    `${B}-?(?:pl|pr|ml|mr|scroll-pl|scroll-pr|scroll-ml|scroll-mr)-${VAL}(?![\\w-])` +
        `|${B}-?(?:left|right)-(?!1/2)${VAL}(?![\\w-])` +
        `|${B}(?:border-l|border-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|rounded-l|rounded-r)(?=-|(?![\\w-]))` +
        `|${B}text-(?:left|right)(?![\\w-])`,
    "g",
);

function walk(path, out = []) {
    for (const name of readdirSync(path)) {
        const p = join(path, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(tsx?|jsx?|css)$/.test(name)) out.push(p);
    }
    return out;
}

const files = walk(dir);
let before = 0;
let after = 0;
const leftovers = [];
for (const file of files) {
    const src = readFileSync(file, "utf8");
    before += (src.match(PHYSICAL) ?? []).length;
    let next = src;
    if (!checkOnly) for (const [re, rep] of RULES) next = next.replace(re, rep);
    const rest = next.match(PHYSICAL) ?? [];
    after += rest.length;
    if (rest.length) leftovers.push(`${file}: ${rest.join(" ")}`);
    if (!checkOnly && next !== src) writeFileSync(file, next);
}

console.log(`files scanned: ${files.length}`);
console.log(`physical direction classes before: ${before}`);
console.log(`physical direction classes after:  ${after}`);
if (leftovers.length) {
    console.log(leftovers.join("\n"));
    process.exit(1);
}
