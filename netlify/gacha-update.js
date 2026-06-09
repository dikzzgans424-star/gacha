export async function handler(event) {
  try {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GITHUB_TOKEN tidak ditemukan' })
      };
    }

    const { data, sha } = JSON.parse(event.body);

    if (!data || !sha) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Data atau SHA tidak lengkap' })
      };
    }

    const res = await fetch(
      "https://api.github.com/repos/dikzzgans424-star/dbslot/contents/dbdata.json",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update Gacha Data",
          content: Buffer.from(
            JSON.stringify(data, null, 2)
          ).toString("base64"),
          sha
        })
      }
    );

    const result = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        commit: result.commit?.sha
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
}
