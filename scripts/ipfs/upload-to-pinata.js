#!/usr/bin/env node

/**
 * Upload Dao DeGen illustrations to IPFS via Pinata
 * 
 * Usage: node upload-to-pinata.js
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Pinata API configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_BASE_URL = 'https://api.pinata.cloud';

// Paths
const ILLUSTRATIONS_PATH = path.join(__dirname, '../../packages/frontend/public/illustrations');
const VERSES_JSON_PATH = path.join(__dirname, '../../packages/frontend/src/data/verses.json');
const OUTPUT_PATH = path.join(__dirname, '../../ipfs-hashes.json');

class PinataUploader {
  constructor() {
    this.uploadedHashes = [];
    this.failedUploads = [];
  }

  async testConnection() {
    try {
      const response = await axios.get(`${PINATA_BASE_URL}/data/testAuthentication`, {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      });
      console.log('✅ Pinata authentication successful:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Pinata authentication failed:', error.response?.data || error.message);
      return false;
    }
  }

  async uploadFile(filePath, fileName) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      
      const metadata = JSON.stringify({
        name: `dao-degen-${fileName}`,
        keyvalues: {
          project: 'dao-degen',
          type: 'verse-illustration',
          verse: fileName.match(/verse-(\\d+)/)?.[1] || 'unknown'
        }
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 0,
      });
      formData.append('pinataOptions', options);

      const response = await axios.post(`${PINATA_BASE_URL}/pinning/pinFileToIPFS`, formData, {
        maxContentLength: Infinity,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      });

      console.log(`✅ Uploaded ${fileName}: ${response.data.IpfsHash}`);
      return {
        fileName,
        ipfsHash: response.data.IpfsHash,
        size: response.data.PinSize,
        timestamp: response.data.Timestamp
      };
    } catch (error) {
      console.error(`❌ Failed to upload ${fileName}:`, error.response?.data || error.message);
      this.failedUploads.push({ fileName, error: error.message });
      return null;
    }
  }

  async uploadAllIllustrations() {
    console.log('🎨 Starting batch upload of verse illustrations...');
    
    const files = fs.readdirSync(ILLUSTRATIONS_PATH)
      .filter(file => file.endsWith('.png'))
      .sort(); // Ensure consistent ordering

    console.log(`📂 Found ${files.length} illustration files to upload`);

    let uploaded = 0;
    const results = [];

    for (const file of files) {
      const filePath = path.join(ILLUSTRATIONS_PATH, file);
      console.log(`📤 Uploading ${uploaded + 1}/${files.length}: ${file}`);
      
      const result = await this.uploadFile(filePath, file);
      if (result) {
        results.push(result);
        uploaded++;
      }

      // Rate limiting - wait 100ms between uploads
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\\n📊 Upload Summary:`);
    console.log(`   ✅ Successful: ${uploaded}`);
    console.log(`   ❌ Failed: ${this.failedUploads.length}`);
    
    if (this.failedUploads.length > 0) {
      console.log(`\\n❌ Failed uploads:`);
      this.failedUploads.forEach(fail => {
        console.log(`   - ${fail.fileName}: ${fail.error}`);
      });
    }

    return results;
  }

  async generateMetadata(verseData, imageHash) {
    const metadata = {
      name: `Dao DeGen Verse #${verseData.id}: ${verseData.title}`,
      description: `Verse #${verseData.id} from the Dao DeGen collection. ${verseData.alpha}`,
      image: `ipfs://${imageHash}`,
      external_url: `https://daodegen.com/verse/${verseData.id}`,
      attributes: [
        {
          trait_type: "Verse Number",
          value: verseData.id
        },
        {
          trait_type: "Title",
          value: verseData.title
        },
        {
          trait_type: "Category", 
          value: this.categorizeVerse(verseData.title)
        },
        {
          trait_type: "Status",
          value: "Available" // Will be updated based on minting
        },
        {
          trait_type: "Fee Share",
          value: "1/81"
        }
      ]
    };

    return metadata;
  }

  categorizeVerse(title) {
    const philosophicalTerms = ['eternal', 'protocol', 'duality', 'spirit', 'tao'];
    const technicalTerms = ['contract', 'validator', 'block', 'gas', 'oracle'];
    const tradingTerms = ['market', 'liquidity', 'yield', 'bags', 'leverage'];

    const lowercaseTitle = title.toLowerCase();
    
    if (philosophicalTerms.some(term => lowercaseTitle.includes(term))) {
      return "Philosophical";
    }
    if (technicalTerms.some(term => lowercaseTitle.includes(term))) {
      return "Technical";
    }
    if (tradingTerms.some(term => lowercaseTitle.includes(term))) {
      return "Trading";
    }
    
    return "Wisdom";
  }

  async uploadMetadata(metadata, fileName) {
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(JSON.stringify(metadata, null, 2)), {
        filename: `${fileName}.json`,
        contentType: 'application/json'
      });
      
      const pinataMetadata = JSON.stringify({
        name: `dao-degen-metadata-${fileName}`,
        keyvalues: {
          project: 'dao-degen',
          type: 'verse-metadata',
          verse: fileName.match(/verse-(\\d+)/)?.[1] || 'unknown'
        }
      });
      formData.append('pinataMetadata', pinataMetadata);

      const response = await axios.post(`${PINATA_BASE_URL}/pinning/pinFileToIPFS`, formData, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      });

      return response.data.IpfsHash;
    } catch (error) {
      console.error(`❌ Failed to upload metadata for ${fileName}:`, error.response?.data || error.message);
      return null;
    }
  }

  async updateVersesJson(uploadResults) {
    console.log('\\n📝 Updating verses.json with IPFS hashes...');
    
    const versesData = JSON.parse(fs.readFileSync(VERSES_JSON_PATH, 'utf8'));
    
    // Create mapping of verse ID to IPFS hash
    const hashMap = {};
    uploadResults.forEach(result => {
      const verseId = result.fileName.match(/verse-(\\d+)/)?.[1];
      if (verseId) {
        hashMap[parseInt(verseId)] = result.ipfsHash;
      }
    });

    // Update verses with IPFS data and generate metadata
    const updatedVerses = [];
    for (const verse of versesData) {
      const imageHash = hashMap[verse.id];
      if (imageHash) {
        // Generate and upload metadata
        const metadata = await this.generateMetadata(verse, imageHash);
        const metadataHash = await this.uploadMetadata(metadata, `verse-${verse.id.toString().padStart(2, '0')}`);
        
        const updatedVerse = {
          ...verse,
          image: `ipfs://${imageHash}`,
          metadata: metadataHash ? `ipfs://${metadataHash}` : undefined,
          ipfs: {
            imageHash,
            metadataHash,
            uploadedAt: new Date().toISOString()
          }
        };
        updatedVerses.push(updatedVerse);
        console.log(`✅ Updated verse ${verse.id}: ${verse.title}`);
      } else {
        console.warn(`⚠️  No IPFS hash found for verse ${verse.id}: ${verse.title}`);
        updatedVerses.push(verse); // Keep original
      }
    }

    // Write updated verses.json
    const backupPath = VERSES_JSON_PATH + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, fs.readFileSync(VERSES_JSON_PATH));
    fs.writeFileSync(VERSES_JSON_PATH, JSON.stringify(updatedVerses, null, 2));
    
    console.log(`✅ Updated verses.json (backup: ${path.basename(backupPath)})`);
    return updatedVerses;
  }

  async saveResults(uploadResults, versesData) {
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: uploadResults.length,
        successfulUploads: uploadResults.length,
        failedUploads: this.failedUploads.length,
        totalSize: uploadResults.reduce((sum, r) => sum + r.size, 0)
      },
      uploads: uploadResults,
      failures: this.failedUploads,
      versesUpdated: versesData.length
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\\n📁 Results saved to: ${OUTPUT_PATH}`);
  }
}

async function main() {
  console.log('🚀 Dao DeGen IPFS Upload Starting...');
  
  // Check environment variables
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    console.error('❌ Missing Pinata API credentials. Please set PINATA_API_KEY and PINATA_SECRET_KEY environment variables.');
    process.exit(1);
  }

  const uploader = new PinataUploader();
  
  // Test connection
  const isConnected = await uploader.testConnection();
  if (!isConnected) {
    process.exit(1);
  }

  try {
    // Upload all illustrations
    const uploadResults = await uploader.uploadAllIllustrations();
    
    if (uploadResults.length === 0) {
      console.error('❌ No files were uploaded successfully');
      process.exit(1);
    }

    // Update verses.json
    const updatedVerses = await uploader.updateVersesJson(uploadResults);
    
    // Save results
    await uploader.saveResults(uploadResults, updatedVerses);
    
    console.log('\\n🎉 IPFS upload completed successfully!');
    console.log(`\\n📋 Next steps:`);
    console.log(`   1. Test the updated preview carousel: https://daodegen.com`);
    console.log(`   2. Verify IPFS gateways are working`);
    console.log(`   3. Update smart contracts with IPFS metadata URIs`);
    console.log(`   4. Deploy to production`);
    
  } catch (error) {
    console.error('❌ Upload process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PinataUploader };