#!/usr/bin/env node

/**
 * Health Check Script for Dao DeGen Frontend
 * Tests build process, verifies dependencies, and checks for common issues
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔍 Running Dao DeGen Frontend Health Check...\n')

const issues = []
const warnings = []

// Check 1: Verify verses.json exists and is valid
console.log('📋 Checking verses.json...')
try {
  const versesPath = path.join(__dirname, '../src/data/verses.json')
  if (!fs.existsSync(versesPath)) {
    issues.push('❌ verses.json not found at src/data/verses.json')
  } else {
    const verses = JSON.parse(fs.readFileSync(versesPath, 'utf8'))
    if (!Array.isArray(verses)) {
      issues.push('❌ verses.json is not an array')
    } else if (verses.length !== 81) {
      warnings.push(`⚠️  Expected 81 verses, found ${verses.length}`)
    } else {
      console.log(`✅ Found ${verses.length} verses`)
      
      // Check verse structure
      const requiredFields = ['id', 'title', 'body', 'image']
      const firstVerse = verses[0]
      const missingFields = requiredFields.filter(field => !firstVerse[field])
      if (missingFields.length > 0) {
        warnings.push(`⚠️  Verse missing fields: ${missingFields.join(', ')}`)
      }
    }
  }
} catch (error) {
  issues.push(`❌ Error reading verses.json: ${error.message}`)
}

// Check 2: Verify package.json dependencies
console.log('\n📦 Checking dependencies...')
try {
  const packagePath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  const requiredDeps = ['next', 'react', 'react-dom', 'tailwindcss']
  const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep])
  
  if (missingDeps.length > 0) {
    issues.push(`❌ Missing dependencies: ${missingDeps.join(', ')}`)
  } else {
    console.log('✅ All required dependencies found')
  }
  
  // Check for version conflicts
  const tailwindVersion = pkg.dependencies['tailwindcss']
  const tailwindPostcssVersion = pkg.dependencies['@tailwindcss/postcss']
  
  if (tailwindPostcssVersion && tailwindVersion) {
    const tailwindMajor = tailwindVersion.match(/\d+/)?.[0]
    const postcssVer = tailwindPostcssVersion.match(/\d+/)?.[0]
    if (tailwindMajor !== postcssVer) {
      warnings.push(`⚠️  Version mismatch: tailwindcss v${tailwindMajor} with @tailwindcss/postcss v${postcssVer}`)
    }
  }
  
} catch (error) {
  issues.push(`❌ Error reading package.json: ${error.message}`)
}

// Check 3: Verify build process
console.log('\n🔨 Testing build process...')
try {
  console.log('Running npm run build...')
  execSync('npm run build', { stdio: 'pipe', cwd: path.join(__dirname, '..') })
  console.log('✅ Build completed successfully')
} catch (error) {
  issues.push(`❌ Build failed: ${error.message}`)
}

// Check 4: Verify TypeScript configuration
console.log('\n🔧 Checking TypeScript config...')
try {
  const tsconfigPath = path.join(__dirname, '../tsconfig.json')
  if (!fs.existsSync(tsconfigPath)) {
    warnings.push('⚠️  No tsconfig.json found')
  } else {
    console.log('✅ TypeScript config found')
  }
} catch (error) {
  warnings.push(`⚠️  TypeScript config issue: ${error.message}`)
}

// Check 5: Verify essential pages exist
console.log('\n📄 Checking page structure...')
const requiredPages = [
  'src/app/page.tsx',
  'src/app/layout.tsx', 
  'src/app/verses/page.tsx',
  'src/app/verse/[id]/page.tsx'
]

requiredPages.forEach(pagePath => {
  const fullPath = path.join(__dirname, '..', pagePath)
  if (!fs.existsSync(fullPath)) {
    issues.push(`❌ Missing required page: ${pagePath}`)
  } else {
    console.log(`✅ Found ${pagePath}`)
  }
})

// Check 6: Verify Tailwind configuration
console.log('\n🎨 Checking Tailwind config...')
try {
  const tailwindConfigPath = path.join(__dirname, '../tailwind.config.js')
  if (!fs.existsSync(tailwindConfigPath)) {
    warnings.push('⚠️  No tailwind.config.js found')
  } else {
    const config = require(tailwindConfigPath)
    if (!config.theme?.extend?.colors?.['dao-purple']) {
      warnings.push('⚠️  Custom dao-purple color not found in Tailwind config')
    } else {
      console.log('✅ Custom colors configured')
    }
  }
} catch (error) {
  warnings.push(`⚠️  Tailwind config issue: ${error.message}`)
}

// Summary
console.log('\n' + '='.repeat(50))
console.log('📊 HEALTH CHECK SUMMARY')
console.log('='.repeat(50))

if (issues.length === 0) {
  console.log('🎉 All critical checks passed!')
} else {
  console.log(`❌ Found ${issues.length} critical issue(s):`)
  issues.forEach(issue => console.log(`   ${issue}`))
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Found ${warnings.length} warning(s):`)
  warnings.forEach(warning => console.log(`   ${warning}`))
}

if (issues.length === 0 && warnings.length === 0) {
  console.log('\n✨ Perfect! Frontend is ready for deployment.')
} else if (issues.length === 0) {
  console.log('\n👍 Frontend is functional with minor warnings.')
} else {
  console.log('\n🔧 Please fix critical issues before deployment.')
  process.exit(1)
}

console.log('\n🚀 Health check complete!')