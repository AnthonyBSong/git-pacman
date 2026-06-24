/**
 * Fetches a user's GitHub contribution calendar via GraphQL API.
 *
 * Returns a 2D grid: grid[week][day] = contribution count (0 = no contribution).
 * Weeks run left-to-right (0 = oldest), days top-to-bottom (0 = Sunday).
 */

export interface ContributionDay {
  date: string;
  contributionCount: number;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionGrid {
  weeks: ContributionWeek[];
  totalContributions: number;
  username: string;
}

const GRAPHQL_QUERY = `
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}
`;

export async function fetchContributions(
  username: string,
  token: string
): Promise<ContributionGrid> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions: number;
            weeks: ContributionWeek[];
          };
        };
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`No contribution data found for user: ${username}`);
  }

  return {
    weeks: calendar.weeks,
    totalContributions: calendar.totalContributions,
    username,
  };
}
