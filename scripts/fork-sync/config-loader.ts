#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

export interface ForkSyncConfig {
  protected_paths: string[];
  critical_files: string[];
  fork_specific_urls: {
    pattern: string;
    description: string;
  }[];
  upstream: {
    owner: string;
    repo: string;
    main_branch: string;
  };
  monitoring: {
    min_fork_url_count: number;
    max_execution_time: number;
    duplicate_comment_age_days: number;
  };
  auto_merge: {
    enabled: boolean;
    manual_review_paths: string[];
    safe_extensions: string[];
    exclude_from_auto_merge: string[];
  };
  pr_generation: {
    title_template: string;
    labels: string[];
    reviewers: string[];
  };
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: ForkSyncConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public loadConfig(configPath?: string): ForkSyncConfig {
    if (this.config) {
      return this.config;
    }

    const defaultConfigPath = path.join(process.cwd(), '.github', 'fork-sync-protection.yml');
    const finalConfigPath = configPath || defaultConfigPath;

    if (!fs.existsSync(finalConfigPath)) {
      throw new Error(`Configuration file not found: ${finalConfigPath}`);
    }

    try {
      // Simple YAML parser for our structured config
      const configContent = fs.readFileSync(finalConfigPath, 'utf8');
      this.config = this.parseYamlConfig(configContent);
      this.validateConfig(this.config);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseYamlConfig(content: string): ForkSyncConfig {
    // Simple YAML parser for our specific config structure
    const lines = content.split('\n');
    const config: any = {};
    let currentSection: any = config;
    let currentKey = '';
    let arrayMode = false;
    let currentArray: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || !trimmed) {
        continue;
      }

      // Handle array items
      if (trimmed.startsWith('- ')) {
        if (arrayMode) {
          const value = trimmed.substring(2).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            currentArray.push(value.slice(1, -1));
          } else {
            currentArray.push(value);
          }
        }
        continue;
      }

      // Handle object array items (like fork_specific_urls)
      if (trimmed.startsWith('- pattern:') || trimmed.startsWith('pattern:')) {
        if (arrayMode) {
          const pattern = trimmed.includes(':') ? trimmed.split(':')[1].trim().replace(/"/g, '') : '';
          currentArray.push({ pattern, description: '' });
        }
        continue;
      }

      if (trimmed.startsWith('description:')) {
        if (arrayMode && currentArray.length > 0) {
          const lastItem = currentArray[currentArray.length - 1];
          if (typeof lastItem === 'object') {
            lastItem.description = trimmed.split(':')[1].trim().replace(/"/g, '');
          }
        }
        continue;
      }

      // Handle key-value pairs
      if (trimmed.includes(':')) {
        // Finish current array if we were in array mode
        if (arrayMode) {
          currentSection[currentKey] = currentArray;
          arrayMode = false;
          currentArray = [];
        }

        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();

        // Handle nested sections
        if (!value) {
          currentKey = key.trim();
          if (!currentSection[currentKey]) {
            currentSection[currentKey] = {};
          }
          currentSection = currentSection[currentKey];
        } else {
          // Handle values
          currentKey = key.trim();
          if (value === '[]' || trimmed.endsWith(':')) {
            // Start array mode
            arrayMode = true;
            currentArray = [];
          } else {
            // Simple value
            let parsedValue: any = value.replace(/"/g, '');
            if (parsedValue === 'true') parsedValue = true;
            else if (parsedValue === 'false') parsedValue = false;
            else if (!isNaN(Number(parsedValue))) parsedValue = Number(parsedValue);
            
            currentSection[currentKey] = parsedValue;
          }
        }
      }
    }

    // Finish final array if needed
    if (arrayMode) {
      currentSection[currentKey] = currentArray;
    }

    return config as ForkSyncConfig;
  }

  private validateConfig(config: ForkSyncConfig): void {
    // Validate required sections
    const requiredSections = ['protected_paths', 'critical_files', 'upstream', 'monitoring'];
    for (const section of requiredSections) {
      if (!(section in config)) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Validate arrays are not empty
    if (!Array.isArray(config.protected_paths) || config.protected_paths.length === 0) {
      throw new Error('protected_paths must be a non-empty array');
    }

    if (!Array.isArray(config.critical_files) || config.critical_files.length === 0) {
      throw new Error('critical_files must be a non-empty array');
    }

    // Validate upstream configuration
    if (!config.upstream.owner || !config.upstream.repo) {
      throw new Error('upstream.owner and upstream.repo are required');
    }

    console.log('[CONFIG] Configuration loaded and validated successfully');
    console.log(`[CONFIG] Protecting ${config.protected_paths.length} paths and ${config.critical_files.length} critical files`);
  }

  public getConfig(): ForkSyncConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }
}

// Export convenience function
export function loadForkSyncConfig(configPath?: string): ForkSyncConfig {
  return ConfigLoader.getInstance().loadConfig(configPath);
}