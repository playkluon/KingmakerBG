const fs = require('fs');
let text = fs.readFileSync('packages/data/src/issues.ts', 'utf8');

const issueMap = {
  'issue-01': "advantage: { targetTag: 'economy-welfare', voteBonus: 2, vpBonus: 1 }",
  'issue-02': "advantage: { targetTag: 'labor-corporateAutonomy', voteBonus: 2, vpBonus: 1 }",
  'issue-03': "advantage: { targetTag: 'economy-market', voteBonus: 2, vpBonus: 1 }",
  'issue-04': "advantage: { targetTag: 'labor-workerRights', voteBonus: 2, vpBonus: 1 }",
  'issue-05': "advantage: { targetTag: 'industry-environment', voteBonus: 2, vpBonus: 1 }",
  'issue-06': "advantage: { targetTag: 'industry-growth', voteBonus: 2, vpBonus: 1 }", // 지방 개발
  'issue-07': "advantage: { targetTag: 'labor-workerRights', voteBonus: 2, vpBonus: 1 }",
  'issue-08': "advantage: { targetTag: 'foreign-protectionism', voteBonus: 2, vpBonus: 1 }",
  'issue-09': "advantage: { targetTag: 'economy-welfare', voteBonus: 2, vpBonus: 1 }",
  'issue-10': "advantage: { targetTag: 'economy-market', voteBonus: 2, vpBonus: 1 }",
  'issue-11': "advantage: { targetTag: 'society-civilLiberties', voteBonus: 2, vpBonus: 1 }",
  'issue-12': "advantage: { targetTag: 'society-order', voteBonus: 2, vpBonus: 1 }",
  'issue-13': "advantage: { targetTag: 'economy-welfare', voteBonus: 2, vpBonus: 1 }",
  'issue-14': "advantage: { targetTag: 'foreign-openness', voteBonus: 2, vpBonus: 1 }",
  'issue-15': "advantage: { targetTag: 'industry-growth', voteBonus: 2, vpBonus: 1 }",
};

for (const [id, advantage] of Object.entries(issueMap)) {
  const searchStr = `id: '${id}',`;
  const replaceStr = `id: '${id}',\n    ${advantage},`;
  text = text.replace(searchStr, replaceStr);
}

fs.writeFileSync('packages/data/src/issues.ts', text);
console.log('Done mapping issues to advantages.');
