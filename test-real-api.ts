// Test script using real component exports
// Run with: npx tsx test-real-api.ts

// Set environment variables
process.env.NEXT_PUBLIC_HF_API_KEY = 'f65f709a-5638-4046-95f7-f8e27b76992c';
process.env.NEXT_PUBLIC_HF_API_SECRET = 'ccd8ce30b0cf6de067766174b5c91156de4336e6ddb6f37f84853d33019f864c';

// Import functions from actual components
import { generateImages } from './src/components/image_jobs';
import { pollJobUntilComplete } from './src/components/poll_result';

async function test() {
  console.log('🧪 Testing with REAL Higgsfield API');
  console.log('   Using actual component exports\n');
  console.log('═'.repeat(70));
  
  // Step 1: Generate images
  console.log('\n📝 STEP 1: Generate images from prompts');
  console.log('─'.repeat(70));
  
  const prompts = ['a cat sitting on a table', 'a beautiful sunset over mountains'];
  console.log('Prompts:');
  prompts.forEach((p, i) => console.log(`   ${i + 1}. "${p}"`));
  
  console.log('\n⏳ Sending requests to API...');
  const jobSetIds = await generateImages(prompts);
  
  console.log('\n✅ Generated job set IDs:');
  jobSetIds.forEach((id, i) => console.log(`   ${i + 1}. ${id}`));
  
  if (jobSetIds.length === 0) {
    console.log('\n❌ No jobs were created. Check API credentials.');
    return;
  }
  
  // Step 2: Poll for results
  console.log('\n\n📝 STEP 2: Poll jobs until complete');
  console.log('─'.repeat(70));
  console.log(`Polling ${jobSetIds.length} job(s)...`);
  console.log('This may take 30-60 seconds...\n');
  
  const startTime = Date.now();
  
  // Add logging wrapper to see progress
  const jobsWithLogging = jobSetIds.map(async (id) => {
    console.log(`   🔄 Started polling: ${id}`);
    const url = await pollJobUntilComplete(id, {
      intervalMs: 2000,
      timeoutMs: 120_000,
    });
    if (url) {
      console.log(`   ✅ Completed: ${id}`);
    } else {
      console.log(`   ❌ Failed/Timeout: ${id}`);
    }
    return url;
  });
  
  const results = await Promise.all(jobsWithLogging);
  const imageUrls = results.filter((u): u is string => Boolean(u));
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Results
  console.log('\n' + '═'.repeat(70));
  console.log('✅ FINAL RESULTS');
  console.log('─'.repeat(70));
  console.log(`Duration: ${duration}s`);
  console.log(`Completed: ${imageUrls.length}/${jobSetIds.length} images\n`);
  
  if (imageUrls.length > 0) {
    console.log('Generated Image URLs:');
    imageUrls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });
  } else {
    console.log('⚠️  No images were generated (timeout or failed)');
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎉 Test complete!\n');
}

test().catch(console.error);
