// Utility function to split the input line by commas that are not inside quotes or parentheses
export function splitByCommaOutsideQuotes(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ',' && !inQuotes && parenDepth === 0) {
      // Split point
      result.push(current.trim());
      current = '';
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