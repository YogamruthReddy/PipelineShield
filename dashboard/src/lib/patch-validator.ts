/**
 * PipelineShield In-Memory Patch Validation Engine
 *
 * Validates unified diff patch syntax and executes dry-run patch application
 * strictly in-memory without modifying any files on disk or in Git.
 *
 * Invariants:
 * - Zero Disk I/O: Never touches the filesystem or calls Git CLI.
 * - Deterministic parsing: Checks standard Unified Diff format (---, +++, @@ -x,y +a,b @@).
 * - Context verification: Verifies that context and removal lines match base file content.
 */

export interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[]; // Lines including prefix ' ', '+', '-'
}

export interface PatchValidationResult {
  isValidDiff: boolean;
  appliesCleanly: boolean;
  valid?: boolean;
  targetFile?: string;
  addedLinesCount: number;
  removedLinesCount: number;
  hunksCount: number;
  transformedContent?: string;
  patchedContent?: string;
  diff?: string;
  failureReason?: string;
  [key: string]: unknown;
}

/**
 * Parse a unified diff string into structured hunks and file metadata
 */
export function parseUnifiedDiff(rawPatch: string): {
  targetFile?: string;
  hunks: PatchHunk[];
  addedCount: number;
  removedCount: number;
  isValid: boolean;
  parseError?: string;
} {
  const lines = rawPatch.replace(/\r\n/g, "\n").split("\n");
  let targetFile: string | undefined;
  const hunks: PatchHunk[] = [];
  let currentHunk: PatchHunk | null = null;
  let addedCount = 0;
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check header lines: +++ b/path/to/file or +++ path/to/file
    if (line.startsWith("+++ ")) {
      const pathPart = line.slice(4).trim();
      targetFile = pathPart.replace(/^[ab]\//, "");
      continue;
    }
    if (line.startsWith("--- ")) {
      if (!targetFile) {
        const pathPart = line.slice(4).trim();
        targetFile = pathPart.replace(/^[ab]\//, "");
      }
      continue;
    }

    // Check hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkHeaderMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: parseInt(hunkHeaderMatch[1], 10),
        oldCount: hunkHeaderMatch[2] !== undefined ? parseInt(hunkHeaderMatch[2], 10) : 1,
        newStart: parseInt(hunkHeaderMatch[3], 10),
        newCount: hunkHeaderMatch[4] !== undefined ? parseInt(hunkHeaderMatch[4], 10) : 1,
        lines: [],
      };
      continue;
    }

    if (currentHunk) {
      if (line.startsWith("+")) {
        addedCount++;
        currentHunk.lines.push(line);
      } else if (line.startsWith("-")) {
        removedCount++;
        currentHunk.lines.push(line);
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push(line);
      } else if (line === "") {
        // Only treat empty line as context line if the hunk has not yet satisfied its oldCount
        // and this is not a trailing newline at the end of the diff or hunk.
        const currentContextAndRemoved = currentHunk.lines.filter(
          (l) => l.startsWith(" ") || l.startsWith("-")
        ).length;
        if (currentContextAndRemoved < currentHunk.oldCount && i < lines.length - 1) {
          currentHunk.lines.push(" ");
        }
      } else if (line.startsWith("\\ No newline at end of file")) {
        // Ignored in diff
      } else {
        // Line does not conform to hunk line syntax
        // If we haven't read any hunk lines, it might be a header or comment
        if (currentHunk.lines.length === 0) {
          continue;
        }
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  if (hunks.length === 0) {
    return {
      targetFile,
      hunks: [],
      addedCount: 0,
      removedCount: 0,
      isValid: false,
      parseError: "No valid unified diff hunk headers (@@ -start,count +start,count @@) found in patch.",
    };
  }

  return {
    targetFile,
    hunks,
    addedCount,
    removedCount,
    isValid: true,
  };
}

/**
 * Dry-run apply a unified diff to base content strictly in-memory.
 */
export function dryRunApplyPatch(
  baseContent: string | null | undefined,
  rawPatch: string
): PatchValidationResult {
  const parsed = parseUnifiedDiff(rawPatch);

  if (!parsed.isValid) {
    return {
      isValidDiff: false,
      appliesCleanly: false,
      valid: false,
      targetFile: parsed.targetFile,
      addedLinesCount: 0,
      removedLinesCount: 0,
      hunksCount: 0,
      failureReason: parsed.parseError || "Invalid patch syntax.",
    };
  }

  if (baseContent === undefined || baseContent === null) {
    return {
      isValidDiff: true,
      appliesCleanly: false,
      valid: false,
      targetFile: parsed.targetFile,
      addedLinesCount: parsed.addedCount,
      removedLinesCount: parsed.removedCount,
      hunksCount: parsed.hunks.length,
      failureReason: "Base file content was not supplied; patch structure is syntactically valid but unverified against source.",
    };
  }

  const baseLines = baseContent.replace(/\r\n/g, "\n").split("\n");
  const outputLines: string[] = [];
  let baseIndex = 0; // 0-based index into baseLines

  for (const hunk of parsed.hunks) {
    // Determine expected start index (1-based oldStart)
    const targetBaseIndex = Math.max(0, hunk.oldStart - 1);

    if (targetBaseIndex > baseLines.length) {
      return {
        isValidDiff: true,
        appliesCleanly: false,
        valid: false,
        targetFile: parsed.targetFile,
        addedLinesCount: parsed.addedCount,
        removedLinesCount: parsed.removedCount,
        hunksCount: parsed.hunks.length,
        failureReason: `Hunk target line ${hunk.oldStart} exceeds base content line count (${baseLines.length}).`,
      };
    }

    // If targetBaseIndex is beyond current baseIndex, copy intervening lines
    while (baseIndex < targetBaseIndex && baseIndex < baseLines.length) {
      outputLines.push(baseLines[baseIndex]);
      baseIndex++;
    }

    // Now process hunk lines
    for (const hunkLine of hunk.lines) {
      const prefix = hunkLine[0];
      const content = hunkLine.slice(1);

      if (prefix === " ") {
        // Context line: must match current base line
        if (baseIndex < baseLines.length && baseLines[baseIndex].trim() === content.trim()) {
          outputLines.push(baseLines[baseIndex]);
          baseIndex++;
        } else {
          return {
            isValidDiff: true,
            appliesCleanly: false,
            valid: false,
            targetFile: parsed.targetFile,
            addedLinesCount: parsed.addedCount,
            removedLinesCount: parsed.removedCount,
            hunksCount: parsed.hunks.length,
            failureReason: `Context mismatch at line ${baseIndex + 1}: expected '${content}', found '${baseLines[baseIndex] || "EOF"}'.`,
          };
        }
      } else if (prefix === "-") {
        // Removed line: must match current base line
        if (baseIndex < baseLines.length && baseLines[baseIndex].trim() === content.trim()) {
          // Skip adding it to output
          baseIndex++;
        } else {
          return {
            isValidDiff: true,
            appliesCleanly: false,
            valid: false,
            targetFile: parsed.targetFile,
            addedLinesCount: parsed.addedCount,
            removedLinesCount: parsed.removedCount,
            hunksCount: parsed.hunks.length,
            failureReason: `Removal line mismatch at line ${baseIndex + 1}: expected to remove '${content}', found '${baseLines[baseIndex] || "EOF"}'.`,
          };
        }
      } else if (prefix === "+") {
        // Added line: append directly to output
        outputLines.push(content);
      }
    }
  }

  // Copy any remaining lines after all hunks
  while (baseIndex < baseLines.length) {
    outputLines.push(baseLines[baseIndex]);
    baseIndex++;
  }

  const resultString = outputLines.join("\n");

  return {
    isValidDiff: true,
    appliesCleanly: true,
    valid: true,
    targetFile: parsed.targetFile,
    addedLinesCount: parsed.addedCount,
    removedLinesCount: parsed.removedCount,
    hunksCount: parsed.hunks.length,
    transformedContent: resultString,
    patchedContent: resultString,
    diff: rawPatch,
  };
}
