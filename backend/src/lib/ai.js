import { config } from '../config.js';
import { isoDate, addDays } from './util.js';

const T = (key, title, description, resource_title, resource_url) => ({ key, title, description, resource_title, resource_url });

const TRACKS = [
  { match: /front|react|vue|angular|svelte|\bui\b|web|css/i, topics: [
    T('typescript', 'TypeScript in depth', 'Generics, narrowing, utility types and typing React components.', 'TypeScript Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html'),
    T('react', 'Advanced React patterns', 'Hooks, composition, performance profiling and state design.', 'React documentation', 'https://react.dev/learn'),
    T('css', 'Modern CSS layout and design systems', 'Grid, container queries, tokens and component libraries.', 'web.dev Learn CSS', 'https://web.dev/learn/css'),
    T('accessib', 'Accessibility fundamentals', 'Semantics, keyboard support, ARIA and screen reader testing.', 'web.dev Learn Accessibility', 'https://web.dev/learn/accessibility'),
    T('performance', 'Web performance', 'Core Web Vitals, bundle analysis and rendering strategies.', 'web.dev Learn Performance', 'https://web.dev/learn/performance'),
    T('testing', 'Frontend testing', 'Component and end-to-end tests with realistic user flows.', 'Testing Library docs', 'https://testing-library.com/docs/'),
    T('roadmap', 'Review the frontend roadmap', 'Spot remaining gaps and pick one area to go deeper on.', 'Frontend roadmap', 'https://roadmap.sh/frontend'),
  ] },
  { match: /back|node|api|java|spring|python|django|server|golang|\bgo\b|nest|express/i, topics: [
    T('node', 'Node.js internals and async patterns', 'Event loop, streams, error handling and worker threads.', 'Node.js learn', 'https://nodejs.org/en/learn'),
    T('sql', 'PostgreSQL and data modelling', 'Schema design, indexes, query plans and transactions.', 'PostgreSQL tutorial', 'https://www.postgresql.org/docs/current/tutorial.html'),
    T('api', 'API design and versioning', 'REST conventions, pagination, idempotency and error models.', 'Backend roadmap', 'https://roadmap.sh/backend'),
    T('security', 'Application security', 'Authentication, authorization and the OWASP Top 10.', 'OWASP Top Ten', 'https://owasp.org/www-project-top-ten/'),
    T('docker', 'Containers with Docker', 'Images, volumes, networking and Compose for local and prod.', 'Docker get started', 'https://docs.docker.com/get-started/'),
    T('caching', 'Caching and queues', 'Where to cache, invalidation and background job design.', 'System design roadmap', 'https://roadmap.sh/system-design'),
    T('observ', 'Logging, metrics and tracing', 'Make services observable and debug production issues.', 'Backend roadmap', 'https://roadmap.sh/backend'),
  ] },
  { match: /devops|cloud|aws|infra|sre|platform|kubernetes/i, topics: [
    T('linux', 'Linux and networking essentials', 'Processes, permissions, DNS, TCP and troubleshooting.', 'DevOps roadmap', 'https://roadmap.sh/devops'),
    T('aws', 'AWS core services', 'IAM, VPC, EC2, S3 and RDS with least-privilege design.', 'AWS documentation', 'https://docs.aws.amazon.com/'),
    T('docker', 'Containers in production', 'Build optimisation, health checks and registries.', 'Docker docs', 'https://docs.docker.com/get-started/'),
    T('kubernetes', 'Kubernetes basics', 'Pods, deployments, services and configuration.', 'Kubernetes tutorials', 'https://kubernetes.io/docs/tutorials/'),
    T('ci', 'CI/CD pipelines', 'Automated builds, tests and safe deployments.', 'DevOps roadmap', 'https://roadmap.sh/devops'),
    T('terraform', 'Infrastructure as code', 'Declarative infrastructure, state and modules.', 'Terraform tutorials', 'https://developer.hashicorp.com/terraform/tutorials'),
  ] },
  { match: /data|ml|machine|\bai\b|analytic|science/i, topics: [
    T('python', 'Python for data work', 'Idiomatic Python, notebooks and environment management.', 'Python tutorial', 'https://docs.python.org/3/tutorial/'),
    T('pandas', 'Data wrangling with pandas', 'Cleaning, joining and reshaping real datasets.', 'pandas getting started', 'https://pandas.pydata.org/docs/getting_started/index.html'),
    T('sql', 'Analytical SQL', 'Window functions, CTEs and query optimisation.', 'PostgreSQL tutorial', 'https://www.postgresql.org/docs/current/tutorial.html'),
    T('statistics', 'Statistics refresher', 'Distributions, hypothesis testing and experiment design.', 'AI and data science roadmap', 'https://roadmap.sh/ai-data-scientist'),
    T('scikit', 'Machine learning with scikit-learn', 'Train, evaluate and compare models responsibly.', 'scikit-learn tutorials', 'https://scikit-learn.org/stable/tutorial/index.html'),
  ] },
  { match: /mobile|android|ios|swift|kotlin|flutter|react native/i, topics: [
    T('kotlin', 'Android with Kotlin', 'Jetpack Compose, state and lifecycle.', 'Android courses', 'https://developer.android.com/courses'),
    T('swift', 'iOS with SwiftUI', 'Views, data flow and navigation.', 'SwiftUI tutorials', 'https://developer.apple.com/tutorials/swiftui'),
    T('offline', 'Offline-first and sync', 'Local storage, conflict handling and background work.', 'Android courses', 'https://developer.android.com/courses'),
    T('release', 'Release and quality', 'Testing, crash reporting and store release flow.', 'Android courses', 'https://developer.android.com/courses'),
  ] },
];
const GENERIC = [
  T('fundamentals', 'Strengthen engineering fundamentals', 'Data structures, debugging and reading unfamiliar code.', 'Developer roadmaps', 'https://roadmap.sh/'),
  T('git', 'Git workflow and code review', 'Clean history, small pull requests and constructive reviews.', 'Pro Git book', 'https://git-scm.com/book/en/v2'),
];
const CROSS = [
  T('system design', 'System design fundamentals', 'Scalability, trade-offs and drawing clear architecture diagrams.', 'System design roadmap', 'https://roadmap.sh/system-design'),
  T('testing', 'Testing strategy', 'Unit, integration and end-to-end balance; testing for confidence.', 'Testing guide', 'https://martinfowler.com/articles/practical-test-pyramid.html'),
  T('communication', 'Technical communication', 'Write design docs and explain trade-offs to non-engineers.', 'Google tech writing course', 'https://developers.google.com/tech-writing'),
];
const LEAD = [T('mentor', 'Mentoring and technical leadership', 'Give feedback, delegate and grow others.', 'The Manager\'s Path summary', 'https://www.oreilly.com/library/view/the-managers-path/9781491973882/')];

export function templatePlan(a) {
  const hours = Number(a.hours_per_week) || 5;
  const W = Math.min(26, Math.max(2, Number(a.timeline_weeks) || 12));
  const perWeek = hours <= 4 ? 1 : hours <= 10 ? 2 : 3;
  const text = `${a.role_target} ${a.domain}`;
  const have = (a.skills || []).map((s) => s.toLowerCase());
  const track = TRACKS.find((t) => t.match.test(text)) || TRACKS.find((t) => t.match.test(`${a.role_current} ${have.join(' ')}`));
  const senior = /senior|staff|lead|principal|manager/i.test(`${a.role_target} ${a.level}`);
  const pool = [...(track ? track.topics : []), ...GENERIC.slice(0, track ? 0 : 2), ...CROSS, ...(senior ? LEAD : [])]
    .filter((t, i, arr) => arr.findIndex((x) => x.title === t.title) === i)
    .filter((t) => !have.some((s) => s.includes(t.key) || t.key.includes(s)));
  const queue = [
    T('', 'Baseline: map your gaps', `List what ${a.role_target || 'the target role'} expects and rate yourself on each area; agree priorities with your manager.`, '', ''),
    ...pool,
  ];
  const slots = W * perWeek;
  const items = queue.slice(0, Math.max(1, slots - 1));
  items.push(T('', 'Capstone: apply what you learned', `Ship a small project or internal improvement that demonstrates ${a.role_target || 'your new skills'}, and write a short retrospective.`, '', ''));
  const start = new Date();
  return {
    title: `Path to ${a.role_target || 'your next role'}`,
    summary: `${W}-week roadmap from ${a.role_current || 'your current role'} to ${a.role_target || 'your target role'}${a.domain ? ` with a focus on ${a.domain}` : ''}, sized for about ${hours} hours per week.`,
    items: items.map((t, i) => {
      const week = Math.min(W, Math.floor(i / perWeek) + 1);
      return { week, title: t.title, description: t.description, resource_title: t.resource_title, resource_url: t.resource_url, due_date: isoDate(addDays(start, week * 7)) };
    }),
  };
}

const SYSTEM = `You design practical learning roadmaps for employees. Reply with ONE JSON object only, no markdown, shaped exactly as:
{"title": string, "summary": string (max 300 chars), "items": [{"week": integer, "title": string, "description": string (max 220 chars), "resource_title": string, "resource_url": string}]}
Rules: weeks start at 1 and never exceed the requested timeline; use 1 to 3 items per week depending on weekly hours; order items so skills build on each other; end with a capstone item; resource_url must be a stable official documentation or well-known learning URL, or an empty string if unsure. Never invent URLs.`;

function userPrompt(a) {
  return `Current role: ${a.role_current} (${a.level})
Current skills: ${(a.skills || []).join(', ') || 'none listed'}
Target role: ${a.role_target}
Domain focus: ${a.domain || 'not specified'}
Time available: ${a.hours_per_week} hours per week for ${a.timeline_weeks} weeks
Notes: ${a.notes || 'none'}`;
}

async function callProvider(a) {
  const { provider, key } = config.ai;
  const signal = AbortSignal.timeout(60000);
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.ai.model || 'claude-sonnet-4-5', max_tokens: 4000, system: SYSTEM, messages: [{ role: 'user', content: userPrompt(a) }] }),
    });
    if (!r.ok) throw new Error(`Anthropic API ${r.status}`);
    const j = await r.json();
    return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ai.model || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt(a) }] }),
  });
  if (!r.ok) throw new Error(`OpenAI API ${r.status}`);
  return (await r.json()).choices?.[0]?.message?.content || '';
}

function clean(raw, a) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  const j = JSON.parse(raw.slice(s, e + 1));
  const W = Math.min(26, Math.max(2, Number(a.timeline_weeks) || 12));
  const start = new Date();
  const items = (Array.isArray(j.items) ? j.items : []).slice(0, 60).map((i) => {
    const week = Math.min(W, Math.max(1, parseInt(i.week, 10) || 1));
    const url = String(i.resource_url || '').trim();
    return {
      week, title: String(i.title || '').slice(0, 200), description: String(i.description || '').slice(0, 1000),
      resource_title: String(i.resource_title || '').slice(0, 200), resource_url: /^https?:\/\/\S+$/i.test(url) ? url.slice(0, 500) : '',
      due_date: isoDate(addDays(start, week * 7)),
    };
  }).filter((i) => i.title).sort((x, y) => x.week - y.week);
  if (items.length < 3) throw new Error('AI returned too few items');
  return { title: String(j.title || `Path to ${a.role_target}`).slice(0, 200), summary: String(j.summary || '').slice(0, 600), items };
}

export async function buildPlan(answers) {
  if (config.ai.key && ['openai', 'anthropic'].includes(config.ai.provider)) {
    try {
      const plan = clean(await callProvider(answers), answers);
      return { ...plan, source: config.ai.provider };
    } catch (e) {
      console.warn(`[ai] ${config.ai.provider} failed (${e.message}); using the built-in template generator.`);
    }
  }
  return { ...templatePlan(answers), source: 'template' };
}
