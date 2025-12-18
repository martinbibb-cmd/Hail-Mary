/**
 * Simple test script for Rocky Worker endpoints
 * Run with: node test-worker.js [worker-url]
 */

const WORKER_URL = process.argv[2] || 'https://hail-mary.martinbibb.workers.dev';

async function testHealth() {
  console.log('🔍 Testing GET /health...');
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check response:', JSON.stringify(data, null, 2));
    
    if (!data.ok) {
      console.error('❌ Health check failed: ok is not true');
      return false;
    }
    
    if (!data.providers) {
      console.error('❌ Health check failed: no providers field');
      return false;
    }
    
    console.log('✅ Health check passed');
    return true;
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    return false;
  }
}

async function testAnalyse() {
  console.log('\n🔍 Testing POST /rocky/analyse...');
  try {
    const response = await fetch(`${WORKER_URL}/rocky/analyse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitId: 'test-123',
        transcriptChunk: 'The boiler is making a strange whistling noise when it heats up.',
        snapshot: {},
      }),
    });
    
    const data = await response.json();
    console.log('✅ Analyse response:', JSON.stringify(data, null, 2));
    
    if (!data.ok && !data.plainEnglishSummary) {
      console.error('❌ Analyse failed: neither ok nor plainEnglishSummary present');
      return false;
    }
    
    if (data.plainEnglishSummary) {
      console.log('✅ Plain English Summary:', data.plainEnglishSummary);
    }
    
    if (data.technicalRationale) {
      console.log('✅ Technical Rationale:', data.technicalRationale);
    }
    
    if (data.blockers && data.blockers.length > 0) {
      console.log('⚠️  Blockers detected:', data.blockers);
    }
    
    if (data.providerUsed) {
      console.log('✅ Provider used:', data.providerUsed);
    }
    
    console.log('✅ Analyse test passed');
    return true;
  } catch (error) {
    console.error('❌ Analyse error:', error.message);
    return false;
  }
}

async function testInvalidRequest() {
  console.log('\n🔍 Testing invalid request handling...');
  try {
    const response = await fetch(`${WORKER_URL}/rocky/analyse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing required fields
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 400) {
      console.log('✅ Correctly returns 400 for invalid request');
      console.log('✅ Error message:', data.error);
      return true;
    } else {
      console.error('❌ Should return 400 for invalid request, got:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Invalid request test error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Rocky Worker at:', WORKER_URL);
  console.log('═══════════════════════════════════════════════════\n');
  
  const results = [];
  
  results.push(await testHealth());
  results.push(await testAnalyse());
  results.push(await testInvalidRequest());
  
  console.log('\n═══════════════════════════════════════════════════');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✅ All tests passed (${passed}/${total})`);
    process.exit(0);
  } else {
    console.log(`❌ Some tests failed (${passed}/${total} passed)`);
    process.exit(1);
  }
}

runTests();
