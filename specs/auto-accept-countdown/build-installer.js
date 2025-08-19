#!/usr/bin/env node

/**
 * Auto-Accept Countdown Installer Builder
 * Compiles all TypeScript implementations into a single installable bundle
 * 
 * Usage: node build-installer.js
 * Output: auto-accept-countdown-installer.js (standalone executable)
 */

const fs = require('fs').promises;
const path = require('path');

class InstallerBuilder {
  constructor() {
    this.srcDir = path.join(__dirname, 'src');
    this.outputFile = path.join(__dirname, 'auto-accept-countdown-installer.js');
    this.version = '1.0.0';
  }

  async readSourceFiles() {
    const sourceFiles = await fs.readdir(this.srcDir);
    const tsFiles = sourceFiles.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'));
    
    const implementations = {};
    
    for (const file of tsFiles) {
      const filePath = path.join(this.srcDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      implementations[file] = this.convertToJavaScript(content);
    }
    
    return implementations;
  }

  convertToJavaScript(tsContent) {
    // Simple TypeScript to JavaScript conversion
    // In a real implementation, you'd use TypeScript compiler API
    return tsContent
      // Remove type annotations
      .replace(/:\s*\w+(\[\])?/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/export\s+interface.*$/gm, '')
      .replace(/\s*implements\s+\w+/g, '')
      .replace(/private\s+|public\s+|protected\s+/g, '')
      .replace(/readonly\s+/g, '')
      // Convert enums to objects
      .replace(/export\s+enum\s+(\w+)\s*\{([^}]*)\}/g, (match, enumName, enumBody) => {
        const members = enumBody.split(',').map(member => {
          const [key, value] = member.split('=').map(s => s.trim());
          return `  ${key}: ${value || `"${key}"`}`;
        }).join(',\n');
        return `const ${enumName} = {\n${members}\n};`;
      })
      // Remove export keywords for internal bundling
      .replace(/export\s+/g, '')
      // Add CommonJS export at the end
      .replace(/$/g, '\n\nmodule.exports = { ' + 
        tsContent.match(/class\s+(\w+)/)?.[1] || 
        tsContent.match(/const\s+(\w+)/)?.[1] || 'exports' + 
        ' };\n');
  }

  async buildBundle() {
    console.log('🔨 Building auto-accept countdown installer...');
    
    const implementations = await readSourceFiles();
    const installerContent = await fs.readFile(path.join(__dirname, 'install.js'), 'utf8');
    
    const bundle = `#!/usr/bin/env node

/**
 * Auto-Accept Countdown Feature - Standalone Installer
 * Self-contained installer with all implementations bundled
 * 
 * Generated: ${new Date().toISOString()}
 * Version: ${this.version}
 * 
 * This file contains:
 * - Installation script
 * - All TypeScript implementations compiled to JavaScript
 * - Command definitions
 * - Configuration schemas
 * 
 * Usage: node auto-accept-countdown-installer.js
 */

// ==================== BUNDLED IMPLEMENTATIONS ====================

${Object.entries(implementations).map(([filename, content]) => `
// ===== ${filename} =====
${content}
`).join('\n')}

// ==================== INSTALLER SCRIPT ====================

${installerContent.replace('#!/usr/bin/env node', '').replace(/const.*= require.*$/gm, '')}

// ==================== BUNDLE METADATA ====================

const BUNDLE_INFO = {
  version: '${this.version}',
  buildDate: '${new Date().toISOString()}',
  sourceFiles: ${JSON.stringify(Object.keys(implementations))},
  features: [
    'Configurable countdown timer (0-60 seconds)',
    'Visual feedback with terminal compatibility',
    'ESC key cancellation',
    'Persistent settings storage',
    'Zero breaking changes',
    'Cross-platform support'
  ],
  commands: ['/timer', '/countdown']
};

// Enhanced installer with bundled implementations
class BundledInstaller extends AutoAcceptCountdownInstaller {
  constructor() {
    super();
    this.bundleInfo = BUNDLE_INFO;
  }

  async createImplementationBundle() {
    this.info('Installing bundled implementations...');
    
    const bundlePath = path.join(this.claudeDir, 'auto-accept-countdown-runtime.js');
    
    // Create runtime bundle with all implementations
    const runtimeBundle = \`/**
 * Auto-Accept Countdown Runtime Bundle
 * Contains all feature implementations
 * Version: \${this.bundleInfo.version}
 * Installation Date: \${new Date().toISOString()}
 */

${Object.entries(implementations).map(([filename, content]) => content).join('\n\n')}

// Feature initialization
console.log('Auto-Accept Countdown Runtime loaded');
console.log('Available commands: /timer, /countdown');

module.exports = {
  name: 'auto-accept-countdown',
  version: '\${this.bundleInfo.version}',
  implementations: ${JSON.stringify(Object.keys(implementations))},
  initialized: true
};
\`;

    if (!this.dryRun) {
      await fs.writeFile(bundlePath, runtimeBundle, 'utf8');
    }
    this.success('Installed runtime implementations');
  }

  async showHelp() {
    console.log(\`
\${this.colors.bold}Auto-Accept Countdown Feature - Standalone Installer\${this.colors.reset}
\${this.colors.blue}Version: \${this.bundleInfo.version} | Built: \${this.bundleInfo.buildDate}\${this.colors.reset}

\${this.colors.bold}BUNDLED FEATURES:\${this.colors.reset}
\${this.bundleInfo.features.map(f => \`• \${f}\`).join('\\n')}

\${this.colors.bold}USAGE:\${this.colors.reset}
  node \${path.basename(__filename)} [options]

\${this.colors.bold}OPTIONS:\${this.colors.reset}
  --help       Show this help message
  --dry-run    Preview installation without making changes
  --verify     Check if feature is properly installed
  --uninstall  Remove the auto-accept countdown feature

\${this.colors.bold}EXAMPLES:\${this.colors.reset}
  node \${path.basename(__filename)}                    # Install the feature
  node \${path.basename(__filename)} --dry-run          # Preview installation
  node \${path.basename(__filename)} --verify           # Check installation
  node \${path.basename(__filename)} --uninstall        # Remove the feature

\${this.colors.bold}AFTER INSTALLATION:\${this.colors.reset}
  /timer 5        # Set countdown to 5 seconds
  /countdown 10   # Set countdown to 10 seconds
  /timer          # Show current setting
  /timer 0        # Disable countdown (immediate auto-accept)

\${this.colors.bold}TECHNICAL INFO:\${this.colors.reset}
  Bundled Implementations: \${this.bundleInfo.sourceFiles.length} files
  Commands Added: \${this.bundleInfo.commands.join(', ')}
  Runtime Size: ~\${Math.round(bundle.length / 1024)}KB
\`);
  }
}

// Run bundled installer
if (require.main === module) {
  const installer = new BundledInstaller();
  installer.run().catch(error => {
    console.error('Installer failed:', error);
    process.exit(1);
  });
}

module.exports = { BundledInstaller, BUNDLE_INFO };
`;

    await fs.writeFile(this.outputFile, bundle, 'utf8');
    
    // Make executable on Unix systems
    try {
      await fs.chmod(this.outputFile, 0o755);
    } catch (error) {
      // Ignore on non-Unix systems
    }
    
    const stats = await fs.stat(this.outputFile);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log(`✅ Built installer: ${path.basename(this.outputFile)}`);
    console.log(`📦 Bundle size: ${sizeKB}KB`);
    console.log(`📂 Location: ${this.outputFile}`);
    
    return this.outputFile;
  }

  async showBuildInfo() {
    const implementations = await this.readSourceFiles();
    
    console.log(`
🔨 Auto-Accept Countdown Installer Builder

📋 Build Configuration:
   Source Directory: ${this.srcDir}
   Output File: ${path.basename(this.outputFile)}
   Version: ${this.version}

📦 Bundled Components:
${Object.keys(implementations).map(file => `   • ${file}`).join('\n')}

🚀 To build the installer:
   node build-installer.js
`);
  }
}

async function readSourceFiles() {
  const builder = new InstallerBuilder();
  return await builder.readSourceFiles();
}

// Run builder if called directly
if (require.main === module) {
  const builder = new InstallerBuilder();
  
  if (process.argv.includes('--info')) {
    builder.showBuildInfo();
  } else {
    builder.buildBundle().then(outputPath => {
      console.log(`\n🎉 Installer ready! Run with:\n   node ${path.basename(outputPath)}\n`);
    }).catch(error => {
      console.error('Build failed:', error);
      process.exit(1);
    });
  }
}