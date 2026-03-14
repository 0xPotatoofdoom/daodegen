# IPFS Immutable Storage for Dao DeGen

Upload all verse illustrations to IPFS for decentralized, immutable NFT storage.

## 🚀 Quick Start

### 1. Setup Pinata Account
1. Go to [Pinata Cloud](https://app.pinata.cloud/)
2. Create account or sign in 
3. Navigate to **API Keys** section
4. Create new API key with **Admin** permissions
5. Copy the API Key and Secret Key

### 2. Set Environment Variables
```bash
export PINATA_API_KEY="your_api_key_here"
export PINATA_SECRET_KEY="your_secret_key_here"
```

### 3. Install Dependencies
```bash
cd scripts/ipfs
npm install
```

### 4. Test Connection
```bash
npm run test
```

### 5. Upload All Files
```bash
npm run upload
```

## 📊 What Gets Uploaded

### **Images** (86 files, ~120MB total)
- All PNG illustrations from `/packages/frontend/public/illustrations/`
- Each gets unique IPFS hash (content-addressed)
- Pinned permanently on Pinata network

### **Metadata** (86 JSON files, ~50KB total)
- ERC-721 compliant metadata for each verse
- Includes name, description, attributes, IPFS image reference
- Ready for smart contract integration

### **Example Metadata Structure**
```json
{
  "name": "Dao DeGen Verse #1: The Eternal Protocol",
  "description": "Verse #1 from the Dao DeGen collection. The real protocol lives in the space between the docs and the code.",
  "image": "ipfs://QmYourImageHashHere",
  "external_url": "https://daodegen.com/verse/1",
  "attributes": [
    {"trait_type": "Verse Number", "value": 1},
    {"trait_type": "Category", "value": "Philosophical"},
    {"trait_type": "Status", "value": "Available"},
    {"trait_type": "Fee Share", "value": "1/81"}
  ]
}
```

## 🔄 Process Flow

### **Upload Process**
1. **Authentication**: Verify Pinata API credentials
2. **Batch Upload**: Upload all 86 illustrations sequentially  
3. **Metadata Generation**: Create ERC-721 metadata for each verse
4. **Metadata Upload**: Upload metadata JSON files to IPFS
5. **Update verses.json**: Replace local paths with IPFS hashes
6. **Results**: Save complete upload log and hash mapping

### **Output Files**
- `verses.json` - Updated with IPFS hashes
- `verses.json.backup.TIMESTAMP` - Original backup
- `../../ipfs-hashes.json` - Complete upload results

## 🔗 IPFS Gateway Integration

### **Multiple Gateway Strategy**
The frontend will use multiple IPFS gateways for redundancy:

```javascript
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',    // Primary (Pinata)
  'https://cloudflare-ipfs.com/ipfs/',     // Cloudflare CDN
  'https://ipfs.infura.io/ipfs/',          // Infura
  'https://gateway.ipfs.io/ipfs/'          // Public gateway
];
```

### **Frontend Updates Required**
After successful upload, update the preview carousel to:
1. Load images from IPFS URLs instead of local paths
2. Implement gateway fallback logic
3. Add loading states for IPFS content
4. Cache IPFS content aggressively

## 📊 Cost & Usage

### **Pinata Free Tier**
- ✅ **Storage**: 1GB (our ~150MB fits easily)
- ✅ **Bandwidth**: 100GB/month (generous for our traffic)  
- ✅ **Requests**: 100 per second (sufficient)
- ✅ **Gateways**: Included global CDN

### **Our Usage**
- **Images**: ~120MB (86 PNG files)
- **Metadata**: ~50KB (86 JSON files)
- **Total**: <150MB (well within free tier)

## 🔒 Security & Reliability

### **Content Integrity**
- ✅ **Immutable**: IPFS content-addressing prevents modification
- ✅ **Permanent**: Files pinned on Pinata network
- ✅ **Verifiable**: Hash verification ensures data integrity
- ✅ **Decentralized**: Accessible via multiple gateways

### **Backup Strategy**
- ✅ **Local backup**: Original files kept for 30 days
- ✅ **Multiple pins**: Consider pinning on multiple services
- ✅ **Gateway redundancy**: Multiple access points
- ✅ **Rollback ready**: Can revert verses.json instantly

## 📋 Scripts Reference

### **upload-to-pinata.js**
Main upload orchestrator:
- Authenticates with Pinata
- Uploads all illustrations
- Generates ERC-721 metadata  
- Updates verses.json with IPFS hashes
- Saves comprehensive results

### **test-pinata.js**
Connection and single-file test:
- Verifies API credentials
- Tests single file upload
- Validates gateway access
- Confirms setup before full upload

## 🐛 Troubleshooting

### **Common Issues**

#### Authentication Failed
```
❌ Pinata authentication failed: Invalid API Key
```
**Solution**: Verify API key and secret are correct and have admin permissions.

#### Network Timeout
```
❌ Failed to upload: timeout of 30000ms exceeded
```
**Solution**: Check internet connection, retry with longer timeout.

#### File Not Found
```
❌ No illustration files found
```
**Solution**: Ensure you're running from correct directory with illustrations present.

### **Rate Limiting**
The script includes 100ms delays between uploads to respect API limits. For faster uploads on paid tiers, reduce the delay in `upload-to-pinata.js`.

### **Gateway Issues**
If specific gateways are slow, update the frontend gateway list to prioritize faster options.

## ✅ Success Verification

After upload, verify:
1. ✅ All 86 images accessible via IPFS
2. ✅ verses.json updated with ipfs:// URLs
3. ✅ Preview carousel loads IPFS images
4. ✅ Metadata complies with ERC-721 standard
5. ✅ Multiple gateways working

## 🔮 Future Enhancements

### **Smart Contract Integration**
- Use IPFS metadata hashes in VerseNFT.sol
- Implement `tokenURI()` function returning IPFS metadata
- Enable marketplace compatibility (OpenSea, etc.)

### **Decentralized verses.json** 
- Store verses.json itself on IPFS
- Use IPNS for updatable references
- Fully decentralized content layer

### **Advanced Pinning**
- Pin on multiple IPFS services
- Implement content verification cron jobs
- Monitor gateway performance

---

**Ready to make Dao DeGen truly decentralized! 🌐**