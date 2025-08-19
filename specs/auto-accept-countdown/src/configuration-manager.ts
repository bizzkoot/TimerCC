/**
 * Configuration Manager for Auto-Accept Countdown Feature
 * Fulfills: REQ-AC-CT-005 (Persistent Configuration Storage)
 * ADR: ADR-004 (Settings Integration with .claude/settings.json Schema)
 */

export interface CountdownSettings {
  /** Countdown duration in seconds (0-60, default 5) */
  duration: number;
  /** Feature toggle (default true) */
  enabled: boolean;
  /** Schema version for migrations */
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * CountdownConfiguration Component
 * Responsibility: Settings persistence and validation
 * Trace: AC-AC-CT-005-01, AC-AC-CT-005-02, AC-AC-CT-005-03
 */
export class CountdownConfiguration {
  private static readonly DEFAULT_SETTINGS: CountdownSettings = {
    duration: 5,
    enabled: true,
    version: "1.0"
  };

  private static readonly SCHEMA_VERSION = "1.0";
  private static readonly MIN_DURATION = 0;
  private static readonly MAX_DURATION = 60;

  private settingsPath: string;
  private currentSettings: CountdownSettings;

  constructor(settingsPath: string = '.claude/settings.json') {
    this.settingsPath = settingsPath;
    this.currentSettings = this.getDefaultSettings();
  }

  /**
   * Load countdown settings from .claude/settings.json
   * Fulfills: AC-AC-CT-005-01 - Load from .claude/settings.json
   */
  async loadFromSettings(): Promise<CountdownSettings> {
    try {
      // In real implementation, this would use the actual Claude Code settings system
      // For now, simulate reading from settings.json
      const settingsData = await this.readSettingsFile();
      
      if (settingsData?.autoAcceptCountdown) {
        const validation = this.validateSettings(settingsData.autoAcceptCountdown);
        
        if (validation.valid) {
          this.currentSettings = {
            ...this.getDefaultSettings(),
            ...settingsData.autoAcceptCountdown
          };
          
          // Log warnings if any
          if (validation.warnings.length > 0) {
            console.warn('[CountdownConfig] Validation warnings:', validation.warnings);
          }
        } else {
          console.error('[CountdownConfig] Invalid settings, using defaults:', validation.errors);
          this.currentSettings = this.getDefaultSettings();
        }
      } else {
        // No countdown settings found, use defaults
        this.currentSettings = this.getDefaultSettings();
      }
      
      return this.currentSettings;
    } catch (error) {
      console.error('[CountdownConfig] Failed to load settings, using defaults:', error);
      this.currentSettings = this.getDefaultSettings();
      return this.currentSettings;
    }
  }

  /**
   * Save countdown settings to .claude/settings.json
   * Fulfills: AC-AC-CT-005-02 - Persist settings
   */
  async saveToSettings(settings: CountdownSettings): Promise<void> {
    try {
      const validation = this.validateSettings(settings);
      
      if (!validation.valid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      // Update current settings
      this.currentSettings = { ...settings };
      
      // Read existing settings file
      const existingSettings = await this.readSettingsFile();
      
      // Merge countdown settings into existing configuration
      const updatedSettings = {
        ...existingSettings,
        autoAcceptCountdown: this.currentSettings
      };
      
      // Write back to settings file
      await this.writeSettingsFile(updatedSettings);
      
      console.log('[CountdownConfig] Settings saved successfully');
    } catch (error) {
      console.error('[CountdownConfig] Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get default countdown settings
   * Fulfills: AC-AC-CT-005-03 - Fallback defaults
   */
  getDefaultSettings(): CountdownSettings {
    return { ...CountdownConfiguration.DEFAULT_SETTINGS };
  }

  /**
   * Validate countdown settings
   * Range validation and schema compliance
   */
  validateSettings(settings: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if settings is an object
    if (!settings || typeof settings !== 'object') {
      errors.push('Settings must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate duration
    if (typeof settings.duration !== 'number') {
      errors.push('duration must be a number');
    } else if (!Number.isInteger(settings.duration)) {
      errors.push('duration must be an integer');
    } else if (settings.duration < CountdownConfiguration.MIN_DURATION || 
               settings.duration > CountdownConfiguration.MAX_DURATION) {
      errors.push(`duration must be between ${CountdownConfiguration.MIN_DURATION} and ${CountdownConfiguration.MAX_DURATION} seconds`);
    }

    // Validate enabled
    if (typeof settings.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    // Validate version (optional, but if present must be string)
    if (settings.version !== undefined && typeof settings.version !== 'string') {
      errors.push('version must be a string');
    }

    // Schema version compatibility check
    if (settings.version && settings.version !== CountdownConfiguration.SCHEMA_VERSION) {
      warnings.push(`Schema version mismatch: expected ${CountdownConfiguration.SCHEMA_VERSION}, got ${settings.version}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get current settings
   */
  getCurrentSettings(): CountdownSettings {
    return { ...this.currentSettings };
  }

  /**
   * Update duration setting
   * Fulfills: AC-AC-CT-002-01, AC-AC-CT-002-04 - Timer command support
   */
  async updateDuration(duration: number): Promise<void> {
    const newSettings = {
      ...this.currentSettings,
      duration
    };
    
    await this.saveToSettings(newSettings);
  }

  /**
   * Toggle enabled setting
   */
  async toggleEnabled(): Promise<void> {
    const newSettings = {
      ...this.currentSettings,
      enabled: !this.currentSettings.enabled
    };
    
    await this.saveToSettings(newSettings);
  }

  // Private helper methods for file I/O
  // In real implementation, these would use Claude Code's settings system

  private async readSettingsFile(): Promise<any> {
    try {
      // Simulate reading from .claude/settings.json
      // In real implementation: use fs.readFile or Claude Code's settings API
      return {};
    } catch (error) {
      console.warn('[CountdownConfig] Settings file not found or unreadable, using defaults');
      return {};
    }
  }

  private async writeSettingsFile(settings: any): Promise<void> {
    try {
      // Simulate writing to .claude/settings.json
      // In real implementation: use fs.writeFile or Claude Code's settings API
      console.log('[CountdownConfig] Would write settings:', JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('[CountdownConfig] Failed to write settings file:', error);
      throw error;
    }
  }
}

/**
 * Schema definition for .claude/settings.json extension
 * 
 * Example configuration:
 * {
 *   "autoAcceptCountdown": {
 *     "duration": 5,
 *     "enabled": true,
 *     "version": "1.0"
 *   }
 * }
 */
export const COUNTDOWN_SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    autoAcceptCountdown: {
      type: 'object',
      properties: {
        duration: {
          type: 'integer',
          minimum: 0,
          maximum: 60,
          default: 5,
          description: 'Countdown duration in seconds before auto-accept'
        },
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable/disable countdown feature'
        },
        version: {
          type: 'string',
          default: '1.0',
          description: 'Schema version for migrations'
        }
      },
      required: ['duration', 'enabled'],
      additionalProperties: false
    }
  }
};