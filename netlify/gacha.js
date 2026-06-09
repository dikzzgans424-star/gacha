export async function handler() {
  try {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GITHUB_TOKEN tidak ditemukan' })
      };
    }

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

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}