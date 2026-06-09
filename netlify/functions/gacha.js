export async function handler() {
  const token = process.env.GITHUB_TOKEN;

  const res = await fetch(
    "https://api.github.com/repos/dikzzgans424-star/dbslot/contents/dbdata.json",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const data = await res.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
    }
