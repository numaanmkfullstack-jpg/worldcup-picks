export async function readRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, string | undefined>;
  }

  const formData = await request.formData();
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : undefined]),
  );
}

export function redirectWithMessage(request: Request, path: string, key: "error" | "message", value: string) {
  const url = new URL(path, request.url);
  url.searchParams.set(key, value);

  return Response.redirect(url, 303);
}
