#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { ForkSyncConfig, loadForkSyncConfig } from './config-loader';
import { MergeSimulation, ForkStatus, FeatureStatus } from './monitor';

export interface PullRequest {
  number?: number;
  url?: string;
  title: string;
  body: string;
  success: boolean;
  message: string;
}

export interface ConflictAnalysis {
  conflicts: string[];
  protectedPathsAffected: string[];
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolutionSuggestions: string[];
  upstreamChanges: UpstreamChange[];
}

export interface UpstreamChange {
  commitSha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export interface PRContext {
  forkStatus: ForkStatus;
  featureStatus: FeatureStatus;
  simulation: MergeSimulation;
  conflictAnalysis: ConflictAnalysis;
  upstreamRef: string;
}

export class PRGenerator {
  private config: ForkSyncConfig;

  constructor(config?: ForkSyncConfig) {
    this.config = config || loadForkSyncConfig();
  }

  public async createReviewPR(analysis: ConflictAnalysis, context: PRContext): Promise<PullRequest> {
    console.log('[PR_GEN] Creating review PR for complex changes...');

    try {
      // Create a review branch with the upstream changes
      const reviewBranch = `upstream-sync-review-${Date.now()}`;
      console.log(`[PR_GEN] Creating review branch: ${reviewBranch}`);
      
      execSync(`git checkout -b ${reviewBranch}`);
      
      try {
        // Attempt to merge upstream changes
        execSync(`git merge ${context.upstreamRef} --no-commit --no-ff`);
        
        // Create merge commit with detailed message
        const mergeMessage = this.generateMergeMessage(context);
        execSync(`git commit -m "${mergeMessage.replace(/"/g, '\\"')}"`);
        
        // Push the review branch
        execSync(`git push -u origin ${reviewBranch}`);
        
      } catch (mergeError) {
        // If merge fails, commit the conflicted state for review
        execSync('git add .');
        const conflictMessage = this.generateConflictMessage(context);
        execSync(`git commit -m "${conflictMessage.replace(/"/g, '\\"')}"`);
        execSync(`git push -u origin ${reviewBranch}`);
      }

      // Generate PR content
      const title = this.generatePRTitle(analysis, context);
      const body = this.generatePRBody(analysis, context);

      // Create the PR using GitHub CLI
      const prResult = await this.createGitHubPR(reviewBranch, title, body);
      
      console.log(`[PR_GEN] PR created successfully: ${prResult.url}`);
      return prResult;

    } catch (error) {
      console.error('[PR_GEN] Failed to create review PR:', error);
      
      // Cleanup: try to return to main and delete branch
      try {
        execSync('git checkout main');
        execSync(`git branch -D ${reviewBranch} || true`);
        execSync(`git push origin --delete ${reviewBranch} || true`);
      } catch (cleanupError) {
        console.warn('[PR_GEN] Cleanup warning:', cleanupError);
      }

      return {
        title: '',
        body: '',
        success: false,
        message: `Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public async generateImpactReport(changes: UpstreamChange[]): Promise<string> {
    console.log('[PR_GEN] Generating impact analysis report...');

    let report = `## 📊 Upstream Changes Impact Analysis\n\n`;
    
    // Summary statistics
    const totalCommits = changes.length;
    const totalFiles = new Set(changes.flatMap(c => c.filesChanged)).size;
    const protectedFiles = changes.flatMap(c => c.filesChanged).filter(file =>
      this.config.protected_paths.some(path => file.startsWith(path))
    );

    report += `**Summary:**\n`;
    report += `- ${totalCommits} upstream commits to review\n`;
    report += `- ${totalFiles} unique files affected\n`;
    report += `- ${protectedFiles.length} protected files potentially impacted\n\n`;

    // Risk assessment
    const riskLevel = this.assessChangeRisk(changes);
    const riskEmoji = riskLevel === 'CRITICAL' ? '🔴' : riskLevel === 'HIGH' ? '🟠' : riskLevel === 'MEDIUM' ? '🟡' : '🟢';
    report += `**Risk Level:** ${riskEmoji} ${riskLevel}\n\n`;

    // Protected paths analysis
    if (protectedFiles.length > 0) {
      report += `### 🛡️ Protected Paths Impact\n`;
      const protectedPaths = this.config.protected_paths.filter(path =>
        changes.some(c => c.filesChanged.some(file => file.startsWith(path)))
      );
      
      for (const path of protectedPaths) {
        const affectedFiles = protectedFiles.filter(file => file.startsWith(path));
        report += `- **${path}**: ${affectedFiles.length} files affected\n`;
        for (const file of affectedFiles.slice(0, 5)) {
          report += `  - ${file}\n`;
        }
        if (affectedFiles.length > 5) {
          report += `  - ... and ${affectedFiles.length - 5} more\n`;
        }
      }
      report += `\n`;
    }

    // Recent commits breakdown
    report += `### 📝 Recent Upstream Commits\n`;
    for (const change of changes.slice(0, 10)) {
      const shortSha = change.commitSha.substring(0, 8);
      const shortMessage = change.message.length > 60 ? 
        change.message.substring(0, 60) + '...' : change.message;
      report += `- \`${shortSha}\` ${shortMessage} (${change.author})\n`;
    }
    if (changes.length > 10) {
      report += `- ... and ${changes.length - 10} more commits\n`;
    }
    report += `\n`;

    return report;
  }

  public templatePRDescription(context: PRContext): string {
    const template = this.config.pr_generation.title_template;
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      switch (key) {
        case 'riskLevel': return context.simulation.riskLevel;
        case 'conflictCount': return context.simulation.conflicts.length.toString();
        case 'fileCount': return context.simulation.affectedFiles.length.toString();
        default: return match;
      }
    });
  }

  private generatePRTitle(analysis: ConflictAnalysis, context: PRContext): string {
    const baseTitle = this.config.pr_generation.title_template;
    
    if (context.simulation.conflicts.length > 0) {
      return `${baseTitle} - ${context.simulation.conflicts.length} conflicts`;
    } else {
      return `${baseTitle} - Protected paths affected`;
    }
  }

  private generatePRBody(analysis: ConflictAnalysis, context: PRContext): string {
    let body = `## 🔄 Upstream Sync Review Required\n\n`;
    
    body += `This PR contains upstream changes that require manual review due to complexity or potential impact on fork-specific features.\n\n`;

    // Status overview
    body += `### 📊 Status Overview\n`;
    body += `| Item | Status |\n`;
    body += `|------|--------|\n`;
    body += `| Commits behind upstream | ${context.forkStatus.behind} |\n`;
    body += `| Auto-accept-countdown status | ${context.featureStatus.riskAssessment} |\n`;
    body += `| Merge conflicts | ${context.simulation.conflicts.length} |\n`;
    body += `| Protected paths affected | ${analysis.protectedPathsAffected.length} |\n`;
    body += `| Risk assessment | ${analysis.riskAssessment} |\n\n`;

    // Conflict details
    if (context.simulation.conflicts.length > 0) {
      body += `### ⚠️ Merge Conflicts\n`;
      body += `The following files have merge conflicts that need manual resolution:\n\n`;
      for (const conflict of context.simulation.conflicts) {
        body += `- \`${conflict}\`\n`;
      }
      body += `\n`;
    }

    // Protected paths impact
    if (analysis.protectedPathsAffected.length > 0) {
      body += `### 🛡️ Protected Paths Affected\n`;
      body += `The following protected paths are impacted by upstream changes:\n\n`;
      for (const path of analysis.protectedPathsAffected) {
        body += `- \`${path}\`\n`;
      }
      body += `\n**⚠️ Careful review required to ensure auto-accept-countdown feature integrity.**\n\n`;
    }

    // Resolution suggestions
    if (analysis.resolutionSuggestions.length > 0) {
      body += `### 💡 Resolution Suggestions\n`;
      for (let i = 0; i < analysis.resolutionSuggestions.length; i++) {
        body += `${i + 1}. ${analysis.resolutionSuggestions[i]}\n`;
      }
      body += `\n`;
    }

    // Testing recommendations
    body += `### 🧪 Testing Recommendations\n`;
    body += `After resolving conflicts and merging, please test:\n\n`;
    body += `1. **Feature Installation**: \`node specs/auto-accept-countdown/install.js --dry-run\`\n`;
    body += `2. **Feature Verification**: \`node specs/auto-accept-countdown/install.js --verify\`\n`;
    body += `3. **TypeScript Compilation**: Check that all TS files compile correctly\n`;
    body += `4. **URL References**: Verify fork-specific URLs are preserved\n\n`;

    // Upstream changes summary
    if (analysis.upstreamChanges.length > 0) {
      body += `### 📝 Upstream Changes Summary\n`;
      body += `<details>\n<summary>Click to view ${analysis.upstreamChanges.length} upstream commits</summary>\n\n`;
      
      for (const change of analysis.upstreamChanges.slice(0, 20)) {
        const shortSha = change.commitSha.substring(0, 8);
        body += `- [\`${shortSha}\`](https://github.com/anthropics/claude-code/commit/${change.commitSha}) ${change.message} (@${change.author})\n`;
      }
      
      if (analysis.upstreamChanges.length > 20) {
        body += `- ... and ${analysis.upstreamChanges.length - 20} more commits\n`;
      }
      
      body += `\n</details>\n\n`;
    }

    // Auto-generated footer
    body += `---\n`;
    body += `🤖 This PR was automatically generated by the Fork Sync Protection System.\n`;
    body += `Workflow run: https://github.com/bizzkoot/TimerCC/actions/runs/${process.env.GITHUB_RUN_ID || 'manual'}\n`;
    body += `Generated at: ${new Date().toISOString()}`;

    return body;
  }

  private generateMergeMessage(context: PRContext): string {
    return `WIP: Upstream sync review - ${context.forkStatus.behind} commits

This commit contains upstream changes that require review:
- Commits: ${context.forkStatus.behind}
- Files affected: ${context.simulation.affectedFiles.length}
- Risk level: ${context.simulation.riskLevel}

Auto-accept-countdown feature status: ${context.featureStatus.riskAssessment}

Review and test before merging to main.`;
  }

  private generateConflictMessage(context: PRContext): string {
    return `WIP: Upstream sync with conflicts - manual resolution required

Merge conflicts detected during upstream sync:
- Conflicts: ${context.simulation.conflicts.length}
- Protected paths affected: ${context.conflictAnalysis?.protectedPathsAffected.length || 0}

Files with conflicts:
${context.simulation.conflicts.map(f => `- ${f}`).join('\n')}

Manual resolution required before merging.`;
  }

  private async createGitHubPR(branch: string, title: string, body: string): Promise<PullRequest> {
    try {
      // Use GitHub CLI to create PR
      const labels = this.config.pr_generation.labels.join(',');
      const reviewers = this.config.pr_generation.reviewers.join(',');
      
      let ghCommand = `gh pr create --title "${title.replace(/"/g, '\\"')}" --body-file -`;
      if (labels) {
        ghCommand += ` --label "${labels}"`;
      }
      if (reviewers) {
        ghCommand += ` --reviewer "${reviewers}"`;
      }

      // Create PR using stdin for body to handle multiline content
      const result = execSync(ghCommand, { 
        input: body, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Extract PR URL from gh output
      const prUrl = result.trim();
      const prNumber = prUrl.match(/\/pull\/(\d+)$/)?.[1];

      return {
        number: prNumber ? parseInt(prNumber) : undefined,
        url: prUrl,
        title,
        body,
        success: true,
        message: 'PR created successfully'
      };

    } catch (error) {
      console.error('[PR_GEN] GitHub CLI error:', error);
      
      return {
        title,
        body,
        success: false,
        message: `GitHub CLI failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private assessChangeRisk(changes: UpstreamChange[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const protectedFiles = changes.flatMap(c => c.filesChanged).filter(file =>
      this.config.protected_paths.some(path => file.startsWith(path))
    );

    const criticalFiles = changes.flatMap(c => c.filesChanged).filter(file =>
      this.config.critical_files.includes(file)
    );

    if (criticalFiles.length > 0) {
      return 'CRITICAL';
    } else if (protectedFiles.length > 3) {
      return 'HIGH';
    } else if (protectedFiles.length > 0) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  public async analyzeConflicts(simulation: MergeSimulation, upstreamRef: string): Promise<ConflictAnalysis> {
    console.log('[PR_GEN] Analyzing conflicts and upstream changes...');

    // Get upstream changes
    const upstreamChanges = await this.getUpstreamChanges(upstreamRef);

    // Identify protected paths affected
    const protectedPathsAffected = this.config.protected_paths.filter(path =>
      simulation.affectedFiles.some(file => file.startsWith(path)) ||
      simulation.conflicts.some(file => file.startsWith(path))
    );

    // Assess risk level
    const riskAssessment = this.assessConflictRisk(simulation, protectedPathsAffected);

    // Generate resolution suggestions
    const resolutionSuggestions = this.generateResolutionSuggestions(simulation, protectedPathsAffected);

    return {
      conflicts: simulation.conflicts,
      protectedPathsAffected,
      riskAssessment,
      resolutionSuggestions,
      upstreamChanges
    };
  }

  private async getUpstreamChanges(upstreamRef: string): Promise<UpstreamChange[]> {
    try {
      const logOutput = execSync(
        `git log HEAD..${upstreamRef} --pretty=format:"%H|%s|%an|%ad" --date=iso`,
        { encoding: 'utf8' }
      );

      const changes: UpstreamChange[] = [];
      
      for (const line of logOutput.split('\n').filter(l => l.trim())) {
        const [commitSha, message, author, date] = line.split('|');
        
        // Get files changed in this commit
        const filesOutput = execSync(
          `git diff-tree --no-commit-id --name-only -r ${commitSha}`,
          { encoding: 'utf8' }
        );
        const filesChanged = filesOutput.split('\n').filter(f => f.trim());

        changes.push({
          commitSha,
          message,
          author,
          date,
          filesChanged
        });
      }

      return changes;
    } catch (error) {
      console.warn('[PR_GEN] Could not get upstream changes:', error);
      return [];
    }
  }

  private assessConflictRisk(simulation: MergeSimulation, protectedPaths: string[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (simulation.conflicts.some(file => this.config.critical_files.includes(file))) {
      return 'CRITICAL';
    } else if (simulation.conflicts.length > 5) {
      return 'HIGH';
    } else if (protectedPaths.length > 0) {
      return 'HIGH';
    } else if (simulation.conflicts.length > 0) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private generateResolutionSuggestions(simulation: MergeSimulation, protectedPaths: string[]): string[] {
    const suggestions: string[] = [];

    if (simulation.conflicts.length > 0) {
      suggestions.push('Resolve merge conflicts manually using `git status` and `git mergetool`');
      suggestions.push('Pay special attention to conflicts in protected paths');
    }

    if (protectedPaths.includes('specs/auto-accept-countdown/')) {
      suggestions.push('Verify auto-accept-countdown feature files are not broken by upstream changes');
      suggestions.push('Test feature installation after conflict resolution');
    }

    if (protectedPaths.includes('.claude/commands/')) {
      suggestions.push('Check that timer/countdown commands are properly preserved');
    }

    suggestions.push('Run comprehensive validation: `node scripts/fork-sync/automated-merger.ts`');
    suggestions.push('Test end-to-end: install, verify, and run auto-accept-countdown feature');

    return suggestions;
  }
}

// CLI interface for testing
if (require.main === module) {
  async function main() {
    try {
      const generator = new PRGenerator();
      console.log('[CLI] Testing PR generator...');
      
      // Example usage - would normally be called with real data
      console.log('[CLI] PR generator initialized successfully');
      console.log('[CLI] Use generator.createReviewPR() with actual conflict analysis');
      
    } catch (error) {
      console.error('[CLI] Error:', error);
      process.exit(1);
    }
  }
  
  main();
}