export type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Calendar = { login: string; total: number; weeks: Day[][] };

const LEVEL: Record<string, Day["level"]> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const QUERY = `query($login:String!){user(login:$login){login contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;

// Prefers GITHUB_TOKEN, falling back to the local gh CLI session.
const resolveToken = async () => {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const gh = Bun.spawnSync(["gh", "auth", "token"]);
  const token = gh.stdout.toString().trim();
  if (gh.exitCode !== 0 || !token) throw new Error("Set GITHUB_TOKEN or log in with `gh auth login`.");
  return token;
};

export const fetchCalendar = async (login: string): Promise<Calendar> => {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${await resolveToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const json: any = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API: ${JSON.stringify(json.errors ?? json)}`);
  const user = json.data.user;
  if (!user) throw new Error(`User not found: ${login}`);
  const cal = user.contributionsCollection.contributionCalendar;
  return {
    login: user.login,
    total: cal.totalContributions,
    weeks: cal.weeks.map((w: any) =>
      w.contributionDays.map((d: any) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] })),
    ),
  };
};
