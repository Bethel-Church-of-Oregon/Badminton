const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'admin';

const members = [
  'James Park', 'Emily Chen', 'Daniel Kim', 'Sarah Lee', 'Michael Tan',
  'Jessica Yoon', 'David Lim', 'Grace Oh', 'Kevin Cho', 'Hannah Ng',
  'Brian Kwon', 'Mia Seo', 'Jason Wu', 'Sophia Bae', 'Ryan Choi',
  'Olivia Moon', 'Nathan Jang', 'Chloe Shin', 'Tyler Hong', 'Lily Yoo',
];

for (const name of members) {
  const res = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password: PASSWORD }),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`Added: ${name}`);
  } else {
    console.log(`Skipped: ${name} — ${data.error}`);
  }
}

console.log('Done.');
