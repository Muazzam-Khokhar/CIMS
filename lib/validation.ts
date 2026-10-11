export function isValidObjectId(
    value: unknown,
  ): value is string {
    return (
      typeof value === "string" &&
      /^[a-f\d]{24}$/i.test(value)
    );
  }
  
  export function isValidPositiveNumber(
    value: unknown,
  ): value is number {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    );
  }
  
  export function isValidNonNegativeNumber(
    value: unknown,
  ): value is number {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    );
  }
  
  export function isValidDate(
    value: unknown,
  ): value is string {
    if (typeof value !== "string" || !value.trim()) {
      return false;
    }
  
    const date = new Date(value);
  
    return !Number.isNaN(date.getTime());
  }
  
  export function isValidDateOnly(
    value: unknown,
  ): value is string {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }
  
    const [year, month, day] =
      value.split("-").map(Number);
  
    const date = new Date(
      Date.UTC(year, month - 1, day),
    );
  
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
  
  export function isValidYear(
    value: unknown,
  ): value is number {
    if (
      !Number.isInteger(value) ||
      typeof value !== "number"
    ) {
      return false;
    }
  
    const currentYear =
      new Date().getFullYear();
  
    return (
      value >= 1886 &&
      value <= currentYear + 1
    );
  }
  
  export function cleanOptionalString(
    value: unknown,
  ): string | undefined {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return undefined;
    }
  
    return value.trim();
  }