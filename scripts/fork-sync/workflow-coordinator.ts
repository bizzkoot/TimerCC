#!/usr/bin/env ts-node

import * as fs from 'fs';
import { execSync } from 'child_process';
import { loadForkSyncConfig } from './config-loader';
import { ForkStatusMonitor } from './monitor';
import { AutomatedMerger } from './automated-merger';
import { PRGenerator } from './pr-generator';
import { StatusReporter } from './status-reporter';

export interface WorkflowInputs {
  mode: 'check-only' | 'auto-merge';
  forcePR?: boolean;
  upstreamRef?: string;
}

export interface WorkflowOutputs {
  forkAhead: number;
  forkBehind: number;
  featureStatus: string;
  hasConflicts: boolean;
  mergeRecommendation: string;
  actionTaken: string;
  reportId: string;
  prNumber?: number;
  prUrl?: string;
}

export interface WorkflowResult {
  success: boolean;
  message: string;
  outputs: WorkflowOutputs;
  reportPath?: string;
  exitCode: number;
}

export class WorkflowCoordinator {
  private config = loadForkSyncConfig();
  private monitor = new ForkStatusMonitor(this.config);
  private merger = new AutomatedMerger(this.config);
  private prGenerator = new PRGenerator(this.config);
  private reporter = new StatusReporter(this.config);

  public async executeWorkflow(inputs: WorkflowInputs): Promise<WorkflowResult> {
    console.log('[COORDINATOR] Starting fork sync protection workflow...');
    console.log(`[COORDINATOR] Mode: ${inputs.mode}, Force PR: ${inputs.forcePR || false}`);

    const startTime = Date.now();
    
    try {
      // Step 1: Monitor fork status
      console.log('[COORDINATOR] Step 1: Checking fork status...');
      const forkStatus = await this.monitor.checkUpstreamChanges();
      
      // Step 2: Validate feature integrity
      console.log('[COORDINATOR] Step 2: Validating feature integrity...');
      const featureStatus = await this.monitor.validateFeatureFiles();
      
      // Step 3: Simulate merge if behind
      let simulation;
      if (forkStatus.behind > 0) {
        console.log('[COORDINATOR] Step 3: Simulating merge...');
        simulation = await this.monitor.simulateMerge(inputs.upstreamRef || 'upstream/main');
      }

      // Step 4: Generate comprehensive report
      console.log('[COORDINATOR] Step 4: Generating status report...');
      const conflictAnalysis = simulation ? await this.prGenerator.analyzeConflicts(simulation, inputs.upstreamRef || 'upstream/main') : undefined;
      const report = this.reporter.generateComprehensiveReport(forkStatus, featureStatus, simulation, conflictAnalysis);

      // Step 5: Determine and execute action
      console.log('[COORDINATOR] Step 5: Determining action...');
      const actionResult = await this.executeAction(inputs, forkStatus, featureStatus, simulation, conflictAnalysis);

      // Step 6: Generate GitHub Actions outputs
      const outputs = this.generateWorkflowOutputs(forkStatus, featureStatus, simulation, report, actionResult);

      // Step 7: Save report and generate summary
      const reportPath = this.reporter.saveReport(report, 'json');
      await this.generateGitHubSummary(report);
      
      // Set GitHub Actions outputs
      this.setGitHubOutputs(outputs);

      const duration = Date.now() - startTime;
      console.log(`[COORDINATOR] Workflow completed in ${duration}ms`);

      return {
        success: true,
        message: `Workflow completed successfully: ${actionResult.action}`,
        outputs,
        reportPath,
        exitCode: 0
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[COORDINATOR] Workflow failed after ${duration}ms:`, error);

      // Generate minimal outputs for failure case
      const outputs: WorkflowOutputs = {
        forkAhead: 0,
        forkBehind: 0,
        featureStatus: 'CRITICAL',
        hasConflicts: true,
        mergeRecommendation: 'MANUAL_INTERVENTION',
        actionTaken: 'FAILED',
        reportId: `ERROR-${Date.now()}`
      };

      this.setGitHubOutputs(outputs);
      await this.generateErrorSummary(error);

      return {
        success: false,
        message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        outputs,
        exitCode: 1
      };
    }
  }

  private async executeAction(
    inputs: WorkflowInputs,
    forkStatus: any,
    featureStatus: any,
    simulation: any,
    conflictAnalysis: any
  ): Promise<{ action: string; details?: any }> {
    
    // Check for critical feature issues first
    if (featureStatus.riskAssessment === 'CRITICAL') {
      console.log('[COORDINATOR] Critical feature issues detected - workflow will fail');
      throw new Error('Critical feature integrity issues must be resolved manually');
    }

    // If no upstream changes, no action needed
    if (forkStatus.behind === 0) {
      console.log('[COORDINATOR] Fork is up to date - no action needed');
      return { action: 'UP_TO_DATE' };
    }

    // Check mode restrictions
    if (inputs.mode === 'check-only') {
      console.log('[COORDINATOR] Check-only mode - no automated actions');
      return { action: 'CHECK_ONLY' };
    }

    // Force PR creation if requested
    if (inputs.forcePR) {
      console.log('[COORDINATOR] Force PR mode - creating review PR');
      const prResult = await this.prGenerator.createReviewPR(conflictAnalysis, {
        forkStatus,
        featureStatus,
        simulation,
        conflictAnalysis,
        upstreamRef: inputs.upstreamRef || 'upstream/main'
      });
      return { action: 'FORCE_PR_CREATED', details: prResult };
    }

    // Execute based on simulation recommendation
    if (simulation) {
      switch (simulation.recommendation) {
        case 'AUTO_MERGE':
          if (inputs.mode === 'auto-merge') {
            console.log('[COORDINATOR] Executing auto-merge...');
            const mergeResult = await this.merger.performSafeMerge(simulation, inputs.upstreamRef || 'upstream/main');
            if (mergeResult.success) {
              return { action: 'AUTO_MERGED', details: mergeResult };
            } else {
              throw new Error(`Auto-merge failed: ${mergeResult.message}`);
            }
          } else {
            return { action: 'AUTO_MERGE_READY' };
          }

        case 'CREATE_REVIEW_PR':
          console.log('[COORDINATOR] Creating review PR for complex changes...');
          const prResult = await this.prGenerator.createReviewPR(conflictAnalysis, {
            forkStatus,
            featureStatus,
            simulation,
            conflictAnalysis,
            upstreamRef: inputs.upstreamRef || 'upstream/main'
          });
          return { action: 'REVIEW_PR_CREATED', details: prResult };

        case 'MANUAL_INTERVENTION':
          console.log('[COORDINATOR] Manual intervention required');
          return { action: 'MANUAL_INTERVENTION_REQUIRED' };

        default:
          throw new Error(`Unknown simulation recommendation: ${simulation.recommendation}`);
      }
    }

    return { action: 'NO_ACTION' };
  }

  private generateWorkflowOutputs(
    forkStatus: any,
    featureStatus: any,
    simulation: any,
    report: any,
    actionResult: any
  ): WorkflowOutputs {
    
    return {
      forkAhead: forkStatus.ahead,
      forkBehind: forkStatus.behind,
      featureStatus: featureStatus.riskAssessment,
      hasConflicts: simulation?.conflicts?.length > 0 || false,
      mergeRecommendation: simulation?.recommendation || 'NO_UPSTREAM_CHANGES',
      actionTaken: actionResult.action,
      reportId: report.reportId,
      prNumber: actionResult.details?.number,
      prUrl: actionResult.details?.url
    };
  }

  private async generateGitHubSummary(report: any): Promise<void> {
    console.log('[COORDINATOR] Generating GitHub Actions summary...');
    
    const summary = this.reporter.formatForGitHubActions(report);
    
    // Write to GitHub Actions summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log('[COORDINATOR] GitHub Actions summary updated');
    } else {
      console.log('[COORDINATOR] GitHub Actions summary (preview):');
      console.log(summary);
    }
  }

  private async generateErrorSummary(error: any): Promise<void> {
    const errorSummary = `## ❌ Fork Sync Protection Failed

**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

**Time:** ${new Date().toISOString()}

**Next Steps:**
1. 🔍 Review the error details above
2. 🛠️ Fix any configuration or permission issues  
3. 🔄 Re-run the workflow manually
4. 📞 Contact maintainers if issue persists

**Logs:** Check the full workflow logs for additional details.

---
🤖 Generated by Fork Sync Protection System
`;

    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, errorSummary);
    } else {
      console.log('[COORDINATOR] Error summary:');
      console.log(errorSummary);
    }
  }

  private setGitHubOutputs(outputs: WorkflowOutputs): void {
    console.log('[COORDINATOR] Setting GitHub Actions outputs...');
    
    if (process.env.GITHUB_OUTPUT) {
      const outputEntries = [
        `fork_ahead=${outputs.forkAhead}`,
        `fork_behind=${outputs.forkBehind}`,
        `feature_status=${outputs.featureStatus}`,
        `has_conflicts=${outputs.hasConflicts}`,
        `merge_recommendation=${outputs.mergeRecommendation}`,
        `action_taken=${outputs.actionTaken}`,
        `report_id=${outputs.reportId}`
      ];

      if (outputs.prNumber) {
        outputEntries.push(`pr_number=${outputs.prNumber}`);
      }
      if (outputs.prUrl) {
        outputEntries.push(`pr_url=${outputs.prUrl}`);
      }

      for (const entry of outputEntries) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, entry + '\n');
      }
      
      console.log('[COORDINATOR] GitHub Actions outputs set');
    } else {
      console.log('[COORDINATOR] GitHub Actions outputs (preview):');
      console.log(JSON.stringify(outputs, null, 2));
    }
  }

  public async validateConfiguration(): Promise<boolean> {
    console.log('[COORDINATOR] Validating configuration...');
    
    try {
      // Validate config loads correctly
      const config = loadForkSyncConfig();
      
      // Check critical paths exist
      for (const path of config.protected_paths) {
        if (!fs.existsSync(path)) {
          console.warn(`[COORDINATOR] Protected path does not exist: ${path}`);
        }
      }

      // Check git remotes
      try {
        execSync('git remote get-url upstream', { stdio: 'pipe' });
        console.log('[COORDINATOR] ✅ Upstream remote configured');
      } catch (error) {
        console.error('[COORDINATOR] ❌ Upstream remote not configured');
        return false;
      }

      // Check GitHub CLI availability (for PR creation)
      try {
        execSync('gh --version', { stdio: 'pipe' });
        console.log('[COORDINATOR] ✅ GitHub CLI available');
      } catch (error) {
        console.warn('[COORDINATOR] ⚠️ GitHub CLI not available - PR creation will fail');
      }

      console.log('[COORDINATOR] ✅ Configuration validation passed');
      return true;

    } catch (error) {
      console.error('[COORDINATOR] ❌ Configuration validation failed:', error);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    try {
      const coordinator = new WorkflowCoordinator();
      
      // Parse command line arguments
      const args = process.argv.slice(2);
      const mode = args.includes('--auto-merge') ? 'auto-merge' : 'check-only';
      const forcePR = args.includes('--force-pr');
      const upstreamRef = args.find(arg => arg.startsWith('--upstream='))?.split('=')[1];

      const inputs: WorkflowInputs = {
        mode,
        forcePR,
        upstreamRef
      };

      // Validate configuration first
      const configValid = await coordinator.validateConfiguration();
      if (!configValid) {
        console.error('[CLI] Configuration validation failed');
        process.exit(1);
      }

      // Execute workflow
      const result = await coordinator.executeWorkflow(inputs);
      
      console.log(`[CLI] Workflow ${result.success ? 'completed' : 'failed'}: ${result.message}`);
      
      if (result.reportPath) {
        console.log(`[CLI] Report saved to: ${result.reportPath}`);
      }

      process.exit(result.exitCode);
      
    } catch (error) {
      console.error('[CLI] Fatal error:', error);
      process.exit(1);
    }
  }

  main();
}