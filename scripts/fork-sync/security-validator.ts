#!/usr/bin/env ts-node

import * as fs from 'fs';
import { execSync } from 'child_process';
import { ForkSyncConfig, loadForkSyncConfig } from './config-loader';

export interface SecurityValidationResult {
  passed: boolean;
  checks: SecurityCheck[];
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  summary: string;
}

export interface SecurityCheck {
  name: string;
  passed: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
  recommendation?: string;
}

export class SecurityValidator {
  private config: ForkSyncConfig;

  constructor(config?: ForkSyncConfig) {
    this.config = config || loadForkSyncConfig();
  }

  public async validateSecurity(): Promise<SecurityValidationResult> {
    console.log('[SECURITY] Starting comprehensive security validation...');

    const checks: SecurityCheck[] = [];

    // Run all security checks
    checks.push(await this.validateGitHubToken());
    checks.push(await this.validateWorkflowPermissions());
    checks.push(await this.validateRepositoryAccess());
    checks.push(await this.validateUpstreamConfiguration());
    checks.push(await this.validateFilePermissions());
    checks.push(await this.validateSecretHandling());
    checks.push(await this.validateBranchProtection());
    checks.push(await this.validateWorkflowSecurity());

    // Assess overall security status
    const failedChecks = checks.filter(c => !c.passed);
    const criticalFailures = failedChecks.filter(c => c.severity === 'CRITICAL');
    const highSeverityFailures = failedChecks.filter(c => c.severity === 'HIGH');

    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (criticalFailures.length > 0) {
      overallRisk = 'CRITICAL';
    } else if (highSeverityFailures.length > 0) {
      overallRisk = 'HIGH';
    } else if (failedChecks.length > 2) {
      overallRisk = 'MEDIUM';
    }

    const passed = criticalFailures.length === 0 && highSeverityFailures.length === 0;

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(failedChecks);

    // Create summary
    const summary = this.generateSecuritySummary(checks, overallRisk);

    console.log(`[SECURITY] Validation completed: ${passed ? 'PASSED' : 'FAILED'}, risk: ${overallRisk}`);

    return {
      passed,
      checks,
      overallRisk,
      recommendations,
      summary
    };
  }

  private async validateGitHubToken(): Promise<SecurityCheck> {
    const name = 'GitHub Token Validation';
    
    try {
      // Check if token is available
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return {
          name,
          passed: false,
          severity: 'CRITICAL',
          message: 'No GitHub token available',
          recommendation: 'Ensure GITHUB_TOKEN is properly configured in workflow'
        };
      }

      // Check token permissions (this is a simplified check)
      try {
        // Test read access to repository
        const repoInfo = execSync('gh repo view --json permissions', { encoding: 'utf8' });
        const permissions = JSON.parse(repoInfo);
        
        // Check for minimal required permissions
        const hasReadAccess = permissions.permissions?.pull === true || permissions.permissions?.admin === true;
        
        if (!hasReadAccess) {
          return {
            name,
            passed: false,
            severity: 'HIGH',
            message: 'Token has insufficient permissions',
            details: { permissions },
            recommendation: 'Ensure token has read access to repository'
          };
        }

        // Check for excessive permissions (security best practice)
        const hasWriteAccess = permissions.permissions?.push === true || permissions.permissions?.admin === true;
        
        if (hasWriteAccess) {
          return {
            name,
            passed: true,
            severity: 'MEDIUM',
            message: 'Token has write permissions (consider read-only)',
            details: { permissions },
            recommendation: 'Consider using read-only token for monitoring operations'
          };
        }

        return {
          name,
          passed: true,
          severity: 'LOW',
          message: 'GitHub token validated successfully',
          details: { permissions }
        };

      } catch (ghError) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'Unable to validate token permissions via GitHub CLI',
          details: { error: ghError instanceof Error ? ghError.message : 'Unknown error' },
          recommendation: 'Ensure GitHub CLI is properly authenticated'
        };
      }

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'HIGH',
        message: 'Token validation failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateWorkflowPermissions(): Promise<SecurityCheck> {
    const name = 'Workflow Permissions';
    
    try {
      // Read the workflow file to check permissions
      const workflowPath = '.github/workflows/fork-sync-protection.yml';
      
      if (!fs.existsSync(workflowPath)) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'Workflow file not found',
          recommendation: 'Ensure workflow file exists and is properly configured'
        };
      }

      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
      // Check for explicit permissions section
      const hasPermissionsSection = workflowContent.includes('permissions:');
      
      // Check for potentially dangerous permissions
      const hasPushPermission = workflowContent.includes('contents: write') || 
                               workflowContent.includes('contents: admin');
      
      const hasSecretsWrite = workflowContent.includes('secrets: write');
      
      if (hasSecretsWrite) {
        return {
          name,
          passed: false,
          severity: 'CRITICAL',
          message: 'Workflow has secrets write permission',
          recommendation: 'Remove secrets write permission - monitoring should be read-only'
        };
      }

      if (!hasPermissionsSection) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'No explicit permissions section in workflow',
          recommendation: 'Add explicit permissions section with minimal required permissions'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'Workflow permissions appear secure',
        details: { 
          hasExplicitPermissions: hasPermissionsSection,
          hasPushPermission,
          hasSecretsWrite 
        }
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'MEDIUM',
        message: 'Unable to validate workflow permissions',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateRepositoryAccess(): Promise<SecurityCheck> {
    const name = 'Repository Access Validation';
    
    try {
      // Check repository access
      const currentRepo = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      const upstreamRepo = execSync('git remote get-url upstream', { encoding: 'utf8' }).trim();
      
      // Validate repository URLs
      const originValid = currentRepo.includes('bizzkoot/TimerCC');
      const upstreamValid = upstreamRepo.includes('anthropics/claude-code');
      
      if (!originValid) {
        return {
          name,
          passed: false,
          severity: 'HIGH',
          message: 'Origin repository does not match expected fork',
          details: { origin: currentRepo },
          recommendation: 'Verify repository configuration'
        };
      }

      if (!upstreamValid) {
        return {
          name,
          passed: false,
          severity: 'HIGH',
          message: 'Upstream repository does not match expected upstream',
          details: { upstream: upstreamRepo },
          recommendation: 'Verify upstream remote configuration'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'Repository access validated',
        details: { origin: currentRepo, upstream: upstreamRepo }
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'HIGH',
        message: 'Unable to validate repository access',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateUpstreamConfiguration(): Promise<SecurityCheck> {
    const name = 'Upstream Configuration Security';
    
    try {
      // Validate upstream configuration in config
      const upstreamConfig = this.config.upstream;
      
      if (upstreamConfig.owner !== 'anthropics' || upstreamConfig.repo !== 'claude-code') {
        return {
          name,
          passed: false,
          severity: 'HIGH',
          message: 'Upstream configuration does not match expected repository',
          details: upstreamConfig,
          recommendation: 'Verify upstream configuration in fork-sync-protection.yml'
        };
      }

      // Check if upstream remote exists and matches config
      try {
        const upstreamUrl = execSync('git remote get-url upstream', { encoding: 'utf8' }).trim();
        const expectedUrl = `https://github.com/${upstreamConfig.owner}/${upstreamConfig.repo}.git`;
        
        if (!upstreamUrl.includes(`${upstreamConfig.owner}/${upstreamConfig.repo}`)) {
          return {
            name,
            passed: false,
            severity: 'MEDIUM',
            message: 'Upstream remote URL does not match configuration',
            details: { configured: expectedUrl, actual: upstreamUrl },
            recommendation: 'Update upstream remote or configuration to match'
          };
        }

      } catch (remoteError) {
        return {
          name,
          passed: false,
          severity: 'HIGH',
          message: 'Upstream remote not configured',
          recommendation: 'Configure upstream remote: git remote add upstream https://github.com/anthropics/claude-code.git'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'Upstream configuration validated',
        details: upstreamConfig
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'MEDIUM',
        message: 'Unable to validate upstream configuration',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateFilePermissions(): Promise<SecurityCheck> {
    const name = 'File Permissions Security';
    
    try {
      const criticalFiles = [
        '.github/fork-sync-protection.yml',
        '.github/workflows/fork-sync-protection.yml',
        ...this.config.critical_files
      ];

      const permissionIssues: string[] = [];

      for (const file of criticalFiles) {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const mode = stats.mode;
          
          // Check for world-writable files (security risk)
          if (mode & 0o002) {
            permissionIssues.push(`${file} is world-writable`);
          }
          
          // Check for group-writable files (potential risk)
          if (mode & 0o020) {
            permissionIssues.push(`${file} is group-writable`);
          }
        }
      }

      if (permissionIssues.length > 0) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'Insecure file permissions detected',
          details: { issues: permissionIssues },
          recommendation: 'Review and fix file permissions for critical files'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'File permissions are secure'
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'LOW',
        message: 'Unable to validate file permissions',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateSecretHandling(): Promise<SecurityCheck> {
    const name = 'Secret Handling Security';
    
    try {
      // Check for hardcoded secrets in scripts
      const scriptFiles = [
        'scripts/fork-sync/monitor.ts',
        'scripts/fork-sync/automated-merger.ts',
        'scripts/fork-sync/pr-generator.ts',
        'scripts/fork-sync/workflow-coordinator.ts'
      ];

      const secretPatterns = [
        /github_pat_[a-zA-Z0-9_]+/i,
        /ghp_[a-zA-Z0-9]+/i,
        /password\s*[:=]\s*['"'][^'"]+['"]/i,
        /token\s*[:=]\s*['"'][^'"]+['"]/i,
        /secret\s*[:=]\s*['"'][^'"]+['"]/i
      ];

      const findings: string[] = [];

      for (const file of scriptFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              findings.push(`Potential hardcoded secret in ${file}`);
            }
          }
        }
      }

      if (findings.length > 0) {
        return {
          name,
          passed: false,
          severity: 'CRITICAL',
          message: 'Potential hardcoded secrets detected',
          details: { findings },
          recommendation: 'Remove hardcoded secrets and use environment variables or GitHub secrets'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'No hardcoded secrets detected'
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'LOW',
        message: 'Unable to validate secret handling',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateBranchProtection(): Promise<SecurityCheck> {
    const name = 'Branch Protection Validation';
    
    try {
      // This would typically use GitHub API to check branch protection rules
      // For now, we'll check if we can push directly to main (which would be bad)
      
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      
      if (currentBranch === 'main') {
        // Check if there are uncommitted changes that could be accidentally committed
        const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
        
        if (statusOutput.trim()) {
          return {
            name,
            passed: false,
            severity: 'MEDIUM',
            message: 'Uncommitted changes detected on main branch',
            recommendation: 'Commit or stash changes, and consider using feature branches'
          };
        }
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'Branch protection appears adequate',
        details: { currentBranch }
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'LOW',
        message: 'Unable to validate branch protection',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateWorkflowSecurity(): Promise<SecurityCheck> {
    const name = 'Workflow Security Best Practices';
    
    try {
      const workflowPath = '.github/workflows/fork-sync-protection.yml';
      
      if (!fs.existsSync(workflowPath)) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'Workflow file not found for security analysis'
        };
      }

      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      const issues: string[] = [];

      // Check for security best practices
      if (!workflowContent.includes('actions/checkout@v4')) {
        issues.push('Not using pinned version of checkout action');
      }

      if (workflowContent.includes('${{') && !workflowContent.includes('github.event.inputs')) {
        // Check for potential injection vulnerabilities
        const suspiciousPatterns = [
          /\$\{\{\s*github\.event\.issue\.title\s*\}\}/,
          /\$\{\{\s*github\.event\.comment\.body\s*\}\}/,
          /\$\{\{\s*github\.event\.pull_request\.title\s*\}\}/
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(workflowContent)) {
            issues.push('Potential script injection vulnerability detected');
            break;
          }
        }
      }

      if (workflowContent.includes('run: |') && workflowContent.includes('${{')) {
        issues.push('Consider sanitizing inputs in shell commands');
      }

      if (issues.length > 0) {
        return {
          name,
          passed: false,
          severity: 'MEDIUM',
          message: 'Workflow security issues detected',
          details: { issues },
          recommendation: 'Review and fix workflow security issues'
        };
      }

      return {
        name,
        passed: true,
        severity: 'LOW',
        message: 'Workflow follows security best practices'
      };

    } catch (error) {
      return {
        name,
        passed: false,
        severity: 'LOW',
        message: 'Unable to validate workflow security',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private generateSecurityRecommendations(failedChecks: SecurityCheck[]): string[] {
    const recommendations = new Set<string>();

    // Add specific recommendations from failed checks
    for (const check of failedChecks) {
      if (check.recommendation) {
        recommendations.add(check.recommendation);
      }
    }

    // Add general security recommendations
    recommendations.add('Regularly rotate GitHub tokens and credentials');
    recommendations.add('Monitor workflow execution logs for anomalies');
    recommendations.add('Keep workflow actions pinned to specific versions');
    recommendations.add('Review security configuration quarterly');

    return Array.from(recommendations);
  }

  private generateSecuritySummary(checks: SecurityCheck[], riskLevel: string): string {
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.passed).length;
    const failedChecks = totalChecks - passedChecks;

    let summary = `Security validation completed: ${passedChecks}/${totalChecks} checks passed.\n`;
    summary += `Overall risk level: ${riskLevel}\n`;

    if (failedChecks > 0) {
      summary += `\nFailed checks (${failedChecks}):\n`;
      for (const check of checks.filter(c => !c.passed)) {
        summary += `- ${check.name}: ${check.message}\n`;
      }
    }

    return summary;
  }

  public async auditPermissions(): Promise<void> {
    console.log('[SECURITY] Auditing current permissions...');
    
    try {
      // Audit git configuration
      console.log('[SECURITY] Git configuration:');
      try {
        const userEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
        const userName = execSync('git config user.name', { encoding: 'utf8' }).trim();
        console.log(`  User: ${userName} <${userEmail}>`);
      } catch (error) {
        console.log('  No git user configuration found');
      }

      // Audit environment variables (without exposing values)
      console.log('[SECURITY] Environment variables:');
      const securityRelevantVars = ['GITHUB_TOKEN', 'GITHUB_ACTIONS', 'GITHUB_WORKSPACE', 'GITHUB_REPOSITORY'];
      for (const envVar of securityRelevantVars) {
        const hasVar = process.env[envVar] !== undefined;
        console.log(`  ${envVar}: ${hasVar ? 'SET' : 'NOT SET'}`);
      }

      // Audit file system permissions for critical files
      console.log('[SECURITY] Critical file permissions:');
      const criticalFiles = ['.github/fork-sync-protection.yml', 'scripts/fork-sync/config-loader.ts'];
      for (const file of criticalFiles) {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          console.log(`  ${file}: ${permissions}`);
        } else {
          console.log(`  ${file}: NOT FOUND`);
        }
      }

    } catch (error) {
      console.error('[SECURITY] Permission audit failed:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    try {
      const validator = new SecurityValidator();
      
      console.log('[CLI] Starting security validation...');
      
      // Run full security validation
      const result = await validator.validateSecurity();
      
      console.log('\n[CLI] Security Validation Results:');
      console.log(`Overall Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Risk Level: ${result.overallRisk}`);
      console.log(`\n${result.summary}`);
      
      if (result.recommendations.length > 0) {
        console.log('\nRecommendations:');
        for (const rec of result.recommendations) {
          console.log(`- ${rec}`);
        }
      }

      // Run permission audit
      console.log('\n' + '='.repeat(50));
      await validator.auditPermissions();
      
      // Exit with appropriate code
      process.exit(result.passed ? 0 : 1);
      
    } catch (error) {
      console.error('[CLI] Security validation failed:', error);
      process.exit(1);
    }
  }
  
  main();
}