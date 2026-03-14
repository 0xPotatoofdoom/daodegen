#!/usr/bin/env node

/**
 * Validation script for IPFS migration setup
 * Checks all prerequisites before running the full migration
 */

const fs = require('fs').promises;
const path = require('path');

class SetupValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  log(type, message) {
    const emoji = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    console.log(`${emoji[type]} ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
    this.checks.push({ type, message });
  }

  async checkEnvironmentVariables() {
    this.log('info', 'Checking environment variables...');
    
    const required = ['PINATA_API_KEY', 'PINATA_SECRET_API_KEY'];
    let allPresent = true;
    
    for (const envVar of required) {
      if (!process.env[envVar]) {
        this.log('error', `Missing required environment variable: ${envVar}`);
        allPresent = false;
      } else {
        this.log('success', `Found ${envVar}`);
      }
    }
    
    return allPresent;
  }

  async checkDirectoryStructure() {
    this.log('info', 'Checking directory structure...');
    
    const paths = [
      'packages/frontend/public/illustrations',
      'packages/frontend/src/data/verses.json',
      'scripts'
    ];
    
    let allExist = true;
    
    for (const dirPath of paths) {
      try {
        await fs.access(path.join(process.cwd(), dirPath));
        this.log('success', `Found ${dirPath}`);
      } catch (error) {
        this.log('error', `Missing ${dirPath}`);
        allExist = false;
      }
    }
    
    return allExist;
  }

  async checkIllustrations() {
    this.log('info', 'Checking illustrations...');
    
    try {
      const illustrationsPath = path.join(process.cwd(), 'packages/frontend/public/illustrations');
      const files = await fs.readdir(illustrationsPath);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      if (pngFiles.length === 0) {
        this.log('error', 'No PNG files found in illustrations directory');
        return false;
      }
      
      this.log('success', `Found ${pngFiles.length} PNG files`);
      
      if (pngFiles.length !== 86) {
        this.log('warning', `Expected 86 files, found ${pngFiles.length}`);
      }
      
      // Check file sizes
      let totalSize = 0;
      for (const file of pngFiles.slice(0, 5)) { // Check first 5 files
        const filePath = path.join(illustrationsPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (stats.size < 1000) {
          this.log('warning', `File ${file} seems very small (${stats.size} bytes)`);
        }
      }
      
      const avgSize = totalSize / Math.min(5, pngFiles.length);
      this.log('info', `Average file size: ${(avgSize / 1024).toFixed(1)} KB`);
      
      return true;
    } catch (error) {
      this.log('error', `Error checking illustrations: ${error.message}`);
      return false;
    }
  }

  async checkDependencies() {
    this.log('info', 'Checking dependencies...');
    
    const required = ['axios', 'form-data'];
    let allInstalled = true;
    
    for (const dep of required) {
      try {
        require(dep);
        this.log('success', `Dependency ${dep} is available`);
      } catch (error) {
        this.log('error', `Missing dependency: ${dep}. Run 'npm install ${dep}'`);
        allInstalled = false;
      }
    }
    
    return allInstalled;
  }

  async checkVersesJSON() {
    this.log('info', 'Checking verses.json structure...');
    
    try {
      const versesPath = path.join(process.cwd(), 'packages/frontend/src/data/verses.json');
      const versesContent = await fs.readFile(versesPath, 'utf8');
      const verses = JSON.parse(versesContent);
      
      if (!Array.isArray(verses)) {
        this.log('error', 'verses.json is not an array');
        return false;
      }
      
      this.log('success', `Found ${verses.length} verses in verses.json`);
      
      // Check structure of first verse
      const firstVerse = verses[0];
      const requiredFields = ['id', 'title', 'body', 'alpha', 'image'];
      
      for (const field of requiredFields) {
        if (!(field in firstVerse)) {
          this.log('error', `Missing field '${field}' in verse structure`);
          return false;
        }
      }
      
      this.log('success', 'Verse structure looks good');
      
      // Check if already migrated
      if (firstVerse.ipfsHash) {
        this.log('warning', 'verses.json already contains IPFS hashes - migration may have been run before');
      }
      
      return true;
    } catch (error) {
      this.log('error', `Error reading verses.json: ${error.message}`);
      return false;
    }
  }

  async testPinataConnection() {
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
      this.log('warning', 'Skipping Pinata connection test - API keys not set');
      return true;
    }
    
    this.log('info', 'Testing Pinata connection...');
    
    try {
      const axios = require('axios');
      
      const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: {
          'pinata_api_key': process.env.PINATA_API_KEY,
          'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY
        }
      });
      
      this.log('success', 'Pinata authentication successful');
      this.log('info', `Pinata status: ${response.data.message}`);
      return true;
    } catch (error) {
      this.log('error', `Pinata connection failed: ${error.response?.data?.error || error.message}`);
      return false;
    }
  }

  async run() {
    console.log('🔍 Dao DeGen IPFS Migration - Setup Validation\n');
    
    const checks = [
      () => this.checkEnvironmentVariables(),
      () => this.checkDependencies(),
      () => this.checkDirectoryStructure(), 
      () => this.checkIllustrations(),
      () => this.checkVersesJSON(),
      () => this.testPinataConnection()
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      const result = await check();
      if (!result) allPassed = false;
      console.log(''); // Add spacing
    }
    
    // Summary
    console.log('📋 Validation Summary');
    console.log(`✅ Passed: ${this.checks.filter(c => c.type === 'success').length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n🚨 Setup Issues Found:');
      this.errors.forEach(error => console.log(`  - ${error}`));
      console.log('\nPlease fix these issues before running the migration.');
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (allPassed && this.warnings.length === 0) {
      console.log('\n🎉 Setup validation passed! Ready to run IPFS migration.');
      console.log('\nNext steps:');
      console.log('1. Set Pinata API keys if not already set');
      console.log('2. Run: npm run ipfs:migrate');
    } else if (allPassed) {
      console.log('\n✅ Setup validation passed with warnings. You can proceed with caution.');
    }
    
    return allPassed;
  }
}

// Run if called directly
if (require.main === module) {
  const validator = new SetupValidator();
  validator.run().then(success => {
    process.exit(success && validator.errors.length === 0 ? 0 : 1);
  }).catch(error => {
    console.error('💥 Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = SetupValidator;