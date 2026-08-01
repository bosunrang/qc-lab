const assert = require('node:assert/strict');
const { parseScenarios } = require('../benchmarks/performance-baseline');

assert.deepEqual(parseScenarios(['--ten-years']), [{ name:'ten-years',tests:50,levels:3,days:3650 }]);
assert.equal(parseScenarios(['--ten-years','--quick'])[0].name, 'ten-years', 'stress test 10 năm phải ưu tiên hơn quick');
assert.equal(parseScenarios(['--deployment-only'])[0].days, 730);

console.log('Performance baseline scenario tests passed');
