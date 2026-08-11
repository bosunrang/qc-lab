export function dashboardCompletion(testCount: number, missingTodayCount: number) {
  const completeTests = Math.max(0, testCount - missingTodayCount);
  return { completeTests, percent: testCount ? Math.round(completeTests / testCount * 100) : 0 };
}
