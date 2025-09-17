#!/usr/bin/env tsx

/**
 * GitHub CI Log Analyzer
 *
 * Phase 2 implementation: GitHub CLI integration for extracting and analyzing CI logs
 *
 * Usage:
 *   pnpm --filter @simple-bookkeeping/ci-error-detector analyze:github <pr-number>
 *   pnpm --filter @simple-bookkeeping/ci-error-detector analyze:github 436 --format json
 *   pnpm --filter @simple-bookkeeping/ci-error-detector analyze:github 436 --job "Lint" --verbose
 */

import { execSync, execFileSync } from 'child_process';
import * as fs from 'fs';

import { CIErrorClassifier } from '../src/core/classifier';

import type { CIErrorReport } from '../src/types';

interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string;
  steps: GitHubStep[];
}

interface GitHubStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string;
  completed_at: string;
}

interface GitHubCheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  output?: {
    title: string;
    summary: string;
    annotations_count: number;
  };
}

interface AnalysisOptions {
  prNumber?: string;
  runId?: string;
  job?: string;
  format?: 'console' | 'json' | 'markdown' | 'github-annotation';
  output?: string;
  verbose?: boolean;
  repo?: string;
  maxRetries?: number;
}

class GitHubCIAnalyzer {
  private classifier: CIErrorClassifier;
  private repo: string;
  private maxRetries: number;

  constructor(options: { repo?: string; maxRetries?: number } = {}) {
    this.classifier = new CIErrorClassifier();
    if (options.repo) {
      this.validateRepo(options.repo);
      this.repo = options.repo;
    } else {
      this.repo = this.detectRepo();
    }
    this.maxRetries = options.maxRetries || 3;
  }

  private detectRepo(): string {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^.]+)/);
      if (match) {
        const repo = match[1];
        this.validateRepo(repo);
        return repo;
      }
    } catch {
      // Fallback to default repo if detection fails
    }
    return 'knishioka/simple-bookkeeping';
  }

  private validateRepo(repo: string): void {
    const repoPattern = /^[\w-]+\/[\w.-]+$/;
    if (!repoPattern.test(repo)) {
      throw new Error(`Invalid repository format: ${repo}. Expected format: owner/repo`);
    }
  }

  private executeGHCommand(args: string[], retries = this.maxRetries): string {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return execFileSync('gh', args, {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large logs
        });
      } catch (error) {
        if (attempt === retries) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`GitHub CLI command failed after ${retries} attempts: ${message}`);
        }
        console.error(`Attempt ${attempt} failed, retrying...`);
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        execSync(`sleep ${delay / 1000}`);
      }
    }
    return '';
  }

  async analyzePR(prNumber: string): Promise<CIErrorReport> {
    console.log(`🔍 Analyzing PR #${prNumber} in ${this.repo}...`);

    // Validate PR number
    if (!/^\d+$/.test(prNumber)) {
      throw new Error('Invalid PR number. Must be a numeric value.');
    }

    // Get PR checks
    const checksJson = this.executeGHCommand([
      'pr',
      'checks',
      prNumber,
      '--repo',
      this.repo,
      '--json',
      'name,status,conclusion,link',
    ]);
    const checks: GitHubCheckRun[] = JSON.parse(checksJson);

    // Find failed checks
    const failedChecks = checks.filter(
      (check) => check.conclusion === 'failure' || check.conclusion === 'cancelled'
    );

    if (failedChecks.length === 0) {
      console.log('✅ All checks passed!');
      return {
        errors: [],
        summary: {
          total: 0,
          byCategory: {},
          bySeverity: {},
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
        metadata: {
          source: `PR #${prNumber}`,
          timestamp: new Date().toISOString(),
          analyzer: 'github-ci-analyzer',
        },
      };
    }

    console.log(`❌ Found ${failedChecks.length} failed checks`);

    // Get the latest workflow run for the PR
    const runsJson = this.executeGHCommand([
      'run',
      'list',
      '--repo',
      this.repo,
      '--json',
      'id,name,status,conclusion,htmlUrl,createdAt,updatedAt',
      '--limit',
      '50',
    ]);
    const runs: GitHubWorkflowRun[] = JSON.parse(runsJson);

    // Analyze each failed check
    const allLogs: string[] = [];
    const errorContextMap = new Map<string, unknown>();

    for (const check of failedChecks) {
      console.log(`\n📋 Analyzing failed check: ${check.name}`);

      // Find corresponding workflow run
      const run = runs.find((r) => r.name === check.name && r.conclusion === 'failure');

      if (run) {
        try {
          // Get detailed job information
          const jobsJson = this.executeGHCommand([
            'run',
            'view',
            String(run.id),
            '--repo',
            this.repo,
            '--json',
            'jobs',
          ]);
          const jobsData = JSON.parse(jobsJson);
          const jobs: GitHubJob[] = jobsData.jobs;

          // Find failed jobs
          const failedJobs = jobs.filter((job) => job.conclusion === 'failure');

          for (const job of failedJobs) {
            console.error(`  -- Failed job: ${job.name}`);

            // Get job logs
            try {
              const logs = this.executeGHCommand([
                'run',
                'view',
                String(run.id),
                '--repo',
                this.repo,
                '--log',
                '--job',
                String(job.id),
              ]);

              allLogs.push(`\n=== Job: ${job.name} ===`);
              allLogs.push(logs);

              // Extract error annotations if available
              const annotations = this.extractAnnotations(logs);
              if (annotations.length > 0) {
                errorContextMap.set(job.name, {
                  job: job.name,
                  workflow: run.name,
                  runId: run.id,
                  runUrl: run.html_url,
                  annotations,
                });
              }

              // Find failed steps
              const failedSteps = job.steps.filter((step) => step.conclusion === 'failure');
              for (const step of failedSteps) {
                console.error(`    -- Failed step: ${step.name}`);
                errorContextMap.set(`${job.name}::${step.name}`, {
                  job: job.name,
                  step: step.name,
                  stepNumber: step.number,
                  duration: this.calculateDuration(step.started_at, step.completed_at),
                });
              }
            } catch {
              console.error(`    WARNING: Could not retrieve logs for job ${job.id}`);
            }
          }
        } catch {
          console.error(`  WARNING: Could not analyze run ${run.id}`);
        }
      }
    }

    // Classify all collected logs
    const combinedLogs = allLogs.join('\n');
    const report = this.classifier.classify(combinedLogs);

    // Enhance report with GitHub-specific context
    report.errors = report.errors.map((error) => {
      // Try to find matching context from our error map
      for (const [key, context] of errorContextMap.entries()) {
        if (error.context?.file?.includes(key) || error.message.includes(key)) {
          error.metadata = {
            ...error.metadata,
            ...context,
          };
        }
      }
      return error;
    });

    // Add PR metadata
    report.metadata = {
      ...report.metadata,
      prNumber,
      repo: this.repo,
      failedChecks: failedChecks.map((c) => c.name),
      timestamp: new Date().toISOString(),
    };

    return report;
  }

  async analyzeRun(runId: string): Promise<CIErrorReport> {
    console.log(`Analyzing workflow run #${runId}...`);

    // Validate run ID
    if (!/^\d+$/.test(runId)) {
      throw new Error('Invalid run ID. Must be a numeric value.');
    }

    // Get run details
    const runJson = this.executeGHCommand([
      'run',
      'view',
      runId,
      '--repo',
      this.repo,
      '--json',
      'id,name,status,conclusion,htmlUrl,jobs',
    ]);
    const runData = JSON.parse(runJson);
    const jobs: GitHubJob[] = runData.jobs;

    // Collect logs from all failed jobs
    const allLogs: string[] = [];
    const failedJobs = jobs.filter((job) => job.conclusion === 'failure');

    for (const job of failedJobs) {
      console.log(`\nProcessing failed job: ${job.name}`);
      try {
        const logs = this.executeGHCommand([
          'run',
          'view',
          runId,
          '--repo',
          this.repo,
          '--log',
          '--job',
          String(job.id),
        ]);
        allLogs.push(`\n=== Job: ${job.name} ===`);
        allLogs.push(logs);
      } catch {
        console.error(`  WARNING: Could not retrieve logs for job ${job.id}`);
      }
    }

    // Classify errors
    const combinedLogs = allLogs.join('\n');
    const report = this.classifier.classify(combinedLogs);

    // Add run metadata
    report.metadata = {
      ...report.metadata,
      runId,
      workflowName: runData.name,
      repo: this.repo,
      runUrl: runData.htmlUrl,
      failedJobs: failedJobs.map((j) => j.name),
    };

    return report;
  }

  private extractAnnotations(
    logs: string
  ): Array<{ file?: string; line?: number; column?: number; message: string }> {
    const annotations: Array<{ file?: string; line?: number; column?: number; message: string }> =
      [];
    const annotationPattern = /^::error\s+(file=([^,]+),)?(line=(\d+),)?(col=(\d+),)?(.*)$/gm;

    let match;
    while ((match = annotationPattern.exec(logs)) !== null) {
      annotations.push({
        file: match[2] || undefined,
        line: match[4] ? parseInt(match[4]) : undefined,
        column: match[6] ? parseInt(match[6]) : undefined,
        message: match[7] || '',
      });
    }

    return annotations;
  }

  private calculateDuration(startTime: string, endTime: string): string {
    if (!startTime || !endTime) return 'N/A';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  }

  formatReport(report: CIErrorReport, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'markdown':
        return this.formatMarkdown(report);

      case 'github-annotation':
        return this.formatGitHubAnnotations(report);

      case 'console':
      default:
        return this.formatConsole(report);
    }
  }

  private formatConsole(report: CIErrorReport): string {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push('CI ERROR ANALYSIS REPORT');
    lines.push('='.repeat(80));

    if (report.metadata) {
      lines.push('\n📊 Metadata:');
      Object.entries(report.metadata).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          lines.push(`  ${key}: ${value.join(', ')}`);
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      });
    }

    lines.push('\n📈 Summary:');
    lines.push(`  Total errors: ${report.summary.total}`);
    lines.push(`  Critical: ${report.summary.criticalCount}`);
    lines.push(`  High: ${report.summary.highCount}`);
    lines.push(`  Medium: ${report.summary.mediumCount}`);
    lines.push(`  Low: ${report.summary.lowCount}`);

    if (report.errors.length > 0) {
      lines.push('\n❌ Errors:');
      report.errors.forEach((error, index) => {
        lines.push(`\n  ${index + 1}. [${error.severity.toUpperCase()}] ${error.category}`);
        lines.push(`     Message: ${error.message}`);
        lines.push(`     Confidence: ${(error.confidence * 100).toFixed(1)}%`);

        if (error.context?.file) {
          lines.push(`     File: ${error.context.file}`);
          if (error.context.line) {
            lines.push(`     Line: ${error.context.line}`);
          }
        }

        if (error.suggestedFixes.length > 0) {
          lines.push('     Suggested fixes:');
          error.suggestedFixes.forEach((fix) => {
            lines.push(`       • ${fix}`);
          });
        }

        if (error.metadata) {
          lines.push('     Additional context:');
          Object.entries(error.metadata).forEach(([key, value]) => {
            lines.push(`       ${key}: ${JSON.stringify(value)}`);
          });
        }
      });
    }

    lines.push(`\n${'='.repeat(80)}`);

    return lines.join('\n');
  }

  private formatMarkdown(report: CIErrorReport): string {
    const lines: string[] = [];

    lines.push('# CI Error Analysis Report');
    lines.push('');

    if (report.metadata) {
      lines.push('## 📊 Metadata');
      lines.push('');
      lines.push('| Property | Value |');
      lines.push('|----------|-------|');
      Object.entries(report.metadata).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          lines.push(`| ${key} | ${value.join(', ')} |`);
        } else {
          lines.push(`| ${key} | ${value} |`);
        }
      });
      lines.push('');
    }

    lines.push('## 📈 Summary');
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    lines.push(`| Critical | ${report.summary.criticalCount} |`);
    lines.push(`| High | ${report.summary.highCount} |`);
    lines.push(`| Medium | ${report.summary.mediumCount} |`);
    lines.push(`| Low | ${report.summary.lowCount} |`);
    lines.push(`| **Total** | **${report.summary.total}** |`);
    lines.push('');

    if (report.errors.length > 0) {
      lines.push('## ❌ Errors');
      lines.push('');

      report.errors.forEach((error, index) => {
        lines.push(`### ${index + 1}. ${error.category}`);
        lines.push('');
        lines.push(`- **Severity**: ${error.severity}`);
        lines.push(`- **Confidence**: ${(error.confidence * 100).toFixed(1)}%`);
        lines.push(`- **Message**: ${error.message}`);

        if (error.context?.file) {
          lines.push(`- **File**: \`${error.context.file}\``);
          if (error.context.line) {
            lines.push(`- **Line**: ${error.context.line}`);
          }
        }

        if (error.suggestedFixes.length > 0) {
          lines.push('');
          lines.push('#### Suggested Fixes');
          error.suggestedFixes.forEach((fix) => {
            lines.push(`- ${fix}`);
          });
        }

        if (error.context?.stackTrace) {
          lines.push('');
          lines.push('<details>');
          lines.push('<summary>Stack Trace</summary>');
          lines.push('');
          lines.push('```');
          lines.push(error.context.stackTrace);
          lines.push('```');
          lines.push('</details>');
        }

        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private formatGitHubAnnotations(report: CIErrorReport): string {
    const annotations: string[] = [];

    report.errors.forEach((error) => {
      const level =
        error.severity === 'critical' || error.severity === 'high'
          ? 'error'
          : error.severity === 'medium'
            ? 'warning'
            : 'notice';

      const file = error.context?.file || 'unknown';
      const line = error.context?.line || 1;

      // GitHub Actions annotation format
      let annotation = `:${level} file=${file},line=${line}::`;
      annotation += `[${error.category}] ${error.message}`;

      if (error.suggestedFixes.length > 0) {
        annotation += ` | Fixes: ${error.suggestedFixes.join('; ')}`;
      }

      annotations.push(annotation);
    });

    return annotations.join('\n');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: AnalysisOptions = {
    format: 'console',
    verbose: false,
  };

  // Parse arguments
  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--format' || arg === '-f') {
      options.format = args[++i] as 'console' | 'json' | 'markdown' | 'github-annotation';
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--repo' || arg === '-r') {
      options.repo = args[++i];
    } else if (arg === '--job' || arg === '-j') {
      options.job = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: github-ci-analyzer <pr-number|run-id> [options]

Options:
  -f, --format <format>  Output format: console, json, markdown, github-annotation (default: console)
  -o, --output <file>    Save output to file
  -r, --repo <owner/repo> GitHub repository (default: auto-detect)
  -j, --job <name>       Analyze specific job only
  -v, --verbose          Verbose output
  -h, --help             Show this help message

Examples:
  github-ci-analyzer 436                    # Analyze PR #436
  github-ci-analyzer 123456789 --format json # Analyze run with JSON output
  github-ci-analyzer 436 -o report.md -f markdown # Save as markdown
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // This is the PR number or run ID
      const id = arg;
      if (id.length > 6) {
        options.runId = id;
      } else {
        options.prNumber = id;
      }
    }
    i++;
  }

  // Run analysis
  const analyzer = new GitHubCIAnalyzer({
    repo: options.repo,
    maxRetries: 3,
  });

  (async () => {
    try {
      let report: CIErrorReport;

      if (options.prNumber) {
        report = await analyzer.analyzePR(options.prNumber);
      } else if (options.runId) {
        report = await analyzer.analyzeRun(options.runId);
      } else {
        console.error('Error: Please provide a PR number or run ID');
        process.exit(1);
      }

      const output = analyzer.formatReport(report, options.format || 'console');

      if (options.output) {
        fs.writeFileSync(options.output, output);
        console.log(`✅ Report saved to ${options.output}`);
      } else {
        console.log(output);
      }

      // Exit with non-zero if critical errors found
      if (report.summary.criticalCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  })();
}

export { GitHubCIAnalyzer };
