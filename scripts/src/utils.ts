// Utility function to split by commas that are not inside quotes
export function splitByCommaOutsideQuotes(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      // Split point
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Push the last token if present
  if (current) {
    result.push(current.trim());
  }

  return result;
}
