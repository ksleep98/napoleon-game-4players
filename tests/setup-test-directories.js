// Setup test directories before running E2E tests
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')

const testResultsDir = path.join(__dirname, '..', 'test-results')
const screenshotsDir = path.join(testResultsDir, 'screenshots')

console.log('🏗️ Setting up test directories...')

// Create test-results directory if it doesn't exist
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true })
  console.log('✅ Created test-results directory')
} else {
  console.log('📁 test-results directory already exists')
}

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true })
  console.log('✅ Created screenshots directory')
} else {
  console.log('📁 screenshots directory already exists')
}

// Check if port 3000 is available
console.log('🔍 Checking if development server is needed...')

// Simple port check with proper error handling
const server = net.createServer()

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(
      '🟡 Port 3000 is already in use - assuming dev server is running'
    )
  } else {
    console.log(`⚠️ Port check error: ${err.message}`)
  }
})

server.on('listening', () => {
  console.log(
    '🔴 Port 3000 is available - Playwright will start dev server automatically'
  )
  server.close()
})

// Try to bind to port 3000
server.listen(3000)

// Ensure process continues regardless of port check
setTimeout(() => {
  server.close()
  console.log('🎯 Test directories setup complete')
}, 100)
