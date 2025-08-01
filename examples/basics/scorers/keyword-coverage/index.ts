import { createKeywordCoverageScorer } from '@mastra/evals/scorers/code';

// Configure the metric
const metric = createKeywordCoverageScorer();

// Example 1: Full keyword coverage
const input1 = 'JavaScript frameworks like React and Vue';
const output1 = 'Popular JavaScript frameworks include React and Vue for web development';

console.log('Example 1 - Full Coverage:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric.run({
  input: [{ role: 'user', content: input1 }],
  output: { role: 'assistant', text: output1 },
});
console.log('Metric Result:', {
  score: result1.score,
  analyzeStepResult: result1.analyzeStepResult,
});

// Example 2: Partial keyword coverage
const input2 = 'TypeScript offers interfaces, generics, and type inference';
const output2 = 'TypeScript provides type inference and some advanced features';

console.log('Example 2 - Partial Coverage:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric.run({
  input: [{ role: 'user', content: input2 }],
  output: { role: 'assistant', text: output2 },
});
console.log('Metric Result:', {
  score: result2.score,
  analyzeStepResult: result2.analyzeStepResult,
});

// Example 3: Minimal keyword coverage
const input3 = 'Machine learning models require data preprocessing, feature engineering, and hyperparameter tuning';
const output3 = 'Data preparation is important for models';

console.log('Example 3 - Minimal Coverage:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric.run({
  input: [{ role: 'user', content: input3 }],
  output: { role: 'assistant', text: output3 },
});
console.log('Metric Result:', {
  score: result3.score,
  analyzeStepResult: result3.analyzeStepResult,
});
