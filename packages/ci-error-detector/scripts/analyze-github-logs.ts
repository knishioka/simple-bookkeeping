#!/usr/bin/env node

/**
 * GitHub CI Log Analyzer
 *
 * This script fetches CI logs from GitHub Actions and analyzes them
 * using the CI Error Detector.
 *
 * Usage:
 *   ./analyze-github-logs.ts --repo owner/repo --run-id 123456
 *   ./analyze-github-logs.ts --repo owner/repo --workflow "CI Pipeline"
 */

import { execFileSync } from 'child_process';

import { CIErrorClassifier, ErrorSeverity } from '../src';

interface GitHubRun {
  id: number;
  status: string;
  conclusion: string;
  name: string;
  html_url: string;
  created_at: string;
}

interface CLIOptions {
  repo?: string;
  runId?: string;
  workflow?: string;
  output?: 'console' | 'json' | 'markdown';
  verbose?: boolean;
}

class GitHubLogAnalyzer {
  private classifier: CIErrorClassifier;

  constructor() {
    this.classifier = new CIErrorClassifier(undefined, {
      includeContext: true,
      minConfidence: 0.4,
      deduplication: true,
    });
  }

  /**
   * Validate repository format
   */
  private validateRepo(repo: string): void {
    const repoPattern = /^[\w-]+\/[\w.-]+$/;
    if (!repoPattern.test(repo)) {
      throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
    }
  }

  /**
   * Fetch failed runs from GitHub
   */
  async fetchFailedRuns(repo: string, workflow?: string): Promise<GitHubRun[]> {
    this.validateRepo(repo);

    try {
      const args = [
        'run',
        'list',
        '--repo',
        repo,
        '--status',
        'failure',
        '--json',
        'id,status,conclusion,name,htmlUrl,createdAt',
        '--limit',
        '10',
      ];

      if (workflow) {
        args.push('--workflow', workflow);
      }

      const output = execFileSync('gh', args, { encoding: 'utf-8' });
      return JSON.parse(output);
    } catch (error) {
      console.error('Failed to fetch runs from GitHub:', error);
      return [];
    }
  }

  /**
   * Fetch logs for a specific run
   */
  async fetchRunLogs(repo: string, runId: string): Promise<string> {
    this.validateRepo(repo);

    // Validate run ID
    if (!/^\d+$/.test(runId)) {
      throw new Error('Invalid run ID. Must be a numeric value.');
    }

    try {
      console.log(`📥 Fetching logs for run ${runId}...`);
      const args = ['run', 'view', runId, '--repo', repo, '--log-failed'];
      return execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }); // 50MB buffer
    } catch (error) {
      console.error(`Failed to fetch logs for run ${runId}:`, error);
      return '';
    }
  }

  /**
   * Analyze logs and generate report
   */
  analyzeLogs(logs: string, options: CLIOptions) {
    const result = this.classifier.classify(logs);

    switch (options.output) {
      case 'json':
        this.outputJSON(result);
        break;
      case 'markdown':
        this.outputMarkdown(result);
        break;
      default:
        this.outputConsole(result, options.verbose);
    }
  }

  /**
   * Output results to console
   */
  private outputConsole(result: unknown, verbose = false) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 CI Error Analysis Report');
    console.log(`${'='.repeat(80)}\n`);

    // Summary
    console.log('📈 Summary:');
    console.log(`  Total errors: ${result.summary.total}`);
    console.log(`  Critical: ${result.summary.criticalCount}`);
    console.log(`  High: ${result.summary.highCount}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);

    // Categories
    console.log('📂 Error Categories:');
    Object.entries(result.summary.byCategory).forEach(([cat, count]) => {
      if ((count as number) > 0) {
        console.log(`  • ${cat}: ${count}`);
      }
    });
    console.log();

    // Top errors
    const criticalErrors = result.errors.filter(
      (e: unknown) =>
        (e as { severity: ErrorSeverity }).severity === ErrorSeverity.CRITICAL ||
        (e as { severity: ErrorSeverity }).severity === ErrorSeverity.HIGH
    );

    console.log(`🔴 Critical/High Priority Errors (${criticalErrors.length}):\n`);
    criticalErrors.slice(0, verbose ? 10 : 5).forEach((error: unknown, idx: number) => {
      console.log(`${idx + 1}. [${error.severity}] ${error.category}`);
      console.log(`   ${error.message}`);
      console.log(`   Confidence: ${(error.confidence * 100).toFixed(0)}%`);

      if (error.context.file) {
        console.log(`   Location: ${error.context.file}:${error.context.line || '?'}`);
      }

      if (error.suggestedFixes.length > 0) {
        console.log('   Suggested fixes:');
        error.suggestedFixes.slice(0, 3).forEach((fix: string) => {
          console.log(`     • ${fix}`);
        });
      }
      console.log();
    });

    if (!verbose && criticalErrors.length > 5) {
      console.log(`... and ${criticalErrors.length - 5} more errors`);
      console.log('Use --verbose to see all errors\n');
    }
  }

  /**
   * Output results as JSON
   */
  private outputJSON(result: unknown) {
    console.log(JSON.stringify(result, null, 2));
  }

  /**
   * Output results as Markdown
   */
  private outputMarkdown(result: unknown) {
    const md: string[] = [];

    md.push('# CI Error Analysis Report\n');
    md.push(`Generated: ${new Date().toISOString()}\n`);

    // Summary
    md.push('## Summary\n');
    md.push(`- **Total Errors**: ${result.summary.total}`);
    md.push(`- **Critical**: ${result.summary.criticalCount}`);
    md.push(`- **High Priority**: ${result.summary.highCount}`);
    md.push(`- **Overall Confidence**: ${(result.confidence * 100).toFixed(1)}%\n`);

    // Categories
    md.push('## Error Categories\n');
    md.push('| Category | Count |');
    md.push('|----------|-------|');
    Object.entries(result.summary.byCategory).forEach(([cat, count]) => {
      if ((count as number) > 0) {
        md.push(`| ${cat} | ${count} |`);
      }
    });
    md.push('');

    // Errors
    md.push('## Detailed Errors\n');
    result.errors.slice(0, 20).forEach((error: unknown, idx: number) => {
      md.push(`### ${idx + 1}. ${error.message}\n`);
      md.push(`- **Severity**: ${error.severity}`);
      md.push(`- **Category**: ${error.category}`);
      md.push(`- **Confidence**: ${(error.confidence * 100).toFixed(0)}%`);

      if (error.context.file) {
        md.push(`- **Location**: \`${error.context.file}:${error.context.line || '?'}\``);
      }

      if (error.suggestedFixes.length > 0) {
        md.push('\n**Suggested Fixes:**');
        error.suggestedFixes.forEach((fix: string) => {
          md.push(`- ${fix}`);
        });
      }

      md.push('\n---\n');
    });

    console.log(md.join('\n'));
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    output: 'console',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--repo':
      case '-r':
        options.repo = args[++i];
        break;
      case '--run-id':
      case '--run':
        options.runId = args[++i];
        break;
      case '--workflow':
      case '-w':
        options.workflow = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i] as 'console' | 'json' | 'markdown';
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
GitHub CI Log Analyzer

Usage:
  analyze-github-logs.ts [options]

Options:
  --repo, -r <owner/repo>    GitHub repository
  --run-id, --run <id>       Specific run ID to analyze
  --workflow, -w <name>      Filter by workflow name
  --output, -o <format>      Output format: console, json, markdown (default: console)
  --verbose, -v              Show more detailed output
  --help, -h                 Show this help message

Examples:
  # Analyze latest failed runs
  ./analyze-github-logs.ts --repo myorg/myrepo

  # Analyze specific run
  ./analyze-github-logs.ts --repo myorg/myrepo --run-id 123456

  # Analyze specific workflow failures
  ./analyze-github-logs.ts --repo myorg/myrepo --workflow "CI Pipeline"

  # Output as markdown
  ./analyze-github-logs.ts --repo myorg/myrepo --output markdown > report.md
`);
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  if (!options.repo) {
    console.error('Error: --repo is required');
    showHelp();
    process.exit(1);
  }

  // Check if gh CLI is installed
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed');
    console.error('Install it from: https://cli.github.com/');
    process.exit(1);
  }

  const analyzer = new GitHubLogAnalyzer();

  if (options.runId) {
    // Analyze specific run
    const logs = await analyzer.fetchRunLogs(options.repo, options.runId);
    if (logs) {
      analyzer.analyzeLogs(logs, options);
    }
  } else {
    // Fetch and analyze latest failed runs
    const runs = await analyzer.fetchFailedRuns(options.repo, options.workflow);

    if (runs.length === 0) {
      console.log('No failed runs found');
      process.exit(0);
    }

    console.log(`Found ${runs.length} failed runs`);
    console.log(`Analyzing most recent failure: ${runs[0].name} (${runs[0].id})\n`);

    const logs = await analyzer.fetchRunLogs(options.repo, runs[0].id.toString());
    if (logs) {
      analyzer.analyzeLogs(logs, options);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { GitHubLogAnalyzer };
