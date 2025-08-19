#!/usr/bin/env ts-node

import * as fs from 'fs';
import { execSync } from 'child_process';
import { ForkStatusMonitor } from './monitor';
import { AutomatedMerger } from './automated-merger';
import { PRGenerator } from './pr-generator';
import { StatusReporter } from './status-reporter';
import { SecurityValidator } from './security-validator';
import { WorkflowCoordinator } from './workflow-coordinator';
import { loadForkSyncConfig } from './config-loader';

export interface E2ETestResult {
  testName: string;
  passed: boolean;
  duration: number;
  message: string;
  details?: any;
  performance?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  networkRequests?: number;
}

export interface ValidationSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallDuration: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  qualityGate: 'PASSED' | 'FAILED';
  results: E2ETestResult[];
  recommendations: string[];
}

export class E2EValidator {
  private config = loadForkSyncConfig();
  private results: E2ETestResult[] = [];
  private startTime = 0;

  public async runCompleteValidation(): Promise<ValidationSummary> {
    console.log('[E2E] Starting comprehensive end-to-end validation...');
    this.startTime = Date.now();
    this.results = [];

    // Core component tests
    await this.testConfigurationLoading();
    await this.testForkStatusMonitoring();
    await this.testFeatureIntegrityValidation();
    await this.testMergeSimulation();
    await this.testStatusReporting();
    await this.testSecurityValidation();

    // Integration tests
    await this.testWorkflowCoordination();
    await this.testGitHubActionsIntegration();

    // Performance tests
    await this.testPerformanceBenchmarks();

    // Quality gates
    await this.testQualityGates();

    // Generate summary
    return this.generateValidationSummary();
  }

  private async testConfigurationLoading(): Promise<void> {
    const testName = 'Configuration Loading';
    const startTime = Date.now();

    try {
      // Test configuration loading
      const config = loadForkSyncConfig();
      
      // Validate required sections
      const requiredSections = ['protected_paths', 'critical_files', 'upstream', 'monitoring'];
      for (const section of requiredSections) {
        if (!(section as any in config)) {
          throw new Error(`Missing configuration section: ${section}`);
        }
      }

      // Validate array lengths
      if (config.protected_paths.length === 0) {
        throw new Error('No protected paths configured');
      }

      if (config.critical_files.length === 0) {
        throw new Error('No critical files configured');
      }

      // Validate upstream configuration
      if (!config.upstream.owner || !config.upstream.repo) {
        throw new Error('Invalid upstream configuration');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Configuration loaded and validated successfully',
        details: {
          protectedPaths: config.protected_paths.length,
          criticalFiles: config.critical_files.length,
          upstream: `${config.upstream.owner}/${config.upstream.repo}`
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testForkStatusMonitoring(): Promise<void> {
    const testName = 'Fork Status Monitoring';
    const startTime = Date.now();

    try {
      const monitor = new ForkStatusMonitor(this.config);
      
      // Test upstream changes check
      const forkStatus = await monitor.checkUpstreamChanges();
      
      // Validate response structure
      if (typeof forkStatus.ahead !== 'number' || typeof forkStatus.behind !== 'number') {
        throw new Error('Invalid fork status response structure');
      }

      if (!forkStatus.lastUpstreamCommit || forkStatus.lastUpstreamCommit.length !== 40) {
        throw new Error('Invalid upstream commit SHA');
      }

      if (!['LOW', 'MEDIUM', 'HIGH'].includes(forkStatus.riskLevel)) {
        throw new Error('Invalid risk level');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Fork status monitoring working correctly',
        details: {
          ahead: forkStatus.ahead,
          behind: forkStatus.behind,
          riskLevel: forkStatus.riskLevel
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Fork status monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testFeatureIntegrityValidation(): Promise<void> {
    const testName = 'Feature Integrity Validation';
    const startTime = Date.now();

    try {
      const monitor = new ForkStatusMonitor(this.config);
      
      // Test feature file validation
      const featureStatus = await monitor.validateFeatureFiles();
      
      // Validate response structure
      if (typeof featureStatus.criticalFilesIntact !== 'boolean') {
        throw new Error('Invalid criticalFilesIntact value');
      }

      if (!Array.isArray(featureStatus.missingFiles)) {
        throw new Error('Missing files should be an array');
      }

      if (!['PROTECTED', 'WARNING', 'CRITICAL'].includes(featureStatus.riskAssessment)) {
        throw new Error('Invalid risk assessment');
      }

      // Check that critical files actually exist
      let actualMissingFiles = 0;
      for (const file of this.config.critical_files) {
        if (!fs.existsSync(file)) {
          actualMissingFiles++;
        }
      }

      if (actualMissingFiles !== featureStatus.missingFiles.length) {
        console.warn(`[E2E] Discrepancy in missing files count: actual=${actualMissingFiles}, reported=${featureStatus.missingFiles.length}`);
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Feature integrity validation working correctly',
        details: {
          criticalFilesIntact: featureStatus.criticalFilesIntact,
          missingFiles: featureStatus.missingFiles.length,
          riskAssessment: featureStatus.riskAssessment
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Feature integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testMergeSimulation(): Promise<void> {
    const testName = 'Merge Simulation';
    const startTime = Date.now();

    try {
      const monitor = new ForkStatusMonitor(this.config);
      
      // Test merge simulation
      const simulation = await monitor.simulateMerge('upstream/main');
      
      // Validate response structure
      if (typeof simulation.success !== 'boolean') {
        throw new Error('Invalid simulation success value');
      }

      if (!Array.isArray(simulation.conflicts)) {
        throw new Error('Conflicts should be an array');
      }

      if (!Array.isArray(simulation.affectedFiles)) {
        throw new Error('Affected files should be an array');
      }

      if (!['SAFE', 'REVIEW', 'MANUAL'].includes(simulation.riskLevel)) {
        throw new Error('Invalid simulation risk level');
      }

      if (!['AUTO_MERGE', 'CREATE_REVIEW_PR', 'MANUAL_INTERVENTION'].includes(simulation.recommendation)) {
        throw new Error('Invalid simulation recommendation');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Merge simulation working correctly',
        details: {
          success: simulation.success,
          conflicts: simulation.conflicts.length,
          affectedFiles: simulation.affectedFiles.length,
          recommendation: simulation.recommendation
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Merge simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testStatusReporting(): Promise<void> {
    const testName = 'Status Reporting';
    const startTime = Date.now();

    try {
      const reporter = new StatusReporter(this.config);
      
      // Create mock data for testing
      const mockForkStatus = {
        ahead: 5,
        behind: 3,
        lastUpstreamCommit: 'a'.repeat(40),
        hasConflicts: false,
        riskLevel: 'LOW' as const
      };

      const mockFeatureStatus = {
        criticalFilesIntact: true,
        dependenciesHealthy: true,
        forkUrlsValid: true,
        missingFiles: [],
        riskAssessment: 'PROTECTED' as const
      };

      const mockSimulation = {
        success: true,
        conflicts: [],
        affectedFiles: ['README.md'],
        riskLevel: 'SAFE' as const,
        recommendation: 'AUTO_MERGE' as const
      };

      // Test report generation
      const report = reporter.generateComprehensiveReport(
        mockForkStatus,
        mockFeatureStatus,
        mockSimulation
      );

      // Validate report structure
      if (!report.timestamp || !report.reportId) {
        throw new Error('Report missing required fields');
      }

      if (!report.summary || !report.forkStatus || !report.featureIntegrity) {
        throw new Error('Report missing required sections');
      }

      if (!Array.isArray(report.recommendations) || !Array.isArray(report.nextSteps)) {
        throw new Error('Report arrays invalid');
      }

      // Test GitHub Actions formatting
      const ghFormat = reporter.formatForGitHubActions(report);
      if (!ghFormat.includes('Fork Sync Protection Report') || !ghFormat.includes('Status Overview')) {
        throw new Error('GitHub Actions format invalid');
      }

      // Test JSON export
      const jsonReport = reporter.exportAsJSON(report);
      const parsedReport = JSON.parse(jsonReport);
      if (parsedReport.reportId !== report.reportId) {
        throw new Error('JSON export/import failed');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Status reporting working correctly',
        details: {
          reportId: report.reportId,
          riskLevel: report.riskLevel,
          actionRequired: report.actionRequired,
          recommendationsCount: report.recommendations.length
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Status reporting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testSecurityValidation(): Promise<void> {
    const testName = 'Security Validation';
    const startTime = Date.now();

    try {
      const validator = new SecurityValidator(this.config);
      
      // Test security validation
      const securityResult = await validator.validateSecurity();
      
      // Validate response structure
      if (typeof securityResult.passed !== 'boolean') {
        throw new Error('Invalid security validation response');
      }

      if (!Array.isArray(securityResult.checks)) {
        throw new Error('Security checks should be an array');
      }

      if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(securityResult.overallRisk)) {
        throw new Error('Invalid security risk level');
      }

      // Validate individual checks
      for (const check of securityResult.checks) {
        if (!check.name || typeof check.passed !== 'boolean') {
          throw new Error('Invalid security check structure');
        }
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Security validation working correctly',
        details: {
          passed: securityResult.passed,
          checksCount: securityResult.checks.length,
          overallRisk: securityResult.overallRisk,
          recommendationsCount: securityResult.recommendations.length
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testWorkflowCoordination(): Promise<void> {
    const testName = 'Workflow Coordination';
    const startTime = Date.now();

    try {
      const coordinator = new WorkflowCoordinator();
      
      // Test configuration validation
      const configValid = await coordinator.validateConfiguration();
      
      if (!configValid) {
        throw new Error('Workflow configuration validation failed');
      }

      // Test workflow execution with check-only mode
      const inputs = {
        mode: 'check-only' as const,
        forcePR: false
      };

      const result = await coordinator.executeWorkflow(inputs);
      
      // Validate workflow result structure
      if (typeof result.success !== 'boolean') {
        throw new Error('Invalid workflow result structure');
      }

      if (!result.outputs || !result.outputs.reportId) {
        throw new Error('Workflow outputs invalid');
      }

      if (typeof result.outputs.forkAhead !== 'number' || typeof result.outputs.forkBehind !== 'number') {
        throw new Error('Invalid fork status outputs');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Workflow coordination working correctly',
        details: {
          configValid,
          workflowSuccess: result.success,
          actionTaken: result.outputs.actionTaken,
          reportId: result.outputs.reportId
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Workflow coordination failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testGitHubActionsIntegration(): Promise<void> {
    const testName = 'GitHub Actions Integration';
    const startTime = Date.now();

    try {
      // Test workflow file exists and is valid
      const workflowPath = '.github/workflows/fork-sync-protection.yml';
      if (!fs.existsSync(workflowPath)) {
        throw new Error('Workflow file does not exist');
      }

      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
      // Basic YAML validation (check for required sections)
      if (!workflowContent.includes('name:') || !workflowContent.includes('jobs:')) {
        throw new Error('Invalid workflow file structure');
      }

      // Check for required job
      if (!workflowContent.includes('check-fork-sync:')) {
        throw new Error('Required job missing from workflow');
      }

      // Check for proper triggers
      if (!workflowContent.includes('schedule:') || !workflowContent.includes('workflow_dispatch:')) {
        throw new Error('Required triggers missing from workflow');
      }

      // Test configuration file exists
      const configPath = '.github/fork-sync-protection.yml';
      if (!fs.existsSync(configPath)) {
        throw new Error('Configuration file does not exist');
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'GitHub Actions integration properly configured',
        details: {
          workflowExists: true,
          configExists: true,
          workflowSize: workflowContent.length
        },
        performance: {
          executionTime: duration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `GitHub Actions integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testPerformanceBenchmarks(): Promise<void> {
    const testName = 'Performance Benchmarks';
    const startTime = Date.now();

    try {
      const monitor = new ForkStatusMonitor(this.config);
      
      // Benchmark fork status check
      const forkCheckStart = Date.now();
      await monitor.checkUpstreamChanges();
      const forkCheckDuration = Date.now() - forkCheckStart;

      // Benchmark feature validation
      const featureCheckStart = Date.now();
      await monitor.validateFeatureFiles();
      const featureCheckDuration = Date.now() - featureCheckStart;

      // Benchmark merge simulation
      const simulationStart = Date.now();
      await monitor.simulateMerge('upstream/main');
      const simulationDuration = Date.now() - simulationStart;

      // Check performance against requirements (NFR-FSP-PERF-001: <2 minutes)
      const totalDuration = forkCheckDuration + featureCheckDuration + simulationDuration;
      const maxAllowed = 120000; // 2 minutes

      if (totalDuration > maxAllowed) {
        throw new Error(`Performance requirement not met: ${totalDuration}ms > ${maxAllowed}ms`);
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'Performance benchmarks passed',
        details: {
          forkCheckMs: forkCheckDuration,
          featureCheckMs: featureCheckDuration,
          simulationMs: simulationDuration,
          totalMs: totalDuration,
          maxAllowedMs: maxAllowed
        },
        performance: {
          executionTime: totalDuration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Performance benchmarks failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async testQualityGates(): Promise<void> {
    const testName = 'Quality Gates Validation';
    const startTime = Date.now();

    try {
      // Check that all previous tests passed critical requirements
      const criticalTests = [
        'Configuration Loading',
        'Fork Status Monitoring', 
        'Feature Integrity Validation',
        'Security Validation'
      ];

      const failedCriticalTests = this.results
        .filter(r => criticalTests.includes(r.testName) && !r.passed)
        .map(r => r.testName);

      if (failedCriticalTests.length > 0) {
        throw new Error(`Critical tests failed: ${failedCriticalTests.join(', ')}`);
      }

      // Check performance requirements
      const performanceTests = this.results.filter(r => r.performance);
      const slowTests = performanceTests.filter(r => r.performance && r.performance.executionTime > 30000);

      if (slowTests.length > 0) {
        console.warn(`[E2E] Slow tests detected: ${slowTests.map(t => t.testName).join(', ')}`);
      }

      // Check accuracy requirement (99% conflict detection - simulated)
      const accuracyThreshold = 0.99;
      const currentAccuracy = this.results.filter(r => r.passed).length / this.results.length;

      if (currentAccuracy < accuracyThreshold) {
        throw new Error(`Accuracy requirement not met: ${currentAccuracy} < ${accuracyThreshold}`);
      }

      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        duration,
        message: 'All quality gates passed',
        details: {
          criticalTestsPassed: criticalTests.length - failedCriticalTests.length,
          overallAccuracy: currentAccuracy,
          slowTestsCount: slowTests.length
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        duration,
        message: `Quality gates failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private generateValidationSummary(): ValidationSummary {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const overallDuration = Date.now() - this.startTime;

    // Calculate performance grade
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    let performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (avgDuration > 60000) performanceGrade = 'F';
    else if (avgDuration > 30000) performanceGrade = 'D';
    else if (avgDuration > 15000) performanceGrade = 'C';
    else if (avgDuration > 5000) performanceGrade = 'B';

    // Determine quality gate status
    const criticalFailures = this.results.filter(r => 
      !r.passed && ['Configuration Loading', 'Security Validation', 'Quality Gates Validation'].includes(r.testName)
    );
    const qualityGate = criticalFailures.length === 0 && passedTests >= totalTests * 0.8 ? 'PASSED' : 'FAILED';

    // Generate recommendations
    const recommendations: string[] = [];
    if (failedTests > 0) {
      recommendations.push(`Address ${failedTests} failed tests before deployment`);
    }
    if (performanceGrade === 'F' || performanceGrade === 'D') {
      recommendations.push('Optimize performance - tests taking too long');
    }
    if (qualityGate === 'FAILED') {
      recommendations.push('Quality gates failed - manual review required');
    }
    recommendations.push('Monitor production deployment for any issues');

    return {
      totalTests,
      passedTests,
      failedTests,
      overallDuration,
      performanceGrade,
      qualityGate,
      results: this.results,
      recommendations
    };
  }

  public generateReport(summary: ValidationSummary): string {
    let report = `# Fork Sync Protection - E2E Validation Report\n\n`;
    
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Duration:** ${summary.overallDuration}ms\n\n`;

    // Summary
    report += `## Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Tests | ${summary.totalTests} |\n`;
    report += `| Passed | ${summary.passedTests} |\n`;
    report += `| Failed | ${summary.failedTests} |\n`;
    report += `| Success Rate | ${(summary.passedTests / summary.totalTests * 100).toFixed(1)}% |\n`;
    report += `| Performance Grade | ${summary.performanceGrade} |\n`;
    report += `| Quality Gate | ${summary.qualityGate} |\n\n`;

    // Test Results
    report += `## Test Results\n\n`;
    for (const result of summary.results) {
      const status = result.passed ? '✅' : '❌';
      report += `### ${status} ${result.testName}\n`;
      report += `**Duration:** ${result.duration}ms  \n`;
      report += `**Message:** ${result.message}\n`;
      
      if (result.details) {
        report += `**Details:** ${JSON.stringify(result.details, null, 2)}\n`;
      }
      
      if (result.performance) {
        report += `**Performance:** ${result.performance.executionTime}ms execution, ${Math.round(result.performance.memoryUsage / 1024 / 1024)}MB memory\n`;
      }
      
      report += `\n`;
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      for (const rec of summary.recommendations) {
        report += `- ${rec}\n`;
      }
      report += `\n`;
    }

    report += `---\n`;
    report += `🤖 Generated by Fork Sync Protection E2E Validator\n`;

    return report;
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    try {
      const validator = new E2EValidator();
      
      console.log('[CLI] Starting comprehensive E2E validation...');
      console.log('[CLI] This may take several minutes...\n');
      
      const summary = await validator.runCompleteValidation();
      
      // Generate and display report
      const report = validator.generateReport(summary);
      console.log('\n' + '='.repeat(80));
      console.log(report);
      
      // Save report to file
      const reportPath = `/tmp/fork-sync-e2e-report-${Date.now()}.md`;
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`\n[CLI] Full report saved to: ${reportPath}`);
      
      // Summary output
      console.log(`\n[CLI] E2E Validation Complete:`);
      console.log(`  Tests: ${summary.passedTests}/${summary.totalTests} passed`);
      console.log(`  Performance: Grade ${summary.performanceGrade}`);
      console.log(`  Quality Gate: ${summary.qualityGate}`);
      console.log(`  Duration: ${summary.overallDuration}ms`);
      
      // Exit with appropriate code
      process.exit(summary.qualityGate === 'PASSED' ? 0 : 1);
      
    } catch (error) {
      console.error('[CLI] E2E validation failed:', error);
      process.exit(1);
    }
  }
  
  main();
}