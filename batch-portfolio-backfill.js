// 批量回填默认作品集的测试脚本
// 这个脚本可以在浏览器控制台中运行，用于手动执行批量回填

async function runBatchBackfill(batchSize = 50) {
  console.log('🔍 开始执行批量回填默认作品集...');
  console.log('📊 批次大小:', batchSize);
  
  try {
    // 调用云函数进行批量回填
    const result = await wx.cloud.callFunction({
      name: 'ensureDefaultPortfolio',
      data: {
        mode: 'batch',
        batchSize: batchSize
      }
    });
    
    console.log('📊 批量回填结果:', result);
    
    if (result.result.success) {
      console.log('✅ 批量回填成功!');
      console.log('📈 统计信息:');
      console.log('  - 处理用户数:', result.result.processed);
      console.log('  - 创建作品集数:', result.result.created);
      console.log('  - 已有作品集数:', result.result.alreadyHas);
      console.log('  - 错误数:', result.result.errors);
      
      if (result.result.errorDetails && result.result.errorDetails.length > 0) {
        console.log('❌ 错误详情:', result.result.errorDetails);
      }
      
      return result.result;
    } else {
      console.error('❌ 批量回填失败:', result.result.message);
      return result.result;
    }
  } catch (error) {
    console.error('❌ 执行批量回填时出错:', error);
    return { error: error.message };
  }
}

// 导出函数供外部调用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runBatchBackfill };
}

console.log('📝 批量回填脚本已加载');
console.log('💡 使用方法:');
console.log('   1. runBatchBackfill() - 使用默认批次大小(50)执行回填');
console.log('   2. runBatchBackfill(100) - 使用指定批次大小执行回填');
console.log('');
console.log('⚠️ 注意: 批量回填会为所有没有作品集的用户创建默认作品集');
console.log('⚠️ 建议先使用较小的批次大小进行测试');


