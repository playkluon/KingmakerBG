const fs = require('fs');
let text = fs.readFileSync('packages/data/src/candidates.ts', 'utf8');

const partyMap = {
  'candidate-01': 'party-02',
  'candidate-02': 'party-01',
  'candidate-03': 'party-02',
  'candidate-04': 'party-07',
  'candidate-05': 'party-04',
  'candidate-06': 'party-03',
  'candidate-07': 'party-01',
  'candidate-08': 'party-06',
  'candidate-09': 'party-05',
  'candidate-10': 'party-06',
  'candidate-11': 'party-07',
  'candidate-12': 'party-01',
  'candidate-13': 'party-04',
  'candidate-14': 'party-07',
  'candidate-15': 'party-04',
  'candidate-16': 'party-05',
  'candidate-17': 'party-03',
  'candidate-18': 'party-06',
  'candidate-19': 'party-02',
  'candidate-20': 'party-03',
  'candidate-21': 'party-05',
};

for (const [id, partyId] of Object.entries(partyMap)) {
  const searchStr = `id: '${id}',`;
  const replaceStr = `id: '${id}',\n    party: '${partyId}',`;
  text = text.replace(searchStr, replaceStr);
}

fs.writeFileSync('packages/data/src/candidates.ts', text);
console.log('Done mapping candidates to parties.');
