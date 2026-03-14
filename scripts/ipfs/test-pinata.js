#!/usr/bin/env node

/**
 * Test Pinata connection and upload a single test file
 */

const fs = require('fs');
const path = require('path');
const { PinataUploader } = require('./upload-to-pinata');

async function testPinataConnection() {
  console.log('🧪 Testing Pinata IPFS connection...');
  
  // Check environment variables
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    console.error('❌ Missing Pinata API credentials');
    console.log('📋 Setup instructions:');
    console.log('   1. Go to https://app.pinata.cloud/');
    console.log('   2. Create account or sign in');
    console.log('   3. Go to API Keys section'); 
    console.log('   4. Create new API key with admin permissions');
    console.log('   5. Set environment variables:');
    console.log('      export PINATA_API_KEY="your_api_key_here"');
    console.log('      export PINATA_SECRET_KEY="your_secret_key_here"');
    return false;
  }

  const uploader = new PinataUploader();
  
  // Test authentication
  const isConnected = await uploader.testConnection();
  if (!isConnected) {
    return false;
  }

  // Test single file upload (use smallest illustration)
  const illustrationsPath = path.join(__dirname, '../../packages/frontend/public/illustrations');
  const testFile = fs.readdirSync(illustrationsPath)
    .filter(file => file.endsWith('.png'))
    .sort()[0]; // First file alphabetically

  if (!testFile) {
    console.error('❌ No illustration files found for testing');
    return false;
  }

  console.log(`📤 Testing upload with file: ${testFile}`);
  const testPath = path.join(illustrationsPath, testFile);
  const result = await uploader.uploadFile(testPath, `test-${testFile}`);
  
  if (result) {
    console.log(`✅ Test upload successful!`);
    console.log(`   IPFS Hash: ${result.ipfsHash}`);
    console.log(`   Gateway URL: https://gateway.pinata.cloud/ipfs/${result.ipfsHash}`);
    console.log(`   File Size: ${(result.size / 1024).toFixed(1)} KB`);
    
    // Test accessing via gateway
    console.log('🔗 Testing IPFS gateway access...');
    const axios = require('axios');
    try {
      const response = await axios.head(`https://gateway.pinata.cloud/ipfs/${result.ipfsHash}`, {
        timeout: 10000
      });
      console.log(`✅ Gateway access successful (${response.status})`);
    } catch (error) {
      console.warn(`⚠️  Gateway access failed: ${error.message}`);
    }
    
    return true;
  } else {
    console.error('❌ Test upload failed');
    return false;
  }
}

async function main() {
  const success = await testPinataConnection();
  
  if (success) {
    console.log('\\n🎉 Pinata setup is working correctly!');
    console.log('\\n📋 Ready for full upload. Run:');
    console.log('   npm run upload');
  } else {
    console.log('\\n❌ Pinata setup needs attention before proceeding');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}