/**
 * @fileoverview MCP Prompts registration.
 * Reusable prompt templates for documentation workflows.
 *
 * @module mcp/prompts
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Helper Functions
// ============================================================

function getProjectRoot(): string {
  return process.cwd();
}

function readFileContent(filePath: string): string | null {
  const projectRoot = getProjectRoot();
  const absolutePath = path.resolve(projectRoot, filePath);

  try {
    return fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================
// Prompt Registration
// ============================================================

export function registerPrompts(server: McpServer): void {
  // --------------------------------------------------------
  // document - Generate documentation for a file
  // --------------------------------------------------------
  server.prompt(
    'document',
    'Generate comprehensive documentation for a file or module',
    {
      path: z.string().describe('File path to document'),
      style: z.enum(['jsdoc', 'tsdoc', 'markdown', 'comprehensive']).default('comprehensive').describe('Documentation style'),
      includeExamples: z.boolean().default(true).describe('Include usage examples'),
    },
    async ({ path: filePath, style, includeExamples }) => {
      const content = readFileContent(filePath);

      if (!content) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: Could not read file at ${filePath}` },
          }],
        };
      }

      const styleGuide = {
        jsdoc: 'Use JSDoc format with @param, @returns, @throws, @example tags',
        tsdoc: 'Use TSDoc format with @param, @returns, @throws, @example tags, prefer TypeScript-specific annotations',
        markdown: 'Generate a markdown file with sections for overview, API reference, examples, and notes',
        comprehensive: 'Generate both inline JSDoc/TSDoc comments AND a separate markdown overview',
      };

      const exampleInstruction = includeExamples
        ? 'Include practical, runnable code examples for each public function and class.'
        : 'Focus on descriptions without code examples.';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please generate documentation for the following file.

**File:** ${filePath}

**Style:** ${style}
${styleGuide[style]}

**Instructions:**
1. Analyze the code structure and identify all public APIs (exported functions, classes, interfaces, types)
2. For each symbol, write clear documentation explaining:
   - What it does (purpose)
   - How to use it (parameters, return values)
   - When to use it (use cases)
   - Edge cases or important notes
3. ${exampleInstruction}
4. If the code has complex logic, explain the algorithm or approach
5. Note any dependencies or requirements

**Code:**
\`\`\`typescript
${content}
\`\`\`

Generate the documentation now. Be thorough but concise. Focus on helping developers understand and use this code effectively.`,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------
  // explain - Explain how code works
  // --------------------------------------------------------
  server.prompt(
    'explain',
    'Explain how a piece of code or module works',
    {
      path: z.string().describe('File path to explain'),
      focus: z.enum(['architecture', 'algorithm', 'dataflow', 'api', 'all']).default('all').describe('What aspect to focus on'),
      audience: z.enum(['beginner', 'intermediate', 'expert']).default('intermediate').describe('Target audience level'),
    },
    async ({ path: filePath, focus, audience }) => {
      const content = readFileContent(filePath);

      if (!content) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: Could not read file at ${filePath}` },
          }],
        };
      }

      const focusInstructions = {
        architecture: 'Focus on the overall structure, design patterns used, and how components interact',
        algorithm: 'Focus on the algorithms and logic, explain the step-by-step process',
        dataflow: 'Focus on how data flows through the code, what gets transformed where',
        api: 'Focus on the public API surface, what functions/methods are exposed and how to use them',
        all: 'Cover architecture, key algorithms, data flow, and API in a balanced way',
      };

      const audienceStyle = {
        beginner: 'Use simple language, explain basic concepts, avoid jargon. Include analogies.',
        intermediate: 'Assume familiarity with the language and common patterns. Focus on the specifics.',
        expert: 'Be concise and technical. Focus on non-obvious design decisions and trade-offs.',
      };

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please explain how this code works.

**File:** ${filePath}

**Focus:** ${focus}
${focusInstructions[focus]}

**Audience:** ${audience}
${audienceStyle[audience]}

**Code:**
\`\`\`typescript
${content}
\`\`\`

Provide a clear explanation that helps the reader understand this code. Structure your response with:
1. **Overview** - What this module/file does at a high level
2. **Key Components** - The main parts and their responsibilities
3. **How It Works** - The flow and logic
4. **Important Details** - Gotchas, edge cases, or notable design decisions`,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------
  // audit - Documentation audit
  // --------------------------------------------------------
  server.prompt(
    'audit',
    'Audit documentation quality and completeness',
    {
      path: z.string().optional().describe('Specific file or directory to audit (default: entire project)'),
      checkQuality: z.boolean().default(true).describe('Check documentation quality, not just presence'),
    },
    async ({ path: targetPath, checkQuality }) => {
      const projectRoot = getProjectRoot();
      const target = targetPath || '.';

      const qualityChecks = checkQuality ? `
**Quality Checks:**
- Are descriptions clear and helpful (not just restating the function name)?
- Are parameters and return values properly documented?
- Are edge cases and error conditions noted?
- Are examples provided for complex functions?
- Is the documentation up-to-date with the code?
- Are there any TODOs or FIXMEs in documentation?` : '';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please audit the documentation in this project.

**Scope:** ${target}
**Project Root:** ${projectRoot}

**Audit Tasks:**
1. Use the \`docdocs_coverage_report\` tool to get current coverage
2. Use the \`docdocs_find_undocumented\` tool to find gaps
3. Use the \`docdocs_check_staleness\` tool to find stale docs
4. Use the \`docdocs_analyze_importance\` tool to prioritize
${qualityChecks}

**Expected Output:**
Provide a structured audit report with:

1. **Executive Summary**
   - Overall coverage percentage
   - Number of critical gaps
   - Top 3 priorities

2. **Coverage Analysis**
   - Files with lowest coverage
   - Undocumented public APIs
   - Missing entry point documentation

3. **Staleness Report**
   - Files with outdated documentation
   - Semantic changes since last doc update

4. **Prioritized Action Items**
   - Ordered list of what to document first
   - Estimated effort (small/medium/large)

5. **Recommendations**
   - Specific improvements for each priority item

Start by calling the analysis tools, then compile the audit report.`,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------
  // review - Review documentation quality
  // --------------------------------------------------------
  server.prompt(
    'review',
    'Review and improve existing documentation',
    {
      path: z.string().describe('File path with documentation to review'),
      strictness: z.enum(['lenient', 'standard', 'strict']).default('standard').describe('How strict the review should be'),
    },
    async ({ path: filePath, strictness }) => {
      const content = readFileContent(filePath);

      if (!content) {
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: `Error: Could not read file at ${filePath}` },
          }],
        };
      }

      const strictnessGuide = {
        lenient: 'Focus only on missing or incorrect documentation. Minor style issues are okay.',
        standard: 'Check for completeness, clarity, and basic style consistency. Flag significant issues.',
        strict: 'Apply full documentation standards. Check grammar, style, completeness, accuracy, and examples.',
      };

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review the documentation in this file and suggest improvements.

**File:** ${filePath}

**Strictness:** ${strictness}
${strictnessGuide[strictness]}

**Code:**
\`\`\`typescript
${content}
\`\`\`

**Review Checklist:**
1. **Completeness** - Are all public APIs documented?
2. **Accuracy** - Does the documentation match the actual behavior?
3. **Clarity** - Is it easy to understand?
4. **Examples** - Are there helpful examples?
5. **Consistency** - Is the style consistent throughout?

**Output Format:**
For each issue found, provide:
- Location (function/class name or line number)
- Issue type (missing/inaccurate/unclear/style)
- Current state (what's there now)
- Suggested fix (improved documentation)

Then provide a summary with:
- Overall documentation quality score (1-10)
- Top 3 improvements that would have the most impact`,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------
  // summarize - Generate module summary
  // --------------------------------------------------------
  server.prompt(
    'summarize',
    'Generate a concise summary of a module or directory',
    {
      path: z.string().describe('File or directory path to summarize'),
      format: z.enum(['paragraph', 'bullets', 'table']).default('bullets').describe('Output format'),
      maxLength: z.number().min(50).max(2000).default(500).describe('Maximum length in characters'),
    },
    async ({ path: targetPath, format, maxLength }) => {
      const content = readFileContent(targetPath);

      const formatInstructions = {
        paragraph: 'Write a flowing paragraph',
        bullets: 'Use bullet points for key features',
        table: 'Use a markdown table with columns: Component | Purpose | Key Methods',
      };

      if (!content) {
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Generate a summary for the directory or module at: ${targetPath}

Use the \`docdocs_get_symbols\` and \`docdocs_dependency_graph\` tools to analyze the contents, then write a summary.

**Format:** ${format}
${formatInstructions[format]}

**Max Length:** ${maxLength} characters

The summary should answer:
- What is this module/directory for?
- What are the main components?
- How does it fit into the larger project?`,
            },
          }],
        };
      }

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate a concise summary of this module.

**File:** ${targetPath}

**Format:** ${format}
${formatInstructions[format]}

**Max Length:** ${maxLength} characters

**Code:**
\`\`\`typescript
${content.slice(0, 5000)}${content.length > 5000 ? '\n// ... truncated ...' : ''}
\`\`\`

Write a summary that captures:
- The module's purpose
- Key exports and their roles
- Dependencies and relationships
- Usage context (when/why to use this module)`,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------
  // changelog - Generate changelog from code changes
  // --------------------------------------------------------
  server.prompt(
    'changelog',
    'Generate changelog entries for recent code changes',
    {
      since: z.string().optional().describe('Git ref or date to start from (e.g., "v1.0.0", "2024-01-01")'),
      format: z.enum(['keepachangelog', 'conventional', 'simple']).default('keepachangelog').describe('Changelog format'),
    },
    async ({ since, format }) => {
      const formatGuide = {
        keepachangelog: 'Use Keep a Changelog format with sections: Added, Changed, Deprecated, Removed, Fixed, Security',
        conventional: 'Use Conventional Commits format: feat:, fix:, docs:, refactor:, etc.',
        simple: 'Simple bullet list of changes',
      };

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate changelog entries for recent code changes.

**Since:** ${since || 'last release or recent commits'}
**Format:** ${format}
${formatGuide[format]}

**Instructions:**
1. Use the \`docdocs_check_staleness\` tool to find files with recent changes
2. Analyze the semantic changes (new functions, modified interfaces, etc.)
3. Group changes by category (features, fixes, breaking changes)
4. Write clear, user-focused changelog entries

**Guidelines:**
- Focus on user-visible changes, not internal refactoring
- Highlight breaking changes prominently
- Include migration notes for breaking changes
- Reference issue/PR numbers if available

Generate the changelog entries now.`,
            },
          },
        ],
      };
    }
  );
}
