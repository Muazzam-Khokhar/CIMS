export function getPaginationParams(
    searchParams: URLSearchParams,
  ) {
    const rawPage = Number(searchParams.get("page") || 1);
    const rawLimit = Number(searchParams.get("limit") || 20);
  
    const page =
      Number.isInteger(rawPage) && rawPage > 0
        ? rawPage
        : 1;
  
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 20;
  
    const skip = (page - 1) * limit;
  
    return {
      page,
      limit,
      skip,
    };
  }