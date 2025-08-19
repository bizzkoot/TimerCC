#!/usr/bin/env ts-node

import * as fs from 'fs';
import { ForkSyncConfig, loadForkSyncConfig } from './config-loader';
import { ForkStatus, FeatureStatus, MergeSimulation } from './monitor';
import { ConflictAnalysis } from './pr-generator';

export interface StatusReport {
  timestamp: string;
  reportId: string;
  summary: StatusSummary;
  forkStatus: ForkStatus;
  featureIntegrity: FeatureIntegrityReport;
  mergeSimulation?: MergeSimulationReport;
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionRequired: boolean;
  nextSteps: NextStep[];
}

export interface StatusSummary {
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  syncStatus: 'UP_TO_DATE' | 'BEHIND' | 'AHEAD' | 'DIVERGED';
  protectionStatus: 'PROTECTED' | 'AT_RISK' | 'COMPROMISED';
  lastSyncTime?: string;
  upcomingActions: string[];
}

export interface FeatureIntegrityReport {
  status: 'PROTECTED' | 'WARNING' | 'CRITICAL';
  criticalFilesIntact: boolean;
  dependenciesHealthy: boolean;
  forkUrlsValid: boolean;
  missingFiles: string[];
  details: {
    totalCriticalFiles: number;
    validatedFiles: number;
    forkUrlCount: number;
    lastValidation: string;
  };
}

export interface MergeSimulationReport {
  success: boolean;
  conflicts: string[];
  affectedFiles: string[];
  riskLevel: 'SAFE' | 'REVIEW' | 'MANUAL';
  recommendation: 'AUTO_MERGE' | 'CREATE_REVIEW_PR' | 'MANUAL_INTERVENTION';
  simulationTime: string;
  details: {
    protectedPathsAffected: number;
    safeExtensionsOnly: boolean;
    conflictSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface NextStep {
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  automated: boolean;
  description: string;
  command?: string;
}

export class StatusReporter {
  private config: ForkSyncConfig;

  constructor(config?: ForkSyncConfig) {
    this.config = config || loadForkSyncConfig();
  }

  public generateComprehensiveReport(
    forkStatus: ForkStatus,
    featureStatus: FeatureStatus,
    simulation?: MergeSimulation,
    conflictAnalysis?: ConflictAnalysis
  ): StatusReport {
    console.log('[REPORTER] Generating comprehensive status report...');

    const timestamp = new Date().toISOString();
    const reportId = `FSP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Generate summary
    const summary = this.generateSummary(forkStatus, featureStatus, simulation);
    
    // Generate feature integrity report
    const featureIntegrity = this.generateFeatureIntegrityReport(featureStatus);
    
    // Generate merge simulation report
    const mergeSimulation = simulation ? this.generateMergeSimulationReport(simulation) : undefined;
    
    // Assess overall risk level
    const riskLevel = this.assessOverallRisk(forkStatus, featureStatus, simulation);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(forkStatus, featureStatus, simulation, conflictAnalysis);
    
    // Determine if action is required
    const actionRequired = this.determineActionRequired(forkStatus, featureStatus, simulation);
    
    // Generate next steps
    const nextSteps = this.generateNextSteps(forkStatus, featureStatus, simulation, riskLevel);

    const report: StatusReport = {
      timestamp,
      reportId,
      summary,
      forkStatus,
      featureIntegrity,
      mergeSimulation,
      recommendations,
      riskLevel,
      actionRequired,
      nextSteps
    };

    console.log(`[REPORTER] Report generated: ${reportId}, risk: ${riskLevel}, action required: ${actionRequired}`);
    return report;
  }

  public formatForGitHubActions(report: StatusReport): string {
    let output = `## 🔄 Fork Sync Protection Report\n\n`;
    
    // Status badges
    const healthBadge = this.getHealthBadge(report.summary.overallHealth);
    const syncBadge = this.getSyncBadge(report.summary.syncStatus);
    const protectionBadge = this.getProtectionBadge(report.summary.protectionStatus);
    
    output += `${healthBadge} ${syncBadge} ${protectionBadge}\n\n`;
    
    // Summary table
    output += `### 📊 Status Overview\n`;
    output += `| Metric | Value | Status |\n`;
    output += `|--------|-------|--------|\n`;
    output += `| Overall Health | ${report.summary.overallHealth} | ${this.getStatusEmoji(report.summary.overallHealth)} |\n`;
    output += `| Commits Behind | ${report.forkStatus.behind} | ${report.forkStatus.behind === 0 ? '✅' : '⚠️'} |\n`;
    output += `| Commits Ahead | ${report.forkStatus.ahead} | ${report.forkStatus.ahead > 0 ? '📝' : '➖'} |\n`;
    output += `| Feature Protection | ${report.featureIntegrity.status} | ${this.getStatusEmoji(report.featureIntegrity.status)} |\n`;
    output += `| Risk Level | ${report.riskLevel} | ${this.getRiskEmoji(report.riskLevel)} |\n`;
    output += `| Action Required | ${report.actionRequired ? 'YES' : 'NO'} | ${report.actionRequired ? '🔔' : '✅'} |\n\n`;

    // Feature integrity details
    if (report.featureIntegrity.status !== 'PROTECTED') {
      output += `### 🛡️ Feature Integrity Issues\n`;
      if (report.featureIntegrity.missingFiles.length > 0) {
        output += `**Missing Critical Files:**\n`;
        for (const file of report.featureIntegrity.missingFiles) {
          output += `- ❌ \`${file}\`\n`;
        }
        output += `\n`;
      }
      if (!report.featureIntegrity.forkUrlsValid) {
        output += `- ⚠️ Fork-specific URLs below minimum threshold\n`;
      }
      output += `\n`;
    }

    // Merge simulation results
    if (report.mergeSimulation) {
      output += `### 🧪 Merge Analysis\n`;
      const sim = report.mergeSimulation;
      output += `- **Simulation Status:** ${sim.success ? '✅ Success' : '❌ Failed'}\n`;
      output += `- **Risk Level:** ${sim.riskLevel}\n`;
      output += `- **Recommendation:** ${sim.recommendation}\n`;
      output += `- **Files Affected:** ${sim.affectedFiles.length}\n`;
      
      if (sim.conflicts.length > 0) {
        output += `- **Conflicts:** ${sim.conflicts.length}\n`;
        output += `  - ${sim.conflicts.slice(0, 3).join(', ')}${sim.conflicts.length > 3 ? '...' : ''}\n`;
      }
      output += `\n`;
    }

    // Next steps
    if (report.nextSteps.length > 0) {
      output += `### 📋 Next Steps\n`;
      for (let i = 0; i < report.nextSteps.length; i++) {
        const step = report.nextSteps[i];
        const priorityEmoji = step.priority === 'HIGH' ? '🔴' : step.priority === 'MEDIUM' ? '🟡' : '🟢';
        const autoEmoji = step.automated ? '🤖' : '👤';
        
        output += `${i + 1}. ${priorityEmoji} ${autoEmoji} **${step.action}**\n`;
        output += `   ${step.description}\n`;
        if (step.command) {
          output += `   \`${step.command}\`\n`;
        }
        output += `\n`;
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      output += `### 💡 Recommendations\n`;
      for (const rec of report.recommendations) {
        output += `- ${rec}\n`;
      }
      output += `\n`;
    }

    // Footer
    output += `---\n`;
    output += `**Report ID:** \`${report.reportId}\`  \n`;
    output += `**Generated:** ${report.timestamp}  \n`;
    output += `**Workflow:** [View Run](https://github.com/bizzkoot/TimerCC/actions/runs/${process.env.GITHUB_RUN_ID || 'manual'})  \n`;
    output += `🤖 Generated by Fork Sync Protection System\n`;

    return output;
  }

  public exportAsJSON(report: StatusReport): string {
    return JSON.stringify(report, null, 2);
  }

  public saveReport(report: StatusReport, format: 'json' | 'markdown' = 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fork-sync-report-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
    const filepath = `/tmp/${filename}`;

    let content: string;
    if (format === 'json') {
      content = this.exportAsJSON(report);
    } else {
      content = this.formatForGitHubActions(report);
    }

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`[REPORTER] Report saved to: ${filepath}`);
    return filepath;
  }

  private generateSummary(forkStatus: ForkStatus, featureStatus: FeatureStatus, simulation?: MergeSimulation): StatusSummary {
    // Determine overall health
    let overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (featureStatus.riskAssessment === 'CRITICAL' || forkStatus.riskLevel === 'HIGH') {
      overallHealth = 'CRITICAL';
    } else if (featureStatus.riskAssessment === 'WARNING' || forkStatus.riskLevel === 'MEDIUM') {
      overallHealth = 'WARNING';
    }

    // Determine sync status
    let syncStatus: 'UP_TO_DATE' | 'BEHIND' | 'AHEAD' | 'DIVERGED' = 'UP_TO_DATE';
    if (forkStatus.behind > 0 && forkStatus.ahead > 0) {
      syncStatus = 'DIVERGED';
    } else if (forkStatus.behind > 0) {
      syncStatus = 'BEHIND';
    } else if (forkStatus.ahead > 0) {
      syncStatus = 'AHEAD';
    }

    // Determine protection status
    let protectionStatus: 'PROTECTED' | 'AT_RISK' | 'COMPROMISED' = 'PROTECTED';
    if (featureStatus.riskAssessment === 'CRITICAL') {
      protectionStatus = 'COMPROMISED';
    } else if (featureStatus.riskAssessment === 'WARNING') {
      protectionStatus = 'AT_RISK';
    }

    // Generate upcoming actions
    const upcomingActions: string[] = [];
    if (forkStatus.behind > 0) {
      if (simulation?.recommendation === 'AUTO_MERGE') {
        upcomingActions.push('Auto-merge scheduled');
      } else if (simulation?.recommendation === 'CREATE_REVIEW_PR') {
        upcomingActions.push('Review PR will be created');
      } else {
        upcomingActions.push('Manual intervention required');
      }
    }

    return {
      overallHealth,
      syncStatus,
      protectionStatus,
      upcomingActions
    };
  }

  private generateFeatureIntegrityReport(featureStatus: FeatureStatus): FeatureIntegrityReport {
    return {
      status: featureStatus.riskAssessment,
      criticalFilesIntact: featureStatus.criticalFilesIntact,
      dependenciesHealthy: featureStatus.dependenciesHealthy,
      forkUrlsValid: featureStatus.forkUrlsValid,
      missingFiles: featureStatus.missingFiles,
      details: {
        totalCriticalFiles: this.config.critical_files.length,
        validatedFiles: this.config.critical_files.length - featureStatus.missingFiles.length,
        forkUrlCount: featureStatus.forkUrlsValid ? this.config.monitoring.min_fork_url_count : 0,
        lastValidation: new Date().toISOString()
      }
    };
  }

  private generateMergeSimulationReport(simulation: MergeSimulation): MergeSimulationReport {
    // Determine conflict severity
    let conflictSeverity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (simulation.conflicts.length > 5) {
      conflictSeverity = 'HIGH';
    } else if (simulation.conflicts.length > 0) {
      conflictSeverity = 'MEDIUM';
    }

    // Check if only safe extensions are affected
    const safeExtensionsOnly = simulation.affectedFiles.every(file => 
      this.config.auto_merge.safe_extensions.some(ext => file.endsWith(ext))
    );

    // Count protected paths affected
    const protectedPathsAffected = this.config.protected_paths.filter(path =>
      simulation.affectedFiles.some(file => file.startsWith(path)) ||
      simulation.conflicts.some(file => file.startsWith(path))
    ).length;

    return {
      success: simulation.success,
      conflicts: simulation.conflicts,
      affectedFiles: simulation.affectedFiles,
      riskLevel: simulation.riskLevel,
      recommendation: simulation.recommendation,
      simulationTime: new Date().toISOString(),
      details: {
        protectedPathsAffected,
        safeExtensionsOnly,
        conflictSeverity
      }
    };
  }

  private assessOverallRisk(forkStatus: ForkStatus, featureStatus: FeatureStatus, simulation?: MergeSimulation): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (featureStatus.riskAssessment === 'CRITICAL') {
      return 'CRITICAL';
    }
    
    if (simulation?.conflicts.length && simulation.conflicts.length > 0) {
      return 'HIGH';
    }
    
    if (forkStatus.riskLevel === 'HIGH' || featureStatus.riskAssessment === 'WARNING') {
      return 'HIGH';
    }
    
    if (forkStatus.riskLevel === 'MEDIUM' || forkStatus.behind > 10) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }

  private generateRecommendations(
    forkStatus: ForkStatus,
    featureStatus: FeatureStatus,
    simulation?: MergeSimulation,
    conflictAnalysis?: ConflictAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Feature integrity recommendations
    if (featureStatus.missingFiles.length > 0) {
      recommendations.push('🔴 CRITICAL: Restore missing critical files immediately');
    }

    if (!featureStatus.forkUrlsValid) {
      recommendations.push('⚠️ Update fork-specific URL references to maintain proper attribution');
    }

    // Sync recommendations
    if (forkStatus.behind > 0) {
      if (simulation?.recommendation === 'AUTO_MERGE') {
        recommendations.push('✅ Safe to auto-merge - no conflicts with protected features detected');
      } else if (simulation?.recommendation === 'CREATE_REVIEW_PR') {
        recommendations.push('📋 Manual review required - protected paths affected by upstream changes');
      } else {
        recommendations.push('⚠️ Manual intervention required - resolve conflicts before proceeding');
      }
    }

    // Performance recommendations
    if (forkStatus.behind > 20) {
      recommendations.push('⏰ Fork is significantly behind - consider scheduling regular sync intervals');
    }

    // Security recommendations
    recommendations.push('🔒 Verify all upstream changes before merging to maintain security posture');

    return recommendations;
  }

  private determineActionRequired(forkStatus: ForkStatus, featureStatus: FeatureStatus, simulation?: MergeSimulation): boolean {
    // Critical issues require immediate action
    if (featureStatus.riskAssessment === 'CRITICAL') {
      return true;
    }

    // Conflicts require action
    if (simulation?.conflicts.length && simulation.conflicts.length > 0) {
      return true;
    }

    // High risk situations require action
    if (forkStatus.riskLevel === 'HIGH') {
      return true;
    }

    // Being significantly behind requires action
    if (forkStatus.behind > 10) {
      return true;
    }

    return false;
  }

  private generateNextSteps(
    forkStatus: ForkStatus,
    featureStatus: FeatureStatus,
    simulation?: MergeSimulation,
    riskLevel?: string
  ): NextStep[] {
    const steps: NextStep[] = [];

    // Handle critical file issues first
    if (featureStatus.missingFiles.length > 0) {
      steps.push({
        action: 'Restore Missing Critical Files',
        priority: 'HIGH',
        automated: false,
        description: 'Critical files for auto-accept-countdown feature are missing and must be restored',
        command: 'git checkout HEAD -- ' + featureStatus.missingFiles.join(' ')
      });
    }

    // Handle sync actions
    if (forkStatus.behind > 0) {
      if (simulation?.recommendation === 'AUTO_MERGE') {
        steps.push({
          action: 'Execute Auto-Merge',
          priority: 'MEDIUM',
          automated: true,
          description: 'Safely merge upstream changes automatically',
          command: 'Automated by workflow'
        });
      } else if (simulation?.recommendation === 'CREATE_REVIEW_PR') {
        steps.push({
          action: 'Review Generated PR',
          priority: 'HIGH',
          automated: false,
          description: 'Review and approve the auto-generated pull request for complex changes',
        });
      } else {
        steps.push({
          action: 'Manual Conflict Resolution',
          priority: 'HIGH',
          automated: false,
          description: 'Manually resolve merge conflicts and test feature integrity',
          command: 'git merge upstream/main'
        });
      }
    }

    // Post-merge validation
    if (steps.some(s => s.action.includes('Merge') || s.action.includes('Resolution'))) {
      steps.push({
        action: 'Validate Feature Integrity',
        priority: 'HIGH',
        automated: true,
        description: 'Run post-merge validation to ensure auto-accept-countdown feature works correctly',
        command: 'node specs/auto-accept-countdown/install.js --verify'
      });
    }

    // Monitoring
    steps.push({
      action: 'Monitor Next Sync Cycle',
      priority: 'LOW',
      automated: true,
      description: 'Continue monitoring for upstream changes in next scheduled run'
    });

    return steps;
  }

  // Helper methods for formatting
  private getHealthBadge(health: string): string {
    switch (health) {
      case 'HEALTHY': return '![Health](https://img.shields.io/badge/Health-Healthy-green)';
      case 'WARNING': return '![Health](https://img.shields.io/badge/Health-Warning-yellow)';
      case 'CRITICAL': return '![Health](https://img.shields.io/badge/Health-Critical-red)';
      default: return '![Health](https://img.shields.io/badge/Health-Unknown-gray)';
    }
  }

  private getSyncBadge(sync: string): string {
    switch (sync) {
      case 'UP_TO_DATE': return '![Sync](https://img.shields.io/badge/Sync-Up%20to%20Date-green)';
      case 'BEHIND': return '![Sync](https://img.shields.io/badge/Sync-Behind-yellow)';
      case 'AHEAD': return '![Sync](https://img.shields.io/badge/Sync-Ahead-blue)';
      case 'DIVERGED': return '![Sync](https://img.shields.io/badge/Sync-Diverged-orange)';
      default: return '![Sync](https://img.shields.io/badge/Sync-Unknown-gray)';
    }
  }

  private getProtectionBadge(protection: string): string {
    switch (protection) {
      case 'PROTECTED': return '![Protection](https://img.shields.io/badge/Protection-Active-green)';
      case 'AT_RISK': return '![Protection](https://img.shields.io/badge/Protection-At%20Risk-yellow)';
      case 'COMPROMISED': return '![Protection](https://img.shields.io/badge/Protection-Compromised-red)';
      default: return '![Protection](https://img.shields.io/badge/Protection-Unknown-gray)';
    }
  }

  private getStatusEmoji(status: string): string {
    if (status.includes('HEALTHY') || status.includes('PROTECTED')) return '✅';
    if (status.includes('WARNING') || status.includes('AT_RISK')) return '⚠️';
    if (status.includes('CRITICAL') || status.includes('COMPROMISED')) return '❌';
    return '❓';
  }

  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case 'LOW': return '🟢';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '❓';
    }
  }
}

// CLI interface for testing
if (require.main === module) {
  async function main() {
    try {
      const reporter = new StatusReporter();
      console.log('[CLI] Testing status reporter...');
      
      // Example report generation - would normally use real data
      console.log('[CLI] Status reporter initialized successfully');
      console.log('[CLI] Use reporter.generateComprehensiveReport() with actual status data');
      
    } catch (error) {
      console.error('[CLI] Error:', error);
      process.exit(1);
    }
  }
  
  main();
}