#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadForkSyncConfig, ForkSyncConfig } from './config-loader';

export interface ForkStatus {
  ahead: number;
  behind: number;
  lastUpstreamCommit: string;
  hasConflicts: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FeatureStatus {
  criticalFilesIntact: boolean;
  dependenciesHealthy: boolean;
  forkUrlsValid: boolean;
  missingFiles: string[];
  riskAssessment: 'PROTECTED' | 'WARNING' | 'CRITICAL';
}

export interface MergeSimulation {
  success: boolean;
  conflicts: string[];
  affectedFiles: string[];
  riskLevel: 'SAFE' | 'REVIEW' | 'MANUAL';
  recommendation: 'AUTO_MERGE' | 'CREATE_REVIEW_PR' | 'MANUAL_INTERVENTION';
}

export class ForkStatusMonitor {
  private config: ForkSyncConfig;

  constructor(config?: ForkSyncConfig) {
    this.config = config || loadForkSyncConfig();
  }

  public async checkUpstreamChanges(): Promise<ForkStatus> {
    console.log('[MONITOR] Checking upstream changes...');
    
    try {
      // Get ahead/behind counts
      const aheadOutput = execSync('git rev-list --count upstream/main..HEAD', { encoding: 'utf8' });
      const behindOutput = execSync('git rev-list --count HEAD..upstream/main', { encoding: 'utf8' });
      
      const ahead = parseInt(aheadOutput.trim(), 10);
      const behind = parseInt(behindOutput.trim(), 10);
      
      // Get last upstream commit
      const lastCommitOutput = execSync('git rev-parse upstream/main', { encoding: 'utf8' });
      const lastUpstreamCommit = lastCommitOutput.trim();
      
      // Check for conflicts in protected paths
      let hasConflicts = false;
      if (behind > 0) {
        for (const protectedPath of this.config.protected_paths) {
          try {
            const changesOutput = execSync(
              `git log HEAD..upstream/main --oneline -- "${protectedPath}"`,
              { encoding: 'utf8' }
            );
            if (changesOutput.trim()) {
              hasConflicts = true;
              console.log(`[MONITOR] Conflicts detected in protected path: ${protectedPath}`);
              break;
            }
          } catch (error) {
            // Path might not exist, continue checking
          }
        }
      }
      
      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (hasConflicts) {
        riskLevel = 'HIGH';
      } else if (behind > 10) {
        riskLevel = 'MEDIUM';
      }
      
      const status: ForkStatus = {
        ahead,
        behind,
        lastUpstreamCommit,
        hasConflicts,
        riskLevel
      };
      
      console.log(`[MONITOR] Fork status: ${ahead} ahead, ${behind} behind, risk: ${riskLevel}`);
      return status;
      
    } catch (error) {
      console.error('[MONITOR] Error checking upstream changes:', error);
      throw new Error(`Failed to check upstream changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async validateFeatureFiles(): Promise<FeatureStatus> {
    console.log('[MONITOR] Validating feature file integrity...');
    
    const missingFiles: string[] = [];
    
    // Check critical files
    for (const filePath of this.config.critical_files) {
      if (!fs.existsSync(filePath)) {
        missingFiles.push(filePath);
        console.log(`[MONITOR] Missing critical file: ${filePath}`);
      }
    }
    
    const criticalFilesIntact = missingFiles.length === 0;
    
    // Check fork-specific URLs
    let forkUrlCount = 0;
    for (const urlPattern of this.config.fork_specific_urls) {
      try {
        const grepOutput = execSync(
          `grep -r "${urlPattern.pattern}" specs/auto-accept-countdown/ --exclude-dir=.git`,
          { encoding: 'utf8' }
        );
        const matches = grepOutput.trim().split('\n').filter(line => line.trim());
        forkUrlCount += matches.length;
      } catch (error) {
        // grep returns non-zero exit code when no matches found
      }
    }
    
    const forkUrlsValid = forkUrlCount >= this.config.monitoring.min_fork_url_count;
    
    // Assess overall risk
    let riskAssessment: 'PROTECTED' | 'WARNING' | 'CRITICAL';
    if (!criticalFilesIntact) {
      riskAssessment = 'CRITICAL';
    } else if (!forkUrlsValid) {
      riskAssessment = 'WARNING';
    } else {
      riskAssessment = 'PROTECTED';
    }
    
    const status: FeatureStatus = {
      criticalFilesIntact,
      dependenciesHealthy: criticalFilesIntact, // Simplified for now
      forkUrlsValid,
      missingFiles,
      riskAssessment
    };
    
    console.log(`[MONITOR] Feature status: ${riskAssessment}, ${missingFiles.length} missing files`);
    return status;
  }

  public async simulateMerge(upstreamRef: string = 'upstream/main'): Promise<MergeSimulation> {
    console.log(`[MONITOR] Simulating merge with ${upstreamRef}...`);
    
    const originalBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const testBranch = `test-merge-simulation-${Date.now()}`;
    
    try {
      // Create test branch
      execSync(`git checkout -b ${testBranch}`);
      
      // Attempt merge
      let success = true;
      let conflicts: string[] = [];
      let affectedFiles: string[] = [];
      
      try {
        execSync(`git merge ${upstreamRef} --no-commit --no-ff`, { stdio: 'pipe' });
        
        // Get list of files that would be affected
        const diffOutput = execSync('git diff --cached --name-only', { encoding: 'utf8' });
        affectedFiles = diffOutput.trim().split('\n').filter(f => f.trim());
        
        // Abort the merge
        execSync('git merge --abort');
        
      } catch (mergeError) {
        success = false;
        
        // Get conflict files
        try {
          const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
          conflicts = statusOutput
            .split('\n')
            .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
            .map(line => line.substring(3).trim());
          
          // Abort the failed merge
          execSync('git merge --abort');
        } catch (statusError) {
          // Merge abort might fail if no merge in progress
        }
      }
      
      // Determine risk level and recommendation
      let riskLevel: 'SAFE' | 'REVIEW' | 'MANUAL' = 'SAFE';
      let recommendation: 'AUTO_MERGE' | 'CREATE_REVIEW_PR' | 'MANUAL_INTERVENTION' = 'AUTO_MERGE';
      
      if (!success || conflicts.length > 0) {
        riskLevel = 'MANUAL';
        recommendation = 'MANUAL_INTERVENTION';
      } else {
        // Check if any protected paths are affected
        const protectedPathsAffected = affectedFiles.some(file => 
          this.config.protected_paths.some(path => file.startsWith(path))
        );
        
        if (protectedPathsAffected) {
          riskLevel = 'REVIEW';
          recommendation = 'CREATE_REVIEW_PR';
        }
      }
      
      const simulation: MergeSimulation = {
        success,
        conflicts,
        affectedFiles,
        riskLevel,
        recommendation
      };
      
      console.log(`[MONITOR] Merge simulation: ${success ? 'SUCCESS' : 'FAILED'}, recommendation: ${recommendation}`);
      return simulation;
      
    } finally {
      // Cleanup: return to original branch and delete test branch
      try {
        execSync(`git checkout ${originalBranch}`);
        execSync(`git branch -D ${testBranch}`);
      } catch (cleanupError) {
        console.warn('[MONITOR] Warning: Failed to cleanup test branch:', cleanupError);
      }
    }
  }

  public generateStatusReport(forkStatus: ForkStatus, featureStatus: FeatureStatus, simulation?: MergeSimulation): string {
    const timestamp = new Date().toISOString();
    
    let report = `## 🔄 Fork Sync Status Report\n\n`;
    report += `**Generated:** ${timestamp}\n\n`;
    
    // Fork Status Table
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Commits ahead of upstream | ${forkStatus.ahead} |\n`;
    report += `| Commits behind upstream | ${forkStatus.behind} |\n`;
    report += `| Auto-accept-countdown status | ${featureStatus.riskAssessment} |\n`;
    report += `| Upstream conflicts | ${forkStatus.hasConflicts ? 'YES' : 'NO'} |\n`;
    report += `| Risk level | ${forkStatus.riskLevel} |\n\n`;
    
    // Feature Protection Details
    if (featureStatus.missingFiles.length > 0) {
      report += `### ❌ Missing Critical Files\n`;
      for (const file of featureStatus.missingFiles) {
        report += `- ${file}\n`;
      }
      report += `\n`;
    }
    
    // Merge Simulation Results
    if (simulation) {
      report += `### 🧪 Merge Simulation Results\n`;
      report += `- **Status:** ${simulation.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
      report += `- **Risk Level:** ${simulation.riskLevel}\n`;
      report += `- **Recommendation:** ${simulation.recommendation}\n`;
      
      if (simulation.conflicts.length > 0) {
        report += `- **Conflicts:**\n`;
        for (const conflict of simulation.conflicts) {
          report += `  - ${conflict}\n`;
        }
      }
      
      if (simulation.affectedFiles.length > 0) {
        report += `- **Affected Files:** ${simulation.affectedFiles.length}\n`;
      }
      report += `\n`;
    }
    
    // Recommendations
    if (forkStatus.behind > 0) {
      report += `### 📋 Recommended Actions\n`;
      
      if (simulation?.recommendation === 'AUTO_MERGE') {
        report += `1. ✅ **Safe for auto-merge** - No conflicts detected with protected features\n`;
        report += `2. Monitor post-merge: Verify auto-accept-countdown functionality\n`;
      } else if (simulation?.recommendation === 'CREATE_REVIEW_PR') {
        report += `1. 🔍 **Manual review required** - Changes affect protected paths\n`;
        report += `2. Review upstream changes: \`git log HEAD..upstream/main\`\n`;
        report += `3. Test feature integrity after merge\n`;
      } else {
        report += `1. ⚠️ **Manual intervention required** - Conflicts detected\n`;
        report += `2. Review conflicts: \`git status\`\n`;
        report += `3. Resolve manually: \`git merge upstream/main\`\n`;
        report += `4. Verify auto-accept-countdown: \`node specs/auto-accept-countdown/install.js --verify\`\n`;
      }
    }
    
    return report;
  }
}

// CLI interface for testing
if (require.main === module) {
  async function main() {
    try {
      const monitor = new ForkStatusMonitor();
      
      console.log('[CLI] Starting fork status monitoring...');
      
      const forkStatus = await monitor.checkUpstreamChanges();
      const featureStatus = await monitor.validateFeatureFiles();
      
      let simulation: MergeSimulation | undefined;
      if (forkStatus.behind > 0) {
        simulation = await monitor.simulateMerge();
      }
      
      const report = monitor.generateStatusReport(forkStatus, featureStatus, simulation);
      console.log('\n' + report);
      
      // Set GitHub Actions outputs if running in CI
      if (process.env.GITHUB_ACTIONS) {
        const fs = require('fs');
        const outputFile = process.env.GITHUB_OUTPUT;
        if (outputFile) {
          fs.appendFileSync(outputFile, `fork_ahead=${forkStatus.ahead}\n`);
          fs.appendFileSync(outputFile, `fork_behind=${forkStatus.behind}\n`);
          fs.appendFileSync(outputFile, `feature_status=${featureStatus.riskAssessment}\n`);
          fs.appendFileSync(outputFile, `has_conflicts=${forkStatus.hasConflicts}\n`);
          if (simulation) {
            fs.appendFileSync(outputFile, `merge_recommendation=${simulation.recommendation}\n`);
          }
        }
      }
      
    } catch (error) {
      console.error('[CLI] Error:', error);
      process.exit(1);
    }
  }
  
  main();
}