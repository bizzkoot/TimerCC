#!/usr/bin/env node

/**
 * Auto-Accept Countdown - Advanced Verification and Rollback System
 * Comprehensive health checks and safe uninstallation with backup/restore
 * 
 * Usage: node verify-and-rollback.js [command]
 * Commands:
 *   health-check    Run comprehensive health checks
 *   backup-config   Create backup of current configuration
 *   restore-config  Restore from backup
 *   safe-uninstall  Uninstall with full backup and rollback capability
 *   doctor          Interactive diagnosis and repair tool
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class FeatureVerificationSystem {
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.commandsDir = path.join(this.claudeDir, 'commands');
    this.backupDir = path.join(this.claudeDir, 'backups');
    this.featureName = 'auto-accept-countdown';
    
    // Colors for output
    this.colors = {
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m'
    };
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  success(message) { this.log(`✅ ${message}`, 'green'); }
  error(message) { this.log(`❌ ${message}`, 'red'); }
  warning(message) { this.log(`⚠️  ${message}`, 'yellow'); }
  info(message) { this.log(`ℹ️  ${message}`, 'blue'); }
  debug(message) { this.log(`🔍 ${message}`, 'dim'); }

  async runHealthCheck() {
    this.log('\n🏥 Auto-Accept Countdown Health Check\n', 'bold');
    
    const checks = [
      { name: 'Claude Code Installation', fn: this.checkClaudeInstallation },
      { name: 'Directory Structure', fn: this.checkDirectoryStructure },
      { name: 'Command Files', fn: this.checkCommandFiles },
      { name: 'Configuration Validity', fn: this.checkConfiguration },
      { name: 'Settings Schema', fn: this.validateSettingsSchema },
      { name: 'File Permissions', fn: this.checkFilePermissions },
      { name: 'Runtime Dependencies', fn: this.checkRuntimeDependencies },
      { name: 'Integration Points', fn: this.checkIntegrationPoints },
      { name: 'Performance Baseline', fn: this.checkPerformanceBaseline },
      { name: 'Security Configuration', fn: this.checkSecurityConfiguration }
    ];

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const check of checks) {
      try {
        this.debug(`Running: ${check.name}`);
        const result = await check.fn.call(this);
        
        if (result.status === 'pass') {
          this.success(`${check.name}: ${result.message}`);
          passed++;
        } else if (result.status === 'warn') {
          this.warning(`${check.name}: ${result.message}`);
        } else {
          this.error(`${check.name}: ${result.message}`);
          failed++;
        }
        
        results.push({ check: check.name, ...result });
      } catch (error) {
        this.error(`${check.name}: ${error.message}`);
        failed++;
        results.push({ check: check.name, status: 'fail', message: error.message });
      }
    }

    // Summary report
    this.log('\n📊 Health Check Summary', 'bold');
    this.log(`✅ Passed: ${passed}`, 'green');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    this.log(`⚠️  Warnings: ${results.filter(r => r.status === 'warn').length}`, 'yellow');

    // Overall health score
    const healthScore = Math.round((passed / (passed + failed)) * 100);
    this.log(`\n🎯 Overall Health Score: ${healthScore}%`, healthScore >= 80 ? 'green' : 'red');

    if (failed > 0) {
      this.log('\n🔧 Recommended Actions:', 'bold');
      results.filter(r => r.status === 'fail').forEach(r => {
        this.log(`   • Fix: ${r.check}`, 'yellow');
        if (r.suggestion) {
          this.log(`     → ${r.suggestion}`, 'dim');
        }
      });
    }

    return { healthScore, passed, failed, results };
  }

  async checkClaudeInstallation() {
    try {
      const version = execSync('claude --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return { status: 'pass', message: `Version ${version} detected` };
    } catch (error) {
      return { 
        status: 'fail', 
        message: 'Claude Code not found',
        suggestion: 'Install Claude Code: npm install -g @anthropic-ai/claude-code'
      };
    }
  }

  async checkDirectoryStructure() {
    const requiredDirs = [this.claudeDir, this.commandsDir];
    const missingDirs = [];

    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
      } catch (error) {
        missingDirs.push(path.basename(dir));
      }
    }

    if (missingDirs.length === 0) {
      return { status: 'pass', message: 'All required directories exist' };
    } else {
      return { 
        status: 'fail', 
        message: `Missing directories: ${missingDirs.join(', ')}`,
        suggestion: 'Run installer to create required directories'
      };
    }
  }

  async checkCommandFiles() {
    const commandFiles = ['timer.md', 'countdown.md'];
    const results = [];

    for (const file of commandFiles) {
      const filePath = path.join(this.commandsDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Validate command file structure
        const hasDescription = content.includes('description:');
        const hasUsage = content.includes('Usage') || content.includes('usage');
        const hasTask = content.includes('Your task');
        
        if (hasDescription && hasUsage && hasTask) {
          results.push({ file, status: 'valid' });
        } else {
          results.push({ file, status: 'incomplete' });
        }
      } catch (error) {
        results.push({ file, status: 'missing' });
      }
    }

    const valid = results.filter(r => r.status === 'valid').length;
    const missing = results.filter(r => r.status === 'missing').length;
    
    if (missing > 0) {
      return { 
        status: 'fail', 
        message: `Missing command files: ${results.filter(r => r.status === 'missing').map(r => r.file).join(', ')}`,
        suggestion: 'Reinstall feature to restore command files'
      };
    } else if (valid === commandFiles.length) {
      return { status: 'pass', message: 'All command files valid' };
    } else {
      return { status: 'warn', message: 'Some command files incomplete' };
    }
  }

  async checkConfiguration() {
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    
    try {
      const content = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      
      if (!settings.autoAcceptCountdown) {
        return { 
          status: 'fail', 
          message: 'autoAcceptCountdown configuration missing',
          suggestion: 'Run installer to add configuration'
        };
      }
      
      const config = settings.autoAcceptCountdown;
      const issues = [];
      
      if (typeof config.duration !== 'number' || config.duration < 0 || config.duration > 60) {
        issues.push('invalid duration');
      }
      if (typeof config.enabled !== 'boolean') {
        issues.push('invalid enabled flag');
      }
      if (typeof config.version !== 'string') {
        issues.push('missing version');
      }
      
      if (issues.length > 0) {
        return { status: 'warn', message: `Configuration issues: ${issues.join(', ')}` };
      }
      
      return { status: 'pass', message: `Configuration valid (duration: ${config.duration}s, enabled: ${config.enabled})` };
      
    } catch (error) {
      return { 
        status: 'fail', 
        message: 'Settings file missing or invalid JSON',
        suggestion: 'Run installer to create settings file'
      };
    }
  }

  async validateSettingsSchema() {
    // Advanced schema validation
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    
    try {
      const content = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      
      if (settings.autoAcceptCountdown) {
        const schema = {
          duration: 'number',
          enabled: 'boolean', 
          version: 'string'
        };
        
        const config = settings.autoAcceptCountdown;
        const violations = [];
        
        for (const [key, expectedType] of Object.entries(schema)) {
          if (!(key in config)) {
            violations.push(`missing ${key}`);
          } else if (typeof config[key] !== expectedType) {
            violations.push(`${key} should be ${expectedType}, got ${typeof config[key]}`);
          }
        }
        
        // Range validation
        if (config.duration !== undefined && (config.duration < 0 || config.duration > 60)) {
          violations.push('duration out of range (0-60)');
        }
        
        if (violations.length > 0) {
          return { status: 'fail', message: `Schema violations: ${violations.join(', ')}` };
        }
        
        return { status: 'pass', message: 'Schema validation passed' };
      }
      
      return { status: 'warn', message: 'Configuration section missing' };
    } catch (error) {
      return { status: 'fail', message: 'Schema validation failed - invalid settings file' };
    }
  }

  async checkFilePermissions() {
    const files = [
      path.join(this.commandsDir, 'timer.md'),
      path.join(this.commandsDir, 'countdown.md'),
      path.join(this.claudeDir, 'settings.json')
    ];
    
    const permissionIssues = [];
    
    for (const file of files) {
      try {
        await fs.access(file, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        permissionIssues.push(path.basename(file));
      }
    }
    
    if (permissionIssues.length === 0) {
      return { status: 'pass', message: 'All files have correct permissions' };
    } else {
      return { 
        status: 'warn', 
        message: `Permission issues: ${permissionIssues.join(', ')}`,
        suggestion: 'Check file permissions and ownership'
      };
    }
  }

  async checkRuntimeDependencies() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
      return { 
        status: 'fail', 
        message: `Node.js ${nodeVersion} is too old, requires 16+`,
        suggestion: 'Update Node.js to version 16 or higher'
      };
    }
    
    // Check required Node.js features
    const features = [
      { name: 'fs.promises', test: () => fs.readFile !== undefined },
      { name: 'setTimeout', test: () => typeof setTimeout === 'function' },
      { name: 'process.hrtime.bigint', test: () => typeof process.hrtime.bigint === 'function' }
    ];
    
    const missingFeatures = features.filter(f => !f.test()).map(f => f.name);
    
    if (missingFeatures.length > 0) {
      return { 
        status: 'fail', 
        message: `Missing Node.js features: ${missingFeatures.join(', ')}` 
      };
    }
    
    return { status: 'pass', message: `Node.js ${nodeVersion} with all required features` };
  }

  async checkIntegrationPoints() {
    // Check if installation integrates properly with Claude Code
    const integrationChecks = [];
    
    // Check command registration
    try {
      const commandsExist = await Promise.all([
        fs.access(path.join(this.commandsDir, 'timer.md')),
        fs.access(path.join(this.commandsDir, 'countdown.md'))
      ]);
      integrationChecks.push('Commands registered');
    } catch (error) {
      integrationChecks.push('Commands missing');
    }
    
    // Check settings integration
    try {
      const settingsContent = await fs.readFile(path.join(this.claudeDir, 'settings.json'), 'utf8');
      const settings = JSON.parse(settingsContent);
      if (settings.autoAcceptCountdown) {
        integrationChecks.push('Settings integrated');
      } else {
        integrationChecks.push('Settings not integrated');
      }
    } catch (error) {
      integrationChecks.push('Settings integration failed');
    }
    
    const integrated = integrationChecks.filter(c => !c.includes('missing') && !c.includes('failed')).length;
    
    if (integrated === 2) {
      return { status: 'pass', message: 'All integration points working' };
    } else {
      return { 
        status: 'warn', 
        message: `Integration issues: ${integrationChecks.filter(c => c.includes('missing') || c.includes('failed')).join(', ')}` 
      };
    }
  }

  async checkPerformanceBaseline() {
    // Simple performance check
    const start = process.hrtime.bigint();
    
    // Simulate countdown timer operations
    for (let i = 0; i < 1000; i++) {
      const timer = setTimeout(() => {}, 1);
      clearTimeout(timer);
    }
    
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const avgPerOp = durationMs / 1000;
    
    if (avgPerOp < 0.1) {
      return { status: 'pass', message: `Timer operations fast (${avgPerOp.toFixed(3)}ms avg)` };
    } else if (avgPerOp < 1) {
      return { status: 'warn', message: `Timer operations acceptable (${avgPerOp.toFixed(3)}ms avg)` };
    } else {
      return { status: 'fail', message: `Timer operations slow (${avgPerOp.toFixed(3)}ms avg)` };
    }
  }

  async checkSecurityConfiguration() {
    // Check for security best practices
    const securityChecks = [];
    
    try {
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      const stats = await fs.stat(settingsPath);
      
      // Check file permissions (should not be world-readable)
      const mode = stats.mode & parseInt('777', 8);
      if (mode & parseInt('004', 8)) {
        securityChecks.push('Settings file is world-readable');
      }
      
      // Check if feature can be disabled
      const content = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      if (settings.autoAcceptCountdown && typeof settings.autoAcceptCountdown.enabled === 'boolean') {
        securityChecks.push('Feature can be disabled ✓');
      } else {
        securityChecks.push('Feature disable capability missing');
      }
      
    } catch (error) {
      securityChecks.push('Security check failed');
    }
    
    const issues = securityChecks.filter(c => !c.includes('✓'));
    
    if (issues.length === 0) {
      return { status: 'pass', message: 'Security configuration acceptable' };
    } else {
      return { status: 'warn', message: `Security issues: ${issues.join(', ')}` };
    }
  }

  async createBackup() {
    this.log('\n💾 Creating Configuration Backup', 'bold');
    
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `countdown-backup-${timestamp}.json`);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        feature: this.featureName,
        files: {}
      };
      
      // Backup settings
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      try {
        const settings = await fs.readFile(settingsPath, 'utf8');
        backupData.files['settings.json'] = settings;
      } catch (error) {
        this.warning('No settings.json to backup');
      }
      
      // Backup command files
      const commandFiles = ['timer.md', 'countdown.md'];
      for (const file of commandFiles) {
        try {
          const content = await fs.readFile(path.join(this.commandsDir, file), 'utf8');
          backupData.files[`commands/${file}`] = content;
        } catch (error) {
          this.warning(`No ${file} to backup`);
        }
      }
      
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
      this.success(`Backup created: ${path.basename(backupPath)}`);
      
      return backupPath;
    } catch (error) {
      this.error(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  async restoreFromBackup(backupPath) {
    this.log('\n🔄 Restoring from Backup', 'bold');
    
    try {
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupContent);
      
      this.info(`Restoring backup from ${backup.timestamp}`);
      
      // Restore settings
      if (backup.files['settings.json']) {
        const settingsPath = path.join(this.claudeDir, 'settings.json');
        await fs.writeFile(settingsPath, backup.files['settings.json'], 'utf8');
        this.success('Restored settings.json');
      }
      
      // Restore command files
      for (const [filePath, content] of Object.entries(backup.files)) {
        if (filePath.startsWith('commands/')) {
          const fileName = path.basename(filePath);
          const fullPath = path.join(this.commandsDir, fileName);
          await fs.writeFile(fullPath, content, 'utf8');
          this.success(`Restored ${fileName}`);
        }
      }
      
      this.success('Restore complete');
      
    } catch (error) {
      this.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  async safeUninstall() {
    this.log('\n🛡️ Safe Uninstall with Backup', 'bold');
    
    try {
      // Create backup first
      const backupPath = await this.createBackup();
      
      // Remove countdown configuration from settings
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      try {
        const settingsContent = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsContent);
        
        if (settings.autoAcceptCountdown) {
          delete settings.autoAcceptCountdown;
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
          this.success('Removed countdown configuration from settings');
        }
      } catch (error) {
        this.warning('Could not update settings.json');
      }
      
      // Remove command files
      const commandFiles = ['timer.md', 'countdown.md'];
      for (const file of commandFiles) {
        try {
          await fs.unlink(path.join(this.commandsDir, file));
          this.success(`Removed ${file}`);
        } catch (error) {
          this.warning(`Could not remove ${file}`);
        }
      }
      
      // Remove runtime bundle if exists
      try {
        await fs.unlink(path.join(this.claudeDir, 'auto-accept-countdown-bundle.js'));
        this.success('Removed runtime bundle');
      } catch (error) {
        this.warning('No runtime bundle to remove');
      }
      
      this.success('Safe uninstall complete');
      this.info(`Backup available at: ${backupPath}`);
      
      return backupPath;
      
    } catch (error) {
      this.error(`Safe uninstall failed: ${error.message}`);
      throw error;
    }
  }

  async runInteractiveDiagnosis() {
    this.log('\n🩺 Interactive Diagnosis and Repair Tool', 'bold');
    
    const healthCheck = await this.runHealthCheck();
    
    if (healthCheck.failed > 0) {
      this.log('\n🔧 Repair Options Available:', 'bold');
      
      const failedChecks = healthCheck.results.filter(r => r.status === 'fail');
      
      for (const check of failedChecks) {
        this.log(`\n❌ ${check.check}`, 'red');
        this.log(`   Issue: ${check.message}`, 'yellow');
        
        if (check.suggestion) {
          this.log(`   Suggested fix: ${check.suggestion}`, 'cyan');
        }
        
        // Auto-repair options
        if (check.check.includes('Command Files')) {
          this.info('   Auto-repair: Run installer to restore command files');
        } else if (check.check.includes('Configuration')) {
          this.info('   Auto-repair: Run installer to fix configuration');
        } else if (check.check.includes('Directory Structure')) {
          this.info('   Auto-repair: Create missing directories');
        }
      }
      
      this.log('\n💡 Recommended Action:', 'bold');
      this.log('   Run: node install.js', 'cyan');
      this.log('   This will repair most common issues', 'dim');
    } else {
      this.success('\n🎉 System is healthy! No repairs needed.');
    }
    
    return healthCheck;
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2] || 'health-check';
  const system = new FeatureVerificationSystem();
  
  console.log(`${system.colors.bold}${system.colors.blue}Auto-Accept Countdown Verification System${system.colors.reset}\n`);
  
  try {
    switch (command) {
      case 'health-check':
        await system.runHealthCheck();
        break;
        
      case 'backup-config':
        await system.createBackup();
        break;
        
      case 'restore-config':
        const backupFile = process.argv[3];
        if (!backupFile) {
          system.error('Please specify backup file path');
          process.exit(1);
        }
        await system.restoreFromBackup(backupFile);
        break;
        
      case 'safe-uninstall':
        await system.safeUninstall();
        break;
        
      case 'doctor':
        await system.runInteractiveDiagnosis();
        break;
        
      default:
        console.log(`
Usage: node verify-and-rollback.js [command]

Commands:
  health-check     Run comprehensive health checks (default)
  backup-config    Create backup of current configuration
  restore-config   Restore from backup file
  safe-uninstall   Uninstall with full backup and rollback capability
  doctor           Interactive diagnosis and repair tool

Examples:
  node verify-and-rollback.js health-check
  node verify-and-rollback.js backup-config
  node verify-and-rollback.js restore-config backup-2024-01-19T10-30-00.json
  node verify-and-rollback.js safe-uninstall
  node verify-and-rollback.js doctor
`);
    }
  } catch (error) {
    system.error(`Operation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = FeatureVerificationSystem;