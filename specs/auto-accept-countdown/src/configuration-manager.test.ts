/**
 * Unit Tests for CountdownConfiguration
 * Validates: AC-AC-CT-005-01, AC-AC-CT-005-02, AC-AC-CT-005-03
 */

import { CountdownConfiguration, CountdownSettings, ValidationResult } from './configuration-manager';

describe('CountdownConfiguration', () => {
  let config: CountdownConfiguration;

  beforeEach(() => {
    config = new CountdownConfiguration();
  });

  describe('getDefaultSettings', () => {
    it('should return correct default values', () => {
      // AC-AC-CT-005-03: Fallback to default timer value with warning
      const defaults = config.getDefaultSettings();
      
      expect(defaults.duration).toBe(5);
      expect(defaults.enabled).toBe(true);
      expect(defaults.version).toBe('1.0');
    });

    it('should return new object instances to prevent mutation', () => {
      const defaults1 = config.getDefaultSettings();
      const defaults2 = config.getDefaultSettings();
      
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const validSettings = {
        duration: 10,
        enabled: true,
        version: '1.0'
      };

      const result = config.validateSettings(validSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid duration types', () => {
      const invalidSettings = {
        duration: '5', // string instead of number
        enabled: true,
        version: '1.0'
      };

      const result = config.validateSettings(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration must be a number');
    });

    it('should reject non-integer durations', () => {
      const invalidSettings = {
        duration: 5.5, // float instead of integer
        enabled: true,
        version: '1.0'
      };

      const result = config.validateSettings(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration must be an integer');
    });

    it('should reject duration values outside valid range', () => {
      // Test below minimum
      let result = config.validateSettings({
        duration: -1,
        enabled: true,
        version: '1.0'
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration must be between 0 and 60 seconds');

      // Test above maximum  
      result = config.validateSettings({
        duration: 65,
        enabled: true,
        version: '1.0'
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration must be between 0 and 60 seconds');
    });

    it('should accept boundary values (0 and 60)', () => {
      // Test minimum boundary (immediate mode)
      let result = config.validateSettings({
        duration: 0,
        enabled: true,
        version: '1.0'
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Test maximum boundary
      result = config.validateSettings({
        duration: 60,
        enabled: true,
        version: '1.0'
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid enabled types', () => {
      const invalidSettings = {
        duration: 5,
        enabled: 'true', // string instead of boolean
        version: '1.0'
      };

      const result = config.validateSettings(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enabled must be a boolean');
    });

    it('should reject invalid version types', () => {
      const invalidSettings = {
        duration: 5,
        enabled: true,
        version: 1.0 // number instead of string
      };

      const result = config.validateSettings(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('version must be a string');
    });

    it('should warn about version mismatches', () => {
      const settings = {
        duration: 5,
        enabled: true,
        version: '2.0' // different version
      };

      const result = config.validateSettings(settings);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Schema version mismatch: expected 1.0, got 2.0');
    });

    it('should reject non-object settings', () => {
      const result = config.validateSettings('invalid');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Settings must be an object');
    });

    it('should reject null/undefined settings', () => {
      expect(config.validateSettings(null).valid).toBe(false);
      expect(config.validateSettings(undefined).valid).toBe(false);
    });
  });

  describe('updateDuration', () => {
    it('should update duration setting', async () => {
      // Mock the save functionality since we can't actually write to file system
      const saveSpy = jest.spyOn(config, 'saveToSettings').mockResolvedValue();
      
      await config.updateDuration(10);
      
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        duration: 10,
        enabled: true, // preserved
        version: '1.0' // preserved
      }));
    });

    it('should preserve other settings when updating duration', async () => {
      const saveSpy = jest.spyOn(config, 'saveToSettings').mockResolvedValue();
      
      // Set initial state
      config['currentSettings'] = {
        duration: 5,
        enabled: false,
        version: '1.0'
      };
      
      await config.updateDuration(15);
      
      expect(saveSpy).toHaveBeenCalledWith({
        duration: 15,
        enabled: false, // preserved
        version: '1.0' // preserved
      });
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle enabled setting from true to false', async () => {
      const saveSpy = jest.spyOn(config, 'saveToSettings').mockResolvedValue();
      
      // Start with enabled = true (default)
      await config.toggleEnabled();
      
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        enabled: false
      }));
    });

    it('should toggle enabled setting from false to true', async () => {
      const saveSpy = jest.spyOn(config, 'saveToSettings').mockResolvedValue();
      
      // Set initial state to false
      config['currentSettings'] = {
        duration: 5,
        enabled: false,
        version: '1.0'
      };
      
      await config.toggleEnabled();
      
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true
      }));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle corrupted config gracefully', async () => {
      // Mock reading corrupted settings
      jest.spyOn(config as any, 'readSettingsFile').mockResolvedValue({
        autoAcceptCountdown: 'corrupted-data'
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const settings = await config.loadFromSettings();
      
      expect(settings).toEqual(config.getDefaultSettings());
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CountdownConfig] Invalid settings, using defaults:'),
        expect.any(Array)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle missing settings file gracefully', async () => {
      // Mock file not found
      jest.spyOn(config as any, 'readSettingsFile').mockRejectedValue(new Error('File not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const settings = await config.loadFromSettings();
      
      expect(settings).toEqual(config.getDefaultSettings());
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CountdownConfig] Failed to load settings, using defaults:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle write failures gracefully', async () => {
      // Mock write failure
      jest.spyOn(config as any, 'writeSettingsFile').mockRejectedValue(new Error('Write failed'));

      await expect(config.saveToSettings({
        duration: 10,
        enabled: true,
        version: '1.0'
      })).rejects.toThrow('Write failed');
    });
  });

  describe('Schema Compliance', () => {
    it('should support all required schema properties', () => {
      const settings = {
        duration: 30,
        enabled: false
        // version is optional
      };

      const result = config.validateSettings(settings);
      expect(result.valid).toBe(true);
    });

    it('should validate against production use cases', () => {
      const testCases = [
        { duration: 0, enabled: true, description: 'Immediate mode' },
        { duration: 1, enabled: true, description: 'Minimal delay' },
        { duration: 5, enabled: true, description: 'Default setting' },
        { duration: 10, enabled: true, description: 'Common preference' },
        { duration: 60, enabled: true, description: 'Maximum delay' },
        { duration: 5, enabled: false, description: 'Feature disabled' }
      ];

      testCases.forEach(testCase => {
        const result = config.validateSettings(testCase);
        expect(result.valid).toBe(true, 
          `${testCase.description} should be valid`);
      });
    });
  });
});