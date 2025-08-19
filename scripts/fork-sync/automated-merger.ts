#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { ForkSyncConfig, loadForkSyncConfig } from './config-loader';
import { MergeSimulation } from './monitor';

export interface MergeResult {
  success: boolean;
  commitSha?: string;
  message: string;
  affectedFiles: string[];
  validationResults: ValidationResult[];
}

export interface ValidationResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

export interface MergeMetadata {
  upstreamRef: string;
  simulation: MergeSimulation;
  timestamp: string;
  workflowRun?: string;
}

export class AutomatedMerger {
  private config: ForkSyncConfig;

  constructor(config?: ForkSyncConfig) {
    this.config = config || loadForkSyncConfig();
  }

  public async performSafeMerge(simulation: MergeSimulation, upstreamRef: string = 'upstream/main'): Promise<MergeResult> {
    console.log('[MERGER] Starting safe merge process...');

    // Pre-flight checks
    if (!simulation.success) {
      throw new Error('Cannot perform merge: simulation failed');
    }

    if (simulation.recommendation !== 'AUTO_MERGE') {
      throw new Error(`Cannot auto-merge: recommendation is ${simulation.recommendation}`);
    }

    if (simulation.riskLevel !== 'SAFE') {
      throw new Error(`Cannot auto-merge: risk level is ${simulation.riskLevel}`);
    }

    const originalBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    try {
      // Ensure we're on the main branch
      if (originalBranch !== 'main') {
        console.log('[MERGER] Switching to main branch...');
        execSync('git checkout main');
      }

      // Ensure we have latest upstream
      console.log('[MERGER] Fetching latest upstream changes...');
      execSync('git fetch upstream');

      // Perform the merge
      console.log(`[MERGER] Merging ${upstreamRef}...`);
      const mergeOutput = execSync(`git merge ${upstreamRef} --no-ff`, { encoding: 'utf8' });
      
      // Get the merge commit SHA
      const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      // Get affected files
      const affectedFiles = simulation.affectedFiles;

      // Generate merge commit message with metadata
      const metadata: MergeMetadata = {
        upstreamRef,
        simulation,
        timestamp: new Date().toISOString(),
        workflowRun: process.env.GITHUB_RUN_ID
      };

      // Update commit message with fork sync metadata
      const enhancedMessage = this.generateMergeCommit(metadata);
      execSync(`git commit --amend -m "${enhancedMessage.replace(/"/g, '\\"')}"`);

      console.log('[MERGER] Merge completed successfully');
      console.log(`[MERGER] Commit SHA: ${commitSha}`);

      // Perform post-merge validation
      const validationResults = await this.validatePostMerge();

      const result: MergeResult = {
        success: true,
        commitSha,
        message: 'Safe merge completed successfully',
        affectedFiles,
        validationResults
      };

      return result;

    } catch (error) {
      console.error('[MERGER] Merge failed:', error);
      
      // Attempt to abort merge if in progress
      try {
        execSync('git merge --abort', { stdio: 'pipe' });
        console.log('[MERGER] Merge aborted successfully');
      } catch (abortError) {
        console.warn('[MERGER] Could not abort merge (may not be in progress)');
      }

      // Return to original branch if different
      if (originalBranch !== 'main') {
        try {
          execSync(`git checkout ${originalBranch}`);
        } catch (checkoutError) {
          console.warn(`[MERGER] Could not return to original branch: ${originalBranch}`);
        }
      }

      const result: MergeResult = {
        success: false,
        message: `Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedFiles: simulation.affectedFiles,
        validationResults: []
      };

      return result;
    }
  }

  public generateMergeCommit(metadata: MergeMetadata): string {
    const { upstreamRef, simulation, timestamp, workflowRun } = metadata;
    
    // Extract upstream commit info
    let upstreamCommitInfo = '';
    try {
      const commitMessage = execSync(`git log -1 --pretty=format:"%s" ${upstreamRef}`, { encoding: 'utf8' });
      const commitSha = execSync(`git rev-parse ${upstreamRef}`, { encoding: 'utf8' }).trim().substring(0, 8);
      upstreamCommitInfo = `${commitSha}: ${commitMessage}`;
    } catch (error) {
      upstreamCommitInfo = upstreamRef;
    }

    let message = `🔄 Auto-merge upstream changes\n\n`;
    message += `Merged from: ${upstreamCommitInfo}\n`;
    message += `Merge strategy: Automated safe merge\n`;
    message += `Risk assessment: ${simulation.riskLevel}\n`;
    message += `Files affected: ${simulation.affectedFiles.length}\n`;
    message += `Validation: Fork sync protection passed\n\n`;

    if (simulation.affectedFiles.length > 0) {
      message += `Modified files:\n`;
      for (const file of simulation.affectedFiles.slice(0, 10)) { // Limit to first 10 files
        message += `- ${file}\n`;
      }
      if (simulation.affectedFiles.length > 10) {
        message += `... and ${simulation.affectedFiles.length - 10} more files\n`;
      }
      message += `\n`;
    }

    message += `Auto-accept-countdown feature: ✅ Protected\n`;
    message += `Fork integrity: ✅ Validated\n\n`;

    if (workflowRun) {
      message += `Workflow: https://github.com/bizzkoot/TimerCC/actions/runs/${workflowRun}\n`;
    }
    
    message += `Timestamp: ${timestamp}\n\n`;
    message += `🤖 Generated by Fork Sync Protection System`;

    return message;
  }

  public async validatePostMerge(): Promise<ValidationResult[]> {
    console.log('[MERGER] Running post-merge validation...');
    
    const results: ValidationResult[] = [];

    // Validate critical files still exist
    const fileValidation = await this.validateCriticalFiles();
    results.push(fileValidation);

    // Validate fork-specific URLs are still present
    const urlValidation = await this.validateForkUrls();
    results.push(urlValidation);

    // Validate auto-accept-countdown installation script
    const installValidation = await this.validateInstallScript();
    results.push(installValidation);

    // Validate repository integrity
    const repoValidation = await this.validateRepositoryState();
    results.push(repoValidation);

    console.log(`[MERGER] Post-merge validation completed: ${results.filter(r => r.success).length}/${results.length} passed`);
    return results;
  }

  private async validateCriticalFiles(): Promise<ValidationResult> {
    try {
      const fs = require('fs');
      const missingFiles: string[] = [];

      for (const filePath of this.config.critical_files) {
        if (!fs.existsSync(filePath)) {
          missingFiles.push(filePath);
        }
      }

      if (missingFiles.length > 0) {
        return {
          name: 'Critical Files Check',
          success: false,
          message: `${missingFiles.length} critical files missing`,
          details: { missingFiles }
        };
      }

      return {
        name: 'Critical Files Check',
        success: true,
        message: `All ${this.config.critical_files.length} critical files present`
      };
    } catch (error) {
      return {
        name: 'Critical Files Check',
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async validateForkUrls(): Promise<ValidationResult> {
    try {
      let totalUrlCount = 0;
      
      for (const urlPattern of this.config.fork_specific_urls) {
        try {
          const grepOutput = execSync(
            `grep -r "${urlPattern.pattern}" specs/auto-accept-countdown/ --exclude-dir=.git`,
            { encoding: 'utf8' }
          );
          const matches = grepOutput.trim().split('\n').filter(line => line.trim());
          totalUrlCount += matches.length;
        } catch (error) {
          // grep returns non-zero when no matches found
        }
      }

      const minRequired = this.config.monitoring.min_fork_url_count;
      
      if (totalUrlCount < minRequired) {
        return {
          name: 'Fork URLs Check',
          success: false,
          message: `Only ${totalUrlCount} fork URLs found, expected at least ${minRequired}`,
          details: { found: totalUrlCount, required: minRequired }
        };
      }

      return {
        name: 'Fork URLs Check',
        success: true,
        message: `${totalUrlCount} fork-specific URLs validated`
      };
    } catch (error) {
      return {
        name: 'Fork URLs Check',
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async validateInstallScript(): Promise<ValidationResult> {
    try {
      const scriptPath = 'specs/auto-accept-countdown/install.js';
      
      // Test that the install script runs without errors
      const output = execSync(`node ${scriptPath} --help`, { encoding: 'utf8' });
      
      if (output.includes('Usage:') || output.includes('--help')) {
        return {
          name: 'Install Script Check',
          success: true,
          message: 'Install script responds correctly to --help'
        };
      } else {
        return {
          name: 'Install Script Check',
          success: false,
          message: 'Install script --help output unexpected',
          details: { output }
        };
      }
    } catch (error) {
      return {
        name: 'Install Script Check',
        success: false,
        message: `Install script validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async validateRepositoryState(): Promise<ValidationResult> {
    try {
      // Check that we're not in a conflicted state
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
      const conflictedFiles = statusOutput.split('\n').filter(line => 
        line.startsWith('UU ') || line.startsWith('AA ')
      );

      if (conflictedFiles.length > 0) {
        return {
          name: 'Repository State Check',
          success: false,
          message: `Repository has ${conflictedFiles.length} conflicted files`,
          details: { conflictedFiles }
        };
      }

      // Check that we're on a valid commit
      const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      if (!currentCommit || currentCommit.length !== 40) {
        return {
          name: 'Repository State Check',
          success: false,
          message: 'Invalid HEAD commit'
        };
      }

      return {
        name: 'Repository State Check',
        success: true,
        message: 'Repository is in clean state'
      };
    } catch (error) {
      return {
        name: 'Repository State Check',
        success: false,
        message: `Repository validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// CLI interface for testing
if (require.main === module) {
  async function main() {
    try {
      const merger = new AutomatedMerger();
      
      console.log('[CLI] Testing automated merger...');
      
      // This would normally be called with actual simulation results
      // For testing, we'll just validate the current state
      const validationResults = await merger.validatePostMerge();
      
      console.log('\n[CLI] Validation Results:');
      for (const result of validationResults) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.name}: ${result.message}`);
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }
      
      const allPassed = validationResults.every(r => r.success);
      console.log(`\n[CLI] Overall validation: ${allPassed ? 'PASSED' : 'FAILED'}`);
      
      if (!allPassed) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('[CLI] Error:', error);
      process.exit(1);
    }
  }
  
  main();
}