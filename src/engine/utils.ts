/**
 * Parses import and export statements from the provided JavaScript code.
 * This function extracts module names from both import and export statements,
 * returning a unique list of module names used in the code.
 * @param code - The JavaScript code to parse.
 * @returns An array of unique module names imported or exported in the code.
 */
export function parseModuleDeps(code: string): string[] {
  const moduleRegex = /(?:import|export)\s+(?:(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|[\w$]+)\s+from\s+|(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  const modules = new Set<string>();
  let match;
  
  while ((match = moduleRegex.exec(code)) !== null) {
    modules.add(match[1]);
  }
  
  return Array.from(modules);
}