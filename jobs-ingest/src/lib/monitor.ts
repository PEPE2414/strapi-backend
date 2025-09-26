// Monitoring and progress tracking for large-scale scraping
export class ScrapingMonitor {
  private startTime: number;
  private processed: number = 0;
  private failed: number = 0;
  private lastLogTime: number = 0;
  private memoryUsage: number[] = [];
  
  constructor(private totalTarget: number) {
    this.startTime = Date.now();
    this.lastLogTime = this.startTime;
  }
  
  recordSuccess() {
    this.processed++;
    this.logProgress();
  }
  
  recordFailure() {
    this.failed++;
    this.logProgress();
  }
  
  private logProgress() {
    const now = Date.now();
    const timeSinceLastLog = now - this.lastLogTime;
    
    // Log every 100 jobs or every 30 seconds
    if (this.processed % 100 === 0 || timeSinceLastLog > 30000) {
      const elapsed = (now - this.startTime) / 1000;
      const rate = this.processed / elapsed;
      const eta = this.totalTarget > 0 ? (this.totalTarget - this.processed) / rate : 0;
      const successRate = this.processed / (this.processed + this.failed) * 100;
      
      console.log(`📊 Progress: ${this.processed}/${this.totalTarget} (${Math.round(successRate)}% success)`);
      console.log(`⚡ Rate: ${rate.toFixed(2)} jobs/sec`);
      console.log(`⏱️  ETA: ${Math.round(eta / 60)} minutes`);
      console.log(`💾 Memory: ${this.getMemoryUsage()}MB`);
      
      this.lastLogTime = now;
    }
  }
  
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024);
    }
    return 0;
  }
  
  getStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.processed / elapsed;
    const successRate = this.processed / (this.processed + this.failed) * 100;
    
    return {
      processed: this.processed,
      failed: this.failed,
      total: this.processed + this.failed,
      successRate: Math.round(successRate * 100) / 100,
      rate: Math.round(rate * 100) / 100,
      elapsed: Math.round(elapsed),
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  logFinalStats() {
    const stats = this.getStats();
    console.log('\n🎉 Scraping completed!');
    console.log(`📊 Final Stats:`);
    console.log(`   ✅ Successful: ${stats.processed}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log(`   📈 Success Rate: ${stats.successRate}%`);
    console.log(`   ⚡ Average Rate: ${stats.rate} jobs/sec`);
    console.log(`   ⏱️  Total Time: ${stats.elapsed}s`);
    console.log(`   💾 Peak Memory: ${stats.memoryUsage}MB`);
  }
}
